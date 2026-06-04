type ApiRequest = {
  method?: string;
  body?: {
    message?: string;
    context?: unknown;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_ITEMS = 8;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY belum diset di environment Vercel.',
    });
  }

  const message = String(req.body?.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return res.status(400).json({ error: 'Pertanyaan kosong.' });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-MAX_HISTORY_ITEMS)
    : [];

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = buildPrompt({
    message,
    context: req.body?.context,
    history,
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 700,
          },
        }),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        'Gemini API gagal merespons. Coba lagi beberapa saat.';
      const isQuota = response.status === 429;
      return res.status(response.status).json({
        error: isQuota
          ? 'Limit Gemini free tier sedang habis atau terlalu cepat. Coba lagi nanti.'
          : message,
      });
    }

    const answer =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim() || '';

    return res.status(200).json({
      answer: answer || 'Gemini tidak mengembalikan jawaban.',
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi error saat menghubungi Gemini API.',
    });
  }
}

function buildPrompt({
  message,
  context,
  history,
}: {
  message: string;
  context: unknown;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return [
    'Kamu adalah KPI AI Bot untuk dashboard internal contact center.',
    'Jawab dalam Bahasa Indonesia yang ringkas, jelas, dan berbasis data.',
    'Gunakan hanya data dashboard yang diberikan. Kalau data tidak cukup, bilang data belum tersedia.',
    'Jangan mengarang angka, nama agent, atau penyebab yang tidak ada di context.',
    'Saat memberi saran coaching, kaitkan dengan metrik seperti CSAT, QA, SLA, WHU, productivity, defect, dan RCA.',
    'Batasi jawaban maksimal 6 bullet atau 3 paragraf pendek.',
    '',
    'CONTEXT DASHBOARD:',
    JSON.stringify(context, null, 2).slice(0, 18000),
    '',
    'RIWAYAT CHAT TERAKHIR:',
    JSON.stringify(history, null, 2).slice(0, 6000),
    '',
    `PERTANYAAN USER: ${message}`,
  ].join('\n');
}
