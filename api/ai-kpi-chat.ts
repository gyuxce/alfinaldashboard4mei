import { buildLocalKpiAnswer, isBadModelAnswer } from './askKpiLocalAnswer';

type ChatIntent = 'summary' | 'detail' | 'coaching' | 'compare';
type BotScope = 'agent' | 'tl' | 'bpo';

type ApiRequest = {
  method?: string;
  body?: {
    message?: string;
    context?: unknown;
    intent?: ChatIntent;
    scopeMode?: BotScope;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 2;
const MAX_CONTEXT_CHARS = 6500;
const MAX_HISTORY_CHARS = 1200;
const MAX_OUTPUT_TOKENS = 550;

const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_FALLBACK_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

const SYSTEM_PROMPT = [
  'Kamu adalah Ask KPI, asisten performa Live Chat.',
  'WAJIB jawab hanya dalam Bahasa Indonesia yang sederhana dan mudah dimengerti agent/TL.',
  'Dilarang menulis bahasa Inggris, campuran Inggris-Indonesia, rencana berpikir, atau kalimat seperti "We need to", "Let\'s", "Scope mode", "Temuan — Angka — Aksi" sebagai template mentah.',
  'Dilarang menampilkan reasoning/instruksi internal.',
  'Hanya pakai angka dari CONTEXT. Jangan mengarang.',
  'Format jawaban tetap seperti ini:',
  'Dasar data: <nama/scope>, <tanggal>, <fokus>',
  '- <kalimat temuan lengkap dengan angka dan saran singkat>',
  '- <kalimat berikutnya>',
  'Maksimal 5 poin. Satu poin satu baris diawali "- ".',
  'Gunakan istilah Indonesia: produktivitas, gap (selisih target), CSAT, QA, SLA, WHU, kehadiran, tren.',
  'Contoh bagus:',
  'Dasar data: Agent Budi, 13-19 Jul 2026, ringkasan',
  '- Produktivitas turun dari 112,6 menjadi 95,6; fokus kejar target harian.',
  '- CSAT Official naik ke 4,09; pertahankan kualitas respon.',
].join('\n');

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const message = String(req.body?.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return res.status(400).json({ error: 'Pertanyaan kosong.' });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .slice(-MAX_HISTORY_ITEMS)
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(item.content || '').slice(0, 400),
        }))
    : [];

  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const primaryModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.OPENROUTER_MODEL_FALLBACK || DEFAULT_FALLBACK_MODEL;

  const prompt = buildPrompt({
    message,
    context: req.body?.context,
    intent: req.body?.intent || 'summary',
    scopeMode: req.body?.scopeMode || 'agent',
    history,
  });

  const intent = req.body?.intent || 'summary';
  const scopeMode = req.body?.scopeMode || 'agent';
  const localAnswer = buildLocalKpiAnswer(
    (req.body?.context || {}) as Parameters<typeof buildLocalKpiAnswer>[0],
    intent,
    scopeMode,
  );

  // Default: jawaban lokal ID (andal). LLM hanya jika ASK_KPI_USE_LLM=true dan jawabannya valid.
  const useLlm = process.env.ASK_KPI_USE_LLM === 'true';

  if (!useLlm) {
    return res.status(200).json({
      answer: localAnswer,
      source: 'local',
      version: 'ask-kpi-v2',
    });
  }

  const primaryKey = process.env.OPENROUTER_API_KEY;
  if (!primaryKey) {
    return res.status(200).json({
      answer: localAnswer,
      source: 'local-fallback',
      version: 'ask-kpi-v2',
      note: 'OPENROUTER_API_KEY belum diset; menampilkan ringkasan otomatis.',
    });
  }

  const fallbackKey = process.env.OPENROUTER_API_KEY_FALLBACK || primaryKey;

  const attempts: Array<{ model: string; apiKey: string; label: string }> = [
    { model: primaryModel, apiKey: primaryKey, label: 'primary' },
  ];
  if (fallbackModel && fallbackModel !== primaryModel) {
    attempts.push({ model: fallbackModel, apiKey: fallbackKey, label: 'fallback' });
  }

  let lastError = 'OpenRouter gagal merespons.';

  for (const attempt of attempts) {
    try {
      const result = await callOpenRouter({
        baseUrl,
        apiKey: attempt.apiKey,
        model: attempt.model,
        prompt,
      });

      if ('answer' in result && result.ok) {
        const finalAnswer = isBadModelAnswer(result.answer) ? localAnswer : result.answer;
        return res.status(200).json({
          answer: finalAnswer,
          model: attempt.model,
          usedFallback: attempt.label === 'fallback',
          source: isBadModelAnswer(result.answer) ? 'local-fallback' : 'llm',
          version: 'ask-kpi-v2',
        });
      }

      const fail = result as { ok: false; status: number; error: string };
      lastError = fail.error;
      const retryable =
        fail.status === 429 ||
        fail.status === 502 ||
        fail.status === 503 ||
        fail.status === 404;
      if (!retryable) {
        return res.status(200).json({
          answer: localAnswer,
          source: 'local-fallback',
          version: 'ask-kpi-v2',
          note: fail.error,
        });
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : 'Terjadi error saat menghubungi OpenRouter API.';
    }
  }

  return res.status(200).json({
    answer: localAnswer,
    source: 'local-fallback',
    version: 'ask-kpi-v2',
    note: 'Model AI gagal; menampilkan ringkasan otomatis dari data dashboard.',
  });
}

async function callOpenRouter({
  baseUrl,
  apiKey,
  model,
  prompt,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<{ ok: true; answer: string } | { ok: false; status: number; error: string }> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://aldashboardlc.vercel.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Ask KPI Dashboard',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.15,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Sembunyikan reasoning Nemotron dari response content
      reasoning: { exclude: true, effort: 'low' },
      include_reasoning: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const providerMessage =
      payload?.error?.message ||
      payload?.message ||
      'OpenRouter gagal merespons. Coba lagi beberapa saat.';
    const isQuota = response.status === 429;
    return {
      ok: false,
      status: response.status,
      error: isQuota
        ? `Rate limit/model penuh untuk ${model}. Detail: ${providerMessage}`
        : providerMessage,
    };
  }

  const messageObj = payload?.choices?.[0]?.message || {};
  // Prefer content; never fall back to reasoning field for user display
  const rawAnswer = String(messageObj?.content || '').trim();
  const finishReason = payload?.choices?.[0]?.finish_reason;
  const cleaned = cleanModelAnswer(rawAnswer);

  return {
    ok: true,
    answer: cleaned
      ? finishReason === 'length'
        ? `${cleaned}\n\nCatatan: jawaban terpotong. Minta versi lebih singkat.`
        : cleaned
      : 'Maaf, jawaban tidak bisa ditampilkan. Coba tanya lagi dengan kalimat lebih singkat.',
  };
}

function cleanModelAnswer(raw: string) {
  let text = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?thinking>/gi, '')
    .replace(/\*\*/g, '')
    .trim();

  const dasarIdx = text.search(/Dasar data\s*:/i);
  if (dasarIdx > 0) text = text.slice(dasarIdx);

  // Buang blok planning berbahasa Inggris di depan
  text = text.replace(
    /^(?:We need to|Let's|I need to|The user|Follow(?:ing)? instructions|Scope mode|INSTRUKSI OUTPUT)[\s\S]*?(?=Dasar data\s*:)/i,
    '',
  );

  // Jika masih penuh meta-bahasa Inggris tanpa Dasar data, ambil bullet saja
  const looksLikePlanning =
    /we need to|let's craft|follow instructions|temuan,\s*angka,\s*aksi/i.test(text) &&
    !/^Dasar data\s*:/im.test(text.trim());

  if (looksLikePlanning) {
    const bullets = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-•]\s+/.test(line))
      .map((line) => line.replace(/^[•]\s+/, '- '));
    if (bullets.length > 0) {
      text = ['Dasar data: filter aktif dashboard', ...bullets.slice(0, 5)].join('\n');
    }
  }

  // Rapikan bullet
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  return text;
}

function buildPrompt({
  message,
  context,
  intent,
  scopeMode,
  history,
}: {
  message: string;
  context: unknown;
  intent: ChatIntent;
  scopeMode: BotScope;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const compactContext = JSON.stringify(context ?? {}).slice(0, MAX_CONTEXT_CHARS);
  const compactHistory = JSON.stringify(history).slice(0, MAX_HISTORY_CHARS);
  const modeLabel =
    scopeMode === 'agent' ? 'satu agent' : scopeMode === 'tl' ? 'tim TL' : 'BPO / filter';
  const intentLabel =
    intent === 'coaching'
      ? 'coaching'
      : intent === 'detail'
        ? 'detail'
        : intent === 'compare'
          ? 'perbandingan periode'
          : 'ringkasan';

  return [
    `Mode: ${modeLabel}`,
    `Jenis jawaban: ${intentLabel}`,
    'DATA:',
    compactContext,
    'RIWAYAT:',
    compactHistory,
    'Aturan: jawab langsung Bahasa Indonesia saja. Mulai dari "Dasar data:". Maksimal 5 poin "- ".',
    `Pertanyaan: ${message}`,
  ].join('\n');
}
