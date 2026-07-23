type ChatIntent = 'summary' | 'detail' | 'coaching' | 'compare';
type BotScope = 'agent' | 'tl' | 'bpo';

type AgentSnap = {
  id?: string;
  name?: string;
  prodAvg?: number | null;
  prodTotal?: number | null;
  gap?: number | null;
  quota?: number | null;
  csatOff?: number | null;
  csatTakeout?: number | null;
  qa?: number | null;
  qaDefects?: number;
  highQa?: number;
  badCsat?: number;
  sla1m?: number | null;
  whu?: number | null;
  att?: number | null;
  risk?: number;
};

type KpiContext = {
  tab?: string;
  scopeMode?: BotScope;
  scope?: {
    bpo?: string;
    teamLeader?: string;
    agent?: string;
    startDate?: string;
    endDate?: string;
    comparison?: string;
  };
  summary?: {
    agentCount?: number;
    avgProd?: number | null;
    totalGap?: number | null;
    avgCsatOff?: number | null;
    avgCsatTakeout?: number | null;
    avgQa?: number | null;
    avgSla1m?: number | null;
    avgWhu?: number | null;
    avgAtt?: number | null;
    badCsat?: number;
    qaDefects?: number;
  };
  agents?: AgentSnap[];
  riskAgents?: AgentSnap[];
  topProd?: AgentSnap[];
  compare?: {
    deltas?: Array<{
      name?: string;
      dProd?: number | null;
      dGap?: number | null;
      dCsat?: number | null;
      dQa?: number | null;
      dAtt?: number | null;
      missingPrev?: boolean;
    }>;
  };
};

function fmt(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toFixed(digits).replace('.', ',');
}

function fmtSigned(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  const v = Number(n);
  return `${v > 0 ? '+' : ''}${fmt(v, digits)}`;
}

function periodLabel(scope?: KpiContext['scope']) {
  const s = scope?.startDate || '';
  const e = scope?.endDate || '';
  if (s && e) return `${s} s.d. ${e}`;
  return 'periode filter aktif';
}

function scopeLabel(scopeMode: BotScope, scope?: KpiContext['scope']) {
  if (scopeMode === 'agent') {
    const a = scope?.agent;
    return a && a !== 'All Agents' ? a : 'satu agent';
  }
  if (scopeMode === 'tl') {
    const tl = scope?.teamLeader;
    return tl && tl !== 'All TL' ? `TL ${tl}` : 'tim TL';
  }
  const bpo = scope?.bpo;
  return bpo && bpo !== 'All BPO' ? bpo : 'semua filter';
}

function focusLabel(intent: ChatIntent) {
  if (intent === 'compare') return 'perbandingan periode';
  if (intent === 'detail') return 'detail KPI';
  if (intent === 'coaching') return 'coaching';
  return 'ringkasan';
}

function trendWord(delta: number | null | undefined) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return 'stabil';
  if (delta > 0.05) return 'naik';
  if (delta < -0.05) return 'turun';
  return 'stabil';
}

export function buildLocalKpiAnswer(
  context: KpiContext,
  intent: ChatIntent,
  scopeMode: BotScope,
): string {
  const scope = context.scope || {};
  const summary = context.summary || {};
  const header = `Dasar data: ${scopeLabel(scopeMode, scope)}, ${periodLabel(scope)}, ${focusLabel(intent)}`;
  const bullets: string[] = [];

  const primary =
    context.agents?.[0] ||
    context.riskAgents?.[0] ||
    context.topProd?.[0];

  if (scopeMode === 'agent' && primary) {
    bullets.push(
      `Produktivitas rata-rata ${fmt(primary.prodAvg, 1)} chat/hari, total ${fmt(primary.prodTotal, 0)}, gap ${fmtSigned(primary.gap, 0)} dari kuota ${fmt(primary.quota, 0)}.`,
    );
    if (primary.csatOff !== null && primary.csatOff !== undefined) {
      bullets.push(`CSAT official ${fmt(primary.csatOff, 2)}; CSAT setelah takeout ${fmt(primary.csatTakeout, 1)}%.`);
    }
    if (primary.qa !== null && primary.qa !== undefined) {
      bullets.push(
        `QA ${fmt(primary.qa, 1)}% dengan ${primary.qaDefects || 0} defect (${primary.highQa || 0} high/very high).`,
      );
    }
    bullets.push(
      `SLA 1 menit ${fmt(primary.sla1m, 1)}%, WHU ${fmt(primary.whu, 1)}%, kehadiran ${fmt(primary.att, 1)}%.`,
    );
    if ((primary.badCsat || 0) > 0) {
      bullets.push(`Ada ${primary.badCsat} survey CSAT buruk (skor 1-2); prioritaskan cek kategori penyebab.`);
    }

    const delta = context.compare?.deltas?.[0];
    if (intent === 'compare' && delta && !delta.missingPrev) {
      bullets.push(
        `Vs periode sebelumnya: produktivitas ${trendWord(delta.dProd)} (${fmtSigned(delta.dProd, 1)}), gap ${fmtSigned(delta.dGap, 0)}, CSAT ${trendWord(delta.dCsat)} (${fmtSigned(delta.dCsat, 2)}), QA ${trendWord(delta.dQa)} (${fmtSigned(delta.dQa, 1)}).`,
      );
    }

    if (intent === 'coaching') {
      const focus =
        (primary.gap || 0) < 0
          ? 'kejar gap produktivitas harian'
          : (primary.qa || 100) < 90
            ? 'perbaiki kualitas QA'
            : (primary.badCsat || 0) > 0
              ? 'turunkan CSAT buruk'
              : 'pertahankan performa stabil';
      bullets.push(`Fokus coaching: ${focus}. Buat target harian kecil, review kasus buruk, dan follow-up dengan TL.`);
    }
  } else {
    bullets.push(
      `${summary.agentCount || 0} agent aktif. Produktivitas rata-rata ${fmt(summary.avgProd, 1)}, total gap ${fmtSigned(summary.totalGap, 0)}.`,
    );
    bullets.push(
      `CSAT official ${fmt(summary.avgCsatOff, 2)}, CSAT takeout ${fmt(summary.avgCsatTakeout, 1)}%, QA ${fmt(summary.avgQa, 1)}%.`,
    );
    bullets.push(
      `SLA 1m ${fmt(summary.avgSla1m, 1)}%, WHU ${fmt(summary.avgWhu, 1)}%, kehadiran ${fmt(summary.avgAtt, 1)}%.`,
    );
    if ((summary.badCsat || 0) > 0 || (summary.qaDefects || 0) > 0) {
      bullets.push(`Total CSAT buruk ${summary.badCsat || 0}, defect QA ${summary.qaDefects || 0}.`);
    }

    const risks = context.riskAgents || [];
    if (risks.length > 0 && (intent === 'detail' || intent === 'coaching')) {
      const names = risks
        .slice(0, 3)
        .map((a) => `${a.name} (risk ${fmt(a.risk, 0)})`)
        .join(', ');
      bullets.push(`Perlu perhatian: ${names}.`);
    }

    if (intent === 'coaching') {
      bullets.push('Rencana tim: fokus 3 agent risiko tertinggi, coaching harian singkat, dan pantau gap produktivitas minggu ini.');
    }
  }

  const unique = bullets.filter(Boolean).slice(0, 5);
  return [header, ...unique.map((b) => `- ${b}`)].join('\n');
}

export function isBadModelAnswer(text: string) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (!/^Dasar data\s*:/i.test(t)) return true;
  if (/we need to|let's|scope mode|follow instructions|temuan,\s*angka|let's craft|i need to|the user wants/i.test(t)) {
    return true;
  }
  // Terlalu banyak kata Inggris umum
  const englishHits = (t.match(/\b(the|and|with|from|need|should|will|agent|compare|data)\b/gi) || []).length;
  if (englishHits >= 4) return true;
  return false;
}
