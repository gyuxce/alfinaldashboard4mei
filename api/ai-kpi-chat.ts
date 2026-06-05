type ApiRequest = {
  method?: string;
  body?: {
    message?: string;
    context?: unknown;
    intent?: 'summary' | 'detail' | 'coaching';
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_ITEMS = 4;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY belum diset di environment Vercel.',
    });
  }

  const message = String(req.body?.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return res.status(400).json({ error: 'Pertanyaan kosong.' });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-MAX_HISTORY_ITEMS)
    : [];

  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const prompt = buildPrompt({
    message,
    context: req.body?.context,
    intent: req.body?.intent || 'summary',
    history,
  });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'KPI Dashboard',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah Lumi, asisten performa untuk dashboard internal contact center.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.35,
        max_tokens: 900,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const providerMessage =
        payload?.error?.message ||
        payload?.message ||
        'OpenRouter gagal merespons. Coba lagi beberapa saat.';
      const isQuota = response.status === 429;
      return res.status(response.status).json({
        error: isQuota
          ? `OpenRouter menolak request untuk model ${model}. Biasanya ini karena rate limit, provider sedang penuh, atau limit akun/model. Tunggu 1-2 menit lalu coba lagi. Detail: ${providerMessage}`
          : providerMessage,
      });
    }

    const answer =
      String(payload?.choices?.[0]?.message?.content || '')
        .trim() || '';
    const finishReason = payload?.choices?.[0]?.finish_reason;

    return res.status(200).json({
      answer: answer
        ? finishReason === 'length'
          ? `${answer}\n\nCatatan: jawaban terpotong karena batas output AI. Coba minta versi lebih singkat.`
          : answer
        : 'OpenRouter tidak mengembalikan jawaban.',
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi error saat menghubungi OpenRouter API.',
    });
  }
}

function buildPrompt({
  message,
  context,
  intent,
  history,
}: {
  message: string;
  context: unknown;
  intent: 'summary' | 'detail' | 'coaching';
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return [
    'Kamu adalah Lumi, asisten performa untuk dashboard internal contact center.',
    'Jawab dalam Bahasa Indonesia yang ringkas, jelas, dan berbasis data.',
    'Gunakan hanya data dashboard yang diberikan. Kalau data tidak cukup, bilang data belum tersedia.',
    'Jangan mengarang angka, nama agent, atau penyebab yang tidak ada di context.',
    'Saat memberi ringkasan performa atau coaching, cek KPI utama yang tersedia: Productivity, CSAT Official, CSAT Takeout/SC, QA Score, QA Defect, SLA 1 menit, SLA 3 menit, WHU, Attendance, RCA, trendSamples, dan ranking risiko.',
    'Kamu bisa membaca semua area dashboard dari context: productivityTotal, productivityAverage, manDays, CSAT official, CSAT SC/takeout, badCsatDetails, QA, qaDefectDetails, highQaDetails, SLA, WHU, attendanceScore, RCA, trendSamples, dan ranking risiko.',
    'Jika user bertanya CSAT, pakai csatScoreCounts, topCsatCategories, badCsatDetails, dan rcaBreakdown.',
    'Jika user bertanya QA, pakai topQaCategories, qaDefectDetails, highQaDetails, crmCode, remarks, feedback, ticket/chat, dan qcName.',
    'Jika user bertanya SLA/WHU/Productivity/Attendance, pakai nilai metrik utama dan trendSamples yang tersedia.',
    'Jika user meminta Performa Agent, susun jawaban dengan bagian: Ringkasan umum, KPI kuat, KPI perlu perhatian, penyebab/risk, saran aksi.',
    'Jika user meminta Private Coaching atau DMAIC, susun jawaban dengan bagian Define, Measure, Analyze, Improve, Control secara singkat dan pastikan Measure menyebut semua KPI utama yang tersedia.',
    'Untuk coaching, gunakan bahasa yang suportif dan berbasis tindakan, bukan menghakimi agent.',
    'Wajib awali jawaban dengan 1 baris "Dasar data:" yang menyebut scope/periode/metric utama yang benar-benar ada di context.',
    'Contoh singkat: "Dasar data: Agent A, periode 1-30 Juni 2026, QA 32 evaluasi, CSAT Official 4.2."',
    'Jawaban harus selesai utuh, jangan berhenti di tengah kalimat.',
    'Jangan pakai emoji.',
    'Jangan pakai markdown asterisk (*), bold (**), atau numbering panjang.',
    'Jika memakai poin, wajib pakai bullet "-" dan setiap bullet harus di baris baru.',
    'Batasi jawaban maksimal 8 bullet pendek. Tiap bullet maksimal 1 kalimat.',
    'Jika pertanyaan meminta ringkasan, gunakan format: Performa umum, risiko utama, penyebab, saran aksi.',
    '',
    'CONTEXT DASHBOARD:',
    `Mode context: ${intent}`,
    JSON.stringify(context, null, 2).slice(0, 12000),
    '',
    'RIWAYAT CHAT TERAKHIR:',
    JSON.stringify(history, null, 2).slice(0, 3000),
    '',
    `PERTANYAAN USER: ${message}`,
  ].join('\n');
}
