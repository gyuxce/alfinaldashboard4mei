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
const MAX_HISTORY_ITEMS = 3;
const MAX_CONTEXT_CHARS = 7000;
const MAX_HISTORY_CHARS = 1800;
const MAX_OUTPUT_TOKENS = 700;

const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_FALLBACK_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

const SYSTEM_PROMPT = [
  'Kamu adalah Ask KPI, asisten performa dashboard Live Chat KPI.',
  'OUTPUT HANYA jawaban final untuk user. Dilarang menampilkan rencana, reasoning, "We need to", "Let\'s craft", atau instruksi internal.',
  'Jawab Bahasa Indonesia ringkas. Hanya pakai CONTEXT. Jangan mengarang angka/nama.',
  'Jika data tidak ada di CONTEXT, bilang belum tersedia di filter aktif.',
  'Baris pertama wajib: Dasar data: <scope>, <periode>, <tab>.',
  'Lalu maksimal 6 bullet diawali "- " dengan pola: Temuan — Angka — Aksi (satu kalimat per bullet).',
  'Tanpa emoji. Tanpa markdown bold/asterisk. Tanpa penjelasan cara menjawab.',
  'Untuk coaching/DMAIC: Define, Measure, Analyze, Improve, Control (singkat, langsung isi).',
].join(' ');

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const primaryKey = process.env.OPENROUTER_API_KEY;
  if (!primaryKey) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY belum diset. Isi di Vercel Environment Variables.',
    });
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
          content: String(item.content || '').slice(0, 600),
        }))
    : [];

  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const primaryModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.OPENROUTER_MODEL_FALLBACK || DEFAULT_FALLBACK_MODEL;
  const fallbackKey = process.env.OPENROUTER_API_KEY_FALLBACK || primaryKey;

  const prompt = buildPrompt({
    message,
    context: req.body?.context,
    intent: req.body?.intent || 'summary',
    scopeMode: req.body?.scopeMode || 'agent',
    history,
  });

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
        return res.status(200).json({
          answer: result.answer,
          model: attempt.model,
          usedFallback: attempt.label === 'fallback',
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
        return res.status(fail.status).json({ error: fail.error });
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : 'Terjadi error saat menghubungi OpenRouter API.';
    }
  }

  return res.status(502).json({
    error: `${lastError} (primary + fallback model gagal). Tunggu 1-2 menit lalu coba lagi.`,
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
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
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

  const rawAnswer = String(
    payload?.choices?.[0]?.message?.content ||
      payload?.choices?.[0]?.message?.reasoning ||
      '',
  ).trim();
  const finishReason = payload?.choices?.[0]?.finish_reason;
  const cleaned = cleanModelAnswer(rawAnswer);

  return {
    ok: true,
    answer: cleaned
      ? finishReason === 'length'
        ? `${cleaned}\n\nCatatan: jawaban terpotong. Minta versi lebih singkat.`
        : cleaned
      : 'OpenRouter tidak mengembalikan jawaban yang bisa ditampilkan. Coba tanya lagi lebih singkat.',
  };
}

function cleanModelAnswer(raw: string) {
  let text = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?thinking>/gi, '')
    .trim();

  // Drop leaked planning / instruction rehearsal before the real answer
  const dasarIdx = text.search(/Dasar data\s*:/i);
  if (dasarIdx > 0) {
    text = text.slice(dasarIdx);
  }

  const leakPatterns = [
    /^We need to follow[\s\S]*?(?=Dasar data\s*:)/i,
    /^Let's (craft|do|start|write)[\s\S]*?(?=Dasar data\s*:)/i,
    /^I (need|will|should)[\s\S]*?(?=Dasar data\s*:)/i,
    /^The (user|instructions?)[\s\S]*?(?=Dasar data\s*:)/i,
  ];
  for (const pattern of leakPatterns) {
    text = text.replace(pattern, '');
  }

  // If still mostly meta-talk without Dasar data, keep only bullet-looking lines
  if (!/Dasar data\s*:/i.test(text) && /we need to|let's craft|follow instructions/i.test(text)) {
    const bullets = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- ') || line.startsWith('• '));
    if (bullets.length > 0) {
      text = ['Dasar data: filter aktif dashboard', ...bullets].join('\n');
    }
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
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

  return [
    `Scope mode: ${scopeMode}`,
    `Intent: ${intent}`,
    'CONTEXT:',
    compactContext,
    'HISTORY:',
    compactHistory,
    'INSTRUKSI OUTPUT: langsung tulis jawaban final saja. Jangan tulis rencana/reasoning.',
    `QUESTION: ${message}`,
  ].join('\n');
}
