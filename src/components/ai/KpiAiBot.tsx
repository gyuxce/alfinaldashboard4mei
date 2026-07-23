import React from 'react';
import {
  ArrowLeft,
  Bot,
  Building2,
  Loader2,
  Minus,
  Send,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AgentKPI, getOfficialCsatAggregate } from '../../lib/dataProcessor';
import { cn } from '../../lib/utils';

type ChatIntent = 'summary' | 'detail' | 'coaching' | 'compare';
type BotScope = 'agent' | 'tl' | 'bpo';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  intent?: ChatIntent;
};

type KpiAiBotProps = {
  data: AgentKPI[];
  previousData?: AgentKPI[];
  activeTab: string;
  onOpenFilters?: () => void;
  /** Controlled open state (for sidebar trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide floating FAB when trigger lives in sidebar. Default true for back-compat. */
  showFloatingTrigger?: boolean;
  filters: {
    bpo: string;
    teamLeader: string;
    agent: string;
    startDate: string;
    endDate: string;
    comparison: string;
  };
};

const TEAL = {
  bg: 'bg-[#0D9488]',
  bgHover: 'hover:bg-[#0F766E]',
  text: 'text-[#0D9488]',
  soft: 'bg-[#0D9488]/10',
  border: 'border-[#0D9488]/25',
  ring: 'focus:ring-[#0D9488]/30',
  shadow: 'shadow-[#0D9488]/25',
};

const initialMessage = (scope: BotScope): ChatMessage => ({
  role: 'assistant',
  content:
    scope === 'agent'
      ? 'Halo, saya Ask KPI. Pilih 1 agent di filter, atau ganti mode TL/BPO untuk baca performa tim. Saya jawab dalam Bahasa Indonesia yang ringkas.'
      : scope === 'tl'
        ? 'Mode TL aktif. Pilih Team Leader di filter, lalu tanya gap, agent yang perlu perhatian, atau coaching tim.'
        : 'Mode BPO aktif. Tanya ringkasan portfolio dari filter BPO saat ini.',
});

function startersFor(scope: BotScope, activeTab: string, comparisonOn: boolean) {
  const tabHint = activeTabLabel(activeTab);
  if (scope === 'agent') {
    return [
      {
        title: 'Performa Agent',
        description: `Ringkas KPI agent (fokus ${tabHint}).`,
        prompt:
          'Tolong ringkas performa agent ini dalam Bahasa Indonesia sederhana: produktivitas (total, rata-rata, gap, kuota), CSAT official, CSAT takeout, QA, SLA 1 menit, SLA 3 menit, WHU, kehadiran, dan tren. Sebut apa yang perlu diperbaiki.',
        intent: 'summary' as const,
      },
      {
        title: 'Detail CSAT & QA',
        description: 'Bedah skor rendah dan defect.',
        prompt:
          'Tolong cek detail CSAT dan QA agent ini dalam Bahasa Indonesia. Fokus skor 1-2, skor 3, defect QA, kategori, level, dan catatan yang ada di data.',
        intent: 'detail' as const,
      },
      {
        title: 'Private Coaching',
        description: 'DMAIC singkat berbasis data.',
        prompt:
          'Buat coaching pribadi DMAIC untuk agent ini dalam Bahasa Indonesia yang suportif dan mudah dipahami. Sebut angka KPI yang tersedia lalu beri rencana aksi jelas.',
        intent: 'coaching' as const,
      },
      ...(comparisonOn
        ? [
            {
              title: 'Bandingkan periode',
              description: 'Naik/turun vs periode sebelumnya.',
              prompt:
                'Bandingkan performa agent ini vs periode sebelumnya dalam Bahasa Indonesia. Sebut KPI yang naik atau turun beserta angkanya, lalu beri prioritas aksi.',
              intent: 'compare' as const,
            },
          ]
        : []),
    ];
  }

  if (scope === 'tl') {
    return [
      {
        title: 'Ringkas TL',
        description: 'Gap dan risiko tim TL ini.',
        prompt:
          'Ringkas performa TL ini dalam Bahasa Indonesia: jumlah agent, rata-rata produktivitas/gap, CSAT, QA, SLA, WHU, kehadiran. Sebut risiko utama dan siapa yang perlu perhatian.',
        intent: 'summary' as const,
      },
      {
        title: 'Perlu perhatian',
        description: 'Agent paling berisiko di TL.',
        prompt:
          'Dari data TL ini, daftar agent yang paling perlu perhatian dalam Bahasa Indonesia. Sertakan alasan singkat dari KPI (gap produktivitas, CSAT buruk, defect QA, kehadiran, SLA/WHU).',
        intent: 'detail' as const,
      },
      {
        title: 'Coaching Tim',
        description: 'Rencana aksi TL.',
        prompt:
          'Buat rencana coaching untuk TL ini dalam Bahasa Indonesia berbasis DMAIC singkat: fokus 3 aksi prioritas berdasarkan data filter aktif.',
        intent: 'coaching' as const,
      },
    ];
  }

  return [
    {
      title: 'Ringkas BPO / Filter',
      description: 'Portfolio dari filter aktif.',
      prompt:
        'Ringkas performa BPO/filter aktif dalam Bahasa Indonesia: jumlah agent, rata-rata KPI utama, total CSAT buruk, total defect QA, dan risiko terbesar.',
      intent: 'summary' as const,
    },
    {
      title: 'Top & Under',
      description: 'Siapa bagus / perlu perhatian.',
      prompt:
        'Tampilkan agent produktivitas tertinggi dan yang paling perlu perhatian dari filter aktif dalam Bahasa Indonesia. Beri rekomendasi perbaikan singkat.',
      intent: 'detail' as const,
    },
    {
      title: 'Fokus tab ini',
      description: `Insight untuk ${tabHint}.`,
      prompt: `Fokus pada tab ${tabHint}. Jelaskan temuan utama dari data filter aktif dalam Bahasa Indonesia dan beri 3 rekomendasi aksi.`,
      intent: 'summary' as const,
    },
  ];
}

export function KpiAiBot({
  data,
  previousData = [],
  activeTab,
  filters,
  onOpenFilters,
  open,
  onOpenChange,
  showFloatingTrigger = true,
}: KpiAiBotProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  };
  const [scopeMode, setScopeMode] = React.useState<BotScope>('agent');
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([initialMessage('agent')]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastRequestAtRef = React.useRef(0);

  const agentSelected = filters.agent !== 'All Agents' && filters.agent.trim() !== '';
  const tlSelected = filters.teamLeader !== 'All TL' && filters.teamLeader.trim() !== '';
  const comparisonOn = filters.comparison !== 'Off';

  const canAsk =
    scopeMode === 'agent'
      ? agentSelected
      : scopeMode === 'tl'
        ? tlSelected || data.length > 0
        : data.length > 0;

  const scopeReady =
    scopeMode === 'agent' ? agentSelected : scopeMode === 'tl' ? tlSelected || data.length > 0 : data.length > 0;

  React.useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages, isLoading]);

  React.useEffect(() => {
    setMessages([initialMessage(scopeMode)]);
    setError('');
    setInput('');
  }, [scopeMode]);

  const previewContext = React.useMemo(
    () => buildKpiContext(data, previousData, activeTab, filters, 'summary', scopeMode),
    [activeTab, data, filters, previousData, scopeMode],
  );

  const resetChat = () => {
    setInput('');
    setError('');
    setIsLoading(false);
    setMessages([initialMessage(scopeMode)]);
  };

  const sendMessage = async (override?: string, intent?: ChatIntent) => {
    const message = (override || input).trim();
    if (!message || isLoading) return;

    if (scopeMode === 'agent' && !agentSelected) {
      setError('Mode Agent: pilih 1 agent di filter dashboard dulu.');
      return;
    }
    if (scopeMode === 'tl' && !tlSelected && data.length === 0) {
      setError('Mode TL: pilih Team Leader di filter atau pastikan data tim tersedia.');
      return;
    }
    if (data.length === 0) {
      setError('Tidak ada data agent pada filter aktif.');
      return;
    }

    const now = Date.now();
    const waitMs = 4000 - (now - lastRequestAtRef.current);
    if (waitMs > 0) {
      setError(`Tunggu ${Math.ceil(waitMs / 1000)} detik sebelum kirim lagi (jaga rate limit free model).`);
      return;
    }
    lastRequestAtRef.current = now;

    const resolvedIntent = intent || inferChatIntent(message, comparisonOn);
    const requestContext = buildKpiContext(
      data,
      previousData,
      activeTab,
      filters,
      resolvedIntent,
      scopeMode,
    );
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: message, intent: resolvedIntent },
    ];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-kpi-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          intent: resolvedIntent,
          scopeMode,
          context: requestContext,
          history: nextMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Ask KPI gagal merespons.');
      }

      const suffix = payload?.usedFallback ? '\n\n(Catatan: memakai model fallback Ultra.)' : '';
      const rawAnswer = `${payload.answer || 'Tidak ada jawaban.'}${suffix}`;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: sanitizeAssistantText(rawAnswer),
          intent: resolvedIntent,
        },
      ]);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Terjadi error pada Ask KPI.';
      setError(errMessage);
      setMessages((prev) => [...prev, { role: 'assistant', content: errMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const starterQuestions = startersFor(scopeMode, activeTab, comparisonOn);
  const scopeCaption =
    scopeMode === 'agent'
      ? agentSelected
        ? filters.agent
        : 'Pilih agent'
      : scopeMode === 'tl'
        ? tlSelected
          ? `TL ${filters.teamLeader}`
          : 'Pilih TL / filter tim'
        : filters.bpo !== 'All BPO'
          ? filters.bpo
          : 'Semua filter aktif';

  return (
    <>
      {showFloatingTrigger && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed bottom-4 right-4 z-[90] flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2',
            TEAL.bg,
            TEAL.border,
            TEAL.shadow,
            TEAL.ring,
            TEAL.bgHover,
            isOpen && 'hidden',
          )}
          title="Ask KPI"
        >
          <Bot className="h-4 w-4" />
          Ask KPI
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-3 right-3 z-[90] flex h-[78vh] max-h-[640px] w-[calc(100vw-24px)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white', TEAL.bg)}>
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-text-primary leading-tight">Ask KPI</h3>
                <p className="truncate text-[10px] text-text-muted">
                  {scopeCaption}
                  {comparisonOn ? ` · Compare` : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={resetChat}
                className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                aria-label="Reset chat"
                title="Kembali"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                aria-label="Minimize Ask KPI"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  resetChat();
                  setIsOpen(false);
                }}
                className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                aria-label="Close Ask KPI"
                title="Tutup dan reset"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-border bg-card px-2 py-1.5">
            {(
              [
                { id: 'agent' as const, label: 'Agent', icon: UserCheck },
                { id: 'tl' as const, label: 'TL', icon: Users },
                { id: 'bpo' as const, label: 'BPO', icon: Building2 },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              const active = scopeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setScopeMode(mode.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors',
                    active
                      ? cn(TEAL.bg, 'text-white')
                      : 'bg-surface text-text-secondary hover:bg-surface-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-card p-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-[10px] text-text-muted">
              <span>
                <span className="font-bold text-text-primary">{previewContext.summary.agentCount}</span> agent · filter aktif
              </span>
              {!scopeReady ? (
                <span className="font-semibold text-warning">
                  {scopeMode === 'agent' ? 'Pilih agent' : 'Lengkapi filter'}
                </span>
              ) : (
                <span className={cn('font-semibold', TEAL.text)}>Siap</span>
              )}
            </div>

            {!scopeReady && onOpenFilters && (
              <button
                type="button"
                onClick={onOpenFilters}
                className="w-full rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[10px] font-bold text-warning hover:bg-warning/10"
              >
                Buka filter
              </button>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  'max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  message.role === 'user'
                    ? cn('ml-auto text-white', TEAL.bg)
                    : 'mr-auto border border-border bg-surface text-text-primary',
                )}
              >
                {message.content}
              </div>
            ))}

            {isLoading && (
              <div className="mr-auto flex max-w-[88%] items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-muted">
                <Loader2 className={cn('h-4 w-4 animate-spin', TEAL.text)} />
                Membaca KPI...
              </div>
            )}
          </div>

          {scopeReady && messages.length <= 1 && (
            <div className="grid shrink-0 grid-cols-1 gap-1.5 border-t border-border bg-surface/40 p-3">
              {starterQuestions.map((question) => (
                <button
                  key={question.title}
                  type="button"
                  onClick={() => sendMessage(question.prompt, question.intent)}
                  className={cn(
                    'rounded-xl border border-border bg-card px-3 py-2 text-left text-[11px] font-semibold text-text-secondary transition-colors',
                    'hover:bg-[#0D9488]/10 hover:text-[#0D9488]',
                  )}
                >
                  <span className="block text-xs font-black text-text-primary">{question.title}</span>
                  <span className="mt-0.5 block font-medium leading-snug text-text-muted">
                    {question.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="shrink-0 border-t border-danger/20 bg-danger/5 px-3 py-2 text-[11px] font-semibold text-danger">
              {error}
            </div>
          )}

          <form
            className="flex shrink-0 items-center gap-2 border-t border-border bg-card p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                canAsk
                  ? scopeMode === 'agent'
                    ? 'Tanya performa agent ini...'
                    : scopeMode === 'tl'
                      ? 'Tanya gap / underperform TL...'
                      : 'Tanya ringkasan BPO / filter...'
                  : 'Lengkapi filter dulu...'
              }
              disabled={!canAsk}
              className={cn(
                'min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:ring-1',
                'focus:border-[#0D9488] focus:ring-[#0D9488]',
              )}
            />
            <button
              type="submit"
              disabled={!canAsk || !input.trim() || isLoading}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:bg-text-disabled',
                TEAL.bg,
                TEAL.bgHover,
              )}
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function buildKpiContext(
  data: AgentKPI[],
  previousData: AgentKPI[],
  activeTab: string,
  filters: KpiAiBotProps['filters'],
  intent: ChatIntent,
  scopeMode: BotScope,
) {
  const scopedAgents =
    scopeMode === 'agent' && filters.agent !== 'All Agents'
      ? data.filter((a) => a.csId === filters.agent || a.name === filters.agent)
      : data;

  const agents = scopedAgents.map((agent) => toAgentSnapshot(agent, intent, scopeMode));
  const prevMap = new Map(previousData.map((a) => [a.csId, a]));
  const officialCsat = getOfficialCsatAggregate(scopedAgents);
  const takeoutGood = scopedAgents.reduce((sum, agent) => sum + agent.csatScFairGoodCount, 0);
  const takeoutValid = scopedAgents.reduce((sum, agent) => sum + agent.csatScFairTotalValid, 0);
  const totalGap = scopedAgents.reduce((sum, agent) => sum + (agent.gap || 0), 0);

  const summary = {
    agentCount: agents.length,
    avgProd: average(agents.map((a) => a.prodAvg)),
    totalProd: round(scopedAgents.reduce((s, a) => s + a.productivityTotal, 0)),
    totalGap: round(totalGap),
    avgCsatOff: officialCsat.score,
    avgCsatTakeout: takeoutValid > 0 ? round((takeoutGood / takeoutValid) * 100) : null,
    avgQa: average(agents.map((a) => a.qa).filter(isNumber)),
    avgSla1m: average(agents.map((a) => a.sla1m).filter(isNumber)),
    avgWhu: average(agents.map((a) => a.whu).filter(isNumber)),
    avgAtt: average(agents.map((a) => a.att).filter(isNumber)),
    badCsat: agents.reduce((sum, a) => sum + (a.badCsat || 0), 0),
    qaDefects: agents.reduce((sum, a) => sum + (a.qaDefects || 0), 0),
  };

  // L2 rankings only for TL/BPO (token saver for single-agent)
  const includeRanks = scopeMode !== 'agent' || agents.length > 1;
  const riskAgents = includeRanks
    ? [...agents].sort((a, b) => (b.risk || 0) - (a.risk || 0)).slice(0, intent === 'detail' ? 8 : 5)
    : agents.slice(0, 1);
  const topProd = includeRanks
    ? [...agents].sort((a, b) => (b.prodTotal || 0) - (a.prodTotal || 0)).slice(0, 5)
    : undefined;
  const lowQa = includeRanks
    ? agents
        .filter((a) => a.qa !== null)
        .sort((a, b) => (a.qa || 0) - (b.qa || 0))
        .slice(0, 5)
    : undefined;
  const lowAtt = includeRanks
    ? agents
        .filter((a) => a.att !== null && (a.att || 0) < 95)
        .sort((a, b) => (a.att || 0) - (b.att || 0))
        .slice(0, 5)
    : undefined;

  let compare: unknown = undefined;
  if ((intent === 'compare' || filters.comparison !== 'Off') && previousData.length > 0) {
    const prevScoped =
      scopeMode === 'agent' && filters.agent !== 'All Agents'
        ? previousData.filter((a) => a.csId === filters.agent || a.name === filters.agent)
        : previousData.filter((a) => scopedAgents.some((c) => c.csId === a.csId));
    const prevOfficial = getOfficialCsatAggregate(prevScoped);
    compare = {
      prevAgentCount: prevScoped.length,
      prevAvgProd: average(prevScoped.map((a) => a.productivityAverage)),
      prevAvgCsatOff: prevOfficial.score,
      prevAvgQa: average(
        prevScoped
          .map((a) => (a.qaScoreCount > 0 ? a.qaScoreSum / a.qaScoreCount : null))
          .filter(isNumber),
      ),
      deltas: agents.slice(0, scopeMode === 'agent' ? 1 : 5).map((a) => {
        const prev = prevMap.get(a.id);
        if (!prev) return { id: a.id, name: a.name, missingPrev: true };
        const prevQa = prev.qaScoreCount > 0 ? prev.qaScoreSum / prev.qaScoreCount : null;
        return {
          id: a.id,
          name: a.name,
          dProd: nullableRound((a.prodAvg || 0) - (prev.productivityAverage || 0)),
          dGap: nullableRound((a.gap || 0) - (prev.gap || 0)),
          dCsat: nullableRound(
            a.csatOff !== null && prev.csatAsli !== null ? (a.csatOff || 0) - prev.csatAsli : null,
          ),
          dQa: nullableRound(a.qa !== null && prevQa !== null ? (a.qa || 0) - prevQa : null),
          dAtt: nullableRound((a.att || 0) - (prev.attendanceScore || 0)),
        };
      }),
    };
  }

  return {
    tab: activeTab,
    scopeMode,
    scope: filters,
    summary,
    agents: scopeMode === 'agent' ? agents : undefined,
    riskAgents: scopeMode === 'agent' ? undefined : riskAgents,
    topProd,
    lowQa,
    lowAtt,
    // For agent mode keep full snapshots in `agents`; for team keep compact risk list only unless detail
    detailAgents:
      scopeMode !== 'agent' && (intent === 'detail' || intent === 'coaching')
        ? riskAgents.slice(0, 3)
        : undefined,
    compare,
  };
}

function toAgentSnapshot(agent: AgentKPI, intent: ChatIntent, scopeMode: BotScope) {
  const includeIssueDetails =
    (intent === 'detail' || intent === 'coaching') && (scopeMode === 'agent' || intent === 'detail');
  const detailLimit = intent === 'detail' ? (scopeMode === 'agent' ? 6 : 3) : intent === 'coaching' ? 2 : 0;
  const textLimit = intent === 'detail' ? 160 : 120;
  const trendLimit = intent === 'summary' ? 4 : 3;

  const qaScore = agent.qaScoreCount > 0 ? agent.qaScoreSum / agent.qaScoreCount : null;
  const qaDefects = agent.qaHistory || [];
  const highQaDefects = qaDefects.filter((entry) =>
    ['high', 'very high'].includes(String(entry.mistakeLevel || '').toLowerCase()),
  );

  const base = {
    id: agent.csId,
    name: agent.name || agent.csId,
    bpo: agent.bpo || '-',
    tl: agent.teamLeader || '-',
    prodTotal: round(agent.productivityTotal),
    prodAvg: round(agent.productivityAverage),
    quota: round(agent.targetQuota || 0),
    gap: round(agent.gap || 0),
    manDays: agent.manDays,
    csatOff: nullableRound(agent.csatAsli),
    csatTakeout: nullableRound(agent.csatScFair),
    csatFull: nullableRound(agent.csatScFull),
    badCsat: agent.csatScBadScoreFullCount || 0,
    scores: {
      s5: agent.csat5Count || 0,
      s4: agent.csat4Count || 0,
      s3: agent.csat3Count || 0,
      s2: agent.csat2Count || 0,
      s1: agent.csat1Count || 0,
    },
    qa: nullableRound(qaScore),
    qaDefects: qaDefects.length,
    highQa: highQaDefects.length,
    sla1m: nullableRound(agent.sla1m),
    sla3m: nullableRound(agent.sla3m),
    whu: nullableRound(agent.whu),
    att: round(agent.attendanceScore || 0),
    attDuty: agent.attendanceDuty || 0,
    attPresence: agent.attendancePresence || 0,
    risk: round(
      (agent.csatScBadScoreFullCount || 0) * 3 +
        highQaDefects.length * 4 +
        Math.max(0, 85 - (qaScore || 100)) +
        Math.max(0, 80 - (agent.sla1m || 100)) / 2 +
        Math.max(0, -(agent.gap || 0)) / 20,
    ),
  };

  if (!includeIssueDetails) {
    return {
      ...base,
      topCsat: topEntries(agent.csatScCategoriesFull || {}, 3),
      topQa: countBy(qaDefects.map((e) => e.category || 'Uncategorized')).slice(0, 3),
      rca: {
        total: agent.rcaTotalCases || 0,
        agent: topEntries(agent.rcaAgentAreaCounts || {}, 3),
      },
      trend:
        intent === 'summary' || intent === 'compare'
          ? {
              prod: recentHistory(agent.dailyHistory.productivity, trendLimit),
              csat: recentHistory(agent.dailyHistory.csat, trendLimit),
            }
          : undefined,
    };
  }

  return {
    ...base,
    topCsat: topEntries(agent.csatScCategoriesFull || {}, 4),
    topQa: countBy(qaDefects.map((e) => e.category || 'Uncategorized')).slice(0, 4),
    badCsatRows: (agent.csatHistory || [])
      .filter((e) => e.score === 1 || e.score === 2)
      .slice(0, detailLimit)
      .map((e) => ({
        d: e.date || '-',
        s: e.score,
        c: e.category || '-',
        r: truncateText(e.response || '-', textLimit),
        takeout: Boolean(e.isTakeout),
      })),
    qaRows: qaDefects
      .filter((e) => String(e.mistakeLevel || '').toLowerCase() !== 'no mistake')
      .slice(0, detailLimit)
      .map((e) => ({
        d: e.date || '-',
        lvl: e.mistakeLevel || '-',
        c: e.category || '-',
        note: truncateText(e.remarks || e.feedback || '-', textLimit),
      })),
    rca: {
      total: agent.rcaTotalCases || 0,
      agent: topEntries(agent.rcaAgentAreaCounts || {}, 4),
      cust: topEntries(agent.rcaCustomerAreaCounts || {}, 3),
      proc: topEntries(agent.rcaAkulakuProcessCounts || {}, 3),
    },
    trend: {
      prod: recentHistory(agent.dailyHistory.productivity, trendLimit),
      csat: recentHistory(agent.dailyHistory.csat, trendLimit),
      sla1m: recentHistory(agent.dailyHistory.sla1m, trendLimit),
      whu: recentHistory(agent.dailyHistory.whu, trendLimit),
    },
  };
}

function activeTabLabel(activeTab: string) {
  const map: Record<string, string> = {
    summary: 'Summary',
    leaderboard: 'Leaderboard',
    productivity: 'Productivity',
    csat_official: 'CSAT Official',
    csat: 'CSAT Room',
    csat_rca: 'CSAT RCA',
    sla: 'SLA',
    whu: 'WHU',
    qa: 'QA',
    schedule: 'Schedule',
    attendance: 'Attendance',
    files: 'Files',
  };
  return map[activeTab] || activeTab;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function topEntries(record: Record<string, number>, limit: number) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function recentHistory(entries: Array<{ date: string; value: number }>, limit = 10) {
  return entries.slice(-limit).map((entry) => ({
    d: entry.date,
    v: round(entry.value),
  }));
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter(isNumber);
  if (clean.length === 0) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nullableRound(value: number | null | undefined) {
  return isNumber(value) ? round(value) : null;
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function truncateText(value: string, maxLength: number) {
  const clean = String(value || '').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3)}...`;
}

function sanitizeAssistantText(raw: string) {
  let text = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*\*/g, '')
    .trim();
  const dasarIdx = text.search(/Dasar data\s*:/i);
  if (dasarIdx > 0) text = text.slice(dasarIdx);
  text = text.replace(
    /^(?:We need to|Let's|I need to|Follow(?:ing)? instructions|Scope mode)[\s\S]*?(?=Dasar data\s*:)/i,
    '',
  );
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function inferChatIntent(message: string, comparisonOn: boolean): ChatIntent {
  const lower = message.toLowerCase();
  if (
    lower.includes('coaching') ||
    lower.includes('dmaic') ||
    lower.includes('action plan') ||
    lower.includes('rencana')
  ) {
    return 'coaching';
  }
  if (
    lower.includes('banding') ||
    lower.includes('compare') ||
    lower.includes('wow') ||
    lower.includes('mom') ||
    lower.includes('sebelum') ||
    (comparisonOn && (lower.includes('delta') || lower.includes('naik') || lower.includes('turun')))
  ) {
    return 'compare';
  }
  if (
    lower.includes('csat') ||
    lower.includes('qa') ||
    lower.includes('defect') ||
    lower.includes('underperform') ||
    lower.includes('risiko') ||
    lower.includes('risk') ||
    lower.includes('detail') ||
    lower.includes('case')
  ) {
    return 'detail';
  }
  return 'summary';
}
