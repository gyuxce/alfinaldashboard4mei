import React from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { AgentKPI } from '../../lib/dataProcessor';
import { cn } from '../../lib/utils';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type KpiAiBotProps = {
  data: AgentKPI[];
  activeTab: string;
  filters: {
    bpo: string;
    teamLeader: string;
    agent: string;
    startDate: string;
    endDate: string;
    comparison: string;
  };
};

const starterQuestions = [
  'Ringkas performa filter saat ini',
  'Agent mana yang perlu diprioritaskan coaching?',
  'Apa penyebab risiko CSAT/QA terbesar?',
];

export function KpiAiBot({ data, activeTab, filters }: KpiAiBotProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Halo, saya KPI AI Bot. Saya bisa bantu baca performa dari data yang sedang terfilter di dashboard.',
    },
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages, isLoading]);

  const context = React.useMemo(() => buildKpiContext(data, activeTab, filters), [activeTab, data, filters]);

  const sendMessage = async (override?: string) => {
    const message = (override || input).trim();
    if (!message || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }];
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
          context,
          history: nextMessages.slice(-8),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'AI bot gagal merespons.');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: payload.answer || 'Tidak ada jawaban.' }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi error pada AI bot.';
      setError(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-4 right-4 z-[90] flex h-12 items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/30',
          isOpen && 'hidden',
        )}
      >
        <Bot className="h-5 w-5" />
        KPI AI
      </button>

      {isOpen && (
        <div className="fixed bottom-3 right-3 z-[90] flex h-[78vh] max-h-[620px] w-[calc(100vw-24px)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface-muted p-3">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-text-primary">KPI AI Bot</h3>
                <p className="truncate text-[11px] text-text-muted">
                  {context.scope.agent || context.scope.teamLeader || context.scope.bpo || 'Data filter aktif'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
              aria-label="Close KPI AI Bot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-card p-3">
            <div className="rounded-xl border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-text-muted">
              Bot membaca <span className="font-bold text-text-primary">{context.summary.agentCount}</span> agent dari filter saat ini. Jawaban dibatasi dari data dashboard, bukan raw sheet.
            </div>

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  'max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'ml-auto bg-primary text-white'
                    : 'mr-auto border border-border bg-surface text-text-primary',
                )}
              >
                {message.content}
              </div>
            ))}

            {isLoading && (
              <div className="mr-auto flex max-w-[88%] items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Membaca KPI...
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="grid shrink-0 grid-cols-1 gap-1.5 border-t border-border bg-surface/40 p-3">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-left text-[11px] font-semibold text-text-secondary transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  {question}
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
              placeholder="Tanya performa agent/team..."
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors disabled:cursor-not-allowed disabled:bg-text-disabled"
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

function buildKpiContext(data: AgentKPI[], activeTab: string, filters: KpiAiBotProps['filters']) {
  const agents = data.map(toAgentSnapshot);
  const riskAgents = [...agents]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);
  const topProductivity = [...agents]
    .sort((a, b) => b.productivityTotal - a.productivityTotal)
    .slice(0, 5);
  const lowQa = agents
    .filter(agent => agent.qaScore !== null)
    .sort((a, b) => (a.qaScore || 0) - (b.qaScore || 0))
    .slice(0, 5);

  return {
    activeTab,
    scope: filters,
    summary: {
      agentCount: agents.length,
      avgProductivity: average(agents.map(agent => agent.productivityAverage)),
      avgCsatOfficial: average(agents.map(agent => agent.csatOfficial).filter(isNumber)),
      avgCsatTakeout: average(agents.map(agent => agent.csatTakeout).filter(isNumber)),
      avgQaScore: average(agents.map(agent => agent.qaScore).filter(isNumber)),
      avgSla1m: average(agents.map(agent => agent.sla1m).filter(isNumber)),
      avgWhu: average(agents.map(agent => agent.whu).filter(isNumber)),
      totalBadCsat: agents.reduce((sum, agent) => sum + agent.badCsatCount, 0),
      totalQaDefects: agents.reduce((sum, agent) => sum + agent.qaDefectCount, 0),
    },
    priorityAgents: riskAgents,
    topProductivity,
    lowQa,
  };
}

function toAgentSnapshot(agent: AgentKPI) {
  const qaScore = agent.qaScoreCount > 0 ? agent.qaScoreSum / agent.qaScoreCount : null;
  const qaDefects = agent.qaHistory || [];
  const highQaDefects = qaDefects.filter(entry =>
    ['high', 'very high'].includes(String(entry.mistakeLevel || '').toLowerCase()),
  );
  const topCsatCategories = Object.entries(agent.csatScCategoriesFull || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
  const topQaCategories = countBy(qaDefects.map(entry => entry.category || 'Uncategorized')).slice(0, 3);

  const riskScore =
    (agent.csatScBadScoreFullCount || 0) * 3 +
    highQaDefects.length * 4 +
    Math.max(0, 85 - (qaScore || 100)) +
    Math.max(0, 80 - (agent.sla1m || 100)) / 2;

  return {
    csId: agent.csId,
    name: agent.name || agent.csId,
    bpo: agent.bpo || '-',
    teamLeader: agent.teamLeader || '-',
    productivityTotal: round(agent.productivityTotal),
    productivityAverage: round(agent.productivityAverage),
    manDays: agent.manDays,
    csatOfficial: nullableRound(agent.csatAsli),
    csatTakeout: nullableRound(agent.csatScFair),
    csatFull: nullableRound(agent.csatScFull),
    badCsatCount: agent.csatScBadScoreFullCount || 0,
    qaScore: nullableRound(qaScore),
    qaDefectCount: qaDefects.length,
    highQaDefectCount: highQaDefects.length,
    sla1m: nullableRound(agent.sla1m),
    sla3m: nullableRound(agent.sla3m),
    whu: nullableRound(agent.whu),
    attendanceScore: round(agent.attendanceScore || 0),
    topCsatCategories,
    topQaCategories,
    riskScore: round(riskScore),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function average(values: number[]) {
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
