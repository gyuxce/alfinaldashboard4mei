import React, { useMemo, useState } from "react";
import { useStore } from "../../store";
import { AgentKPI, getCsatBadRatingCount, matchesAgentScope, processKPIs } from "../../lib/dataProcessor";
import { ArrowRight, Trophy, Users, User } from "lucide-react";
import { formatNum } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { EmptyState } from '../ui/EmptyState';
import { MobileScrollHint } from '../ui/ChartScrollArea';
import { calculateAgentCompositeScore, calculateCompositeScore } from "../../lib/kpiScoring";

const DAILY_PRODUCTIVITY_TARGET = 100;
const QUIZ_TARGET = 92;

interface LeaderboardRow {
  csId?: string;
  name: string;
  tl?: string;
  agent_count?: number;
  score: number;
  qa: number | null;
  qa_pct: number | null;
  qa_points: number | null;
  prod: number | null;
  prod_pct: number | null;
  prod_daily_target: number;
  prod_total_duty: number;
  prod_target_chat: number;
  prod_total_chat: number;
  prod_points: number | null;
  prod_final_points: number | null;
  prod_difference: number | null;
  csat: number | null;
  csat_pct: number | null;
  csat_good: number;
  csat_bad: number;
  csat_points: number | null;
  training_total: number | null;
  training_completion: number | null;
  training_pct: number;
  training_points: number;
  quiz_target: number;
  quiz_score: number;
  quiz_pct: number;
  quiz_points: number;
}

const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const INACTIVE_AGENT_RULES = [
  {
    name: "edgar gasita adhigama",
    inactiveFrom: "2026-06",
  },
] as const;

const isAgentInactive = (agent: Pick<AgentKPI, "name">, periodEnd: string) => {
  const periodMonth = periodEnd.slice(0, 7);
  const agentName = normalizeAgentName(agent.name || "");
  return INACTIVE_AGENT_RULES.some(
    (rule) =>
      agentName === rule.name && periodMonth >= rule.inactiveFrom,
  );
};

const getProductivityColumns = (totalChat: number, totalDuty: number) => {
  const targetChat = totalDuty * DAILY_PRODUCTIVITY_TARGET;
  const achievement = targetChat > 0 ? (totalChat / targetChat) * 100 : null;
  const points = achievement !== null ? (achievement / 100) * 20 : null;
  const finalPoints = points !== null ? Math.min(points, 20) : null;

  return {
    achievement,
    targetChat,
    points,
    finalPoints,
    difference:
      points !== null && finalPoints !== null
        ? Math.round(points - finalPoints)
        : null,
  };
};

const getPeriodBusinessDays = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return null;
  }

  let businessDays = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) businessDays += 1;
  }

  return businessDays;
};

const getLeaderboardComposite = (agent: AgentKPI) => {
  const baseComposite = calculateAgentCompositeScore(agent);
  const csatGood = agent.csat4Count + agent.csat5Count;
  // Leaderboard bad ratings come from QC CSAT/DSAT tagging, not Official CSAT.
  const csatBad = getCsatBadRatingCount(agent);
  const csatTotal = csatGood + csatBad;
  const csatPct = csatTotal > 0 ? (csatGood / csatTotal) * 100 : null;

  return {
    composite: {
      ...baseComposite,
      csatOriginal: csatPct,
      csatPct,
      score: calculateCompositeScore({
        qaPct: baseComposite.qaPct,
        productivityPct: baseComposite.productivityPct,
        csatPct,
      }).score,
    },
    csatGood,
    csatBad,
    csatPct,
  };
};

interface AgentKpiRowProps {
  label: string;
  weight: string;
  value: number | null;
  maxValue: number;
  formatFn?: (v: number) => string;
  suffix?: string;
  isMaxCapped?: boolean;
}

const AgentKpiRow = ({
  label, weight, value, maxValue, formatFn, suffix, isMaxCapped
}: AgentKpiRowProps) => {
  const fmt = formatFn || ((v: number) => v.toFixed(1) + (suffix || '%'));
  const safeValue = value !== null ? value : 0;
  
  const percentage = Math.min((safeValue / maxValue) * 100, 100);

  let colorClass = "bg-danger";
  let textColorClass = "text-danger-text";
  if (value !== null) {
    if (value >= 95) { colorClass = "bg-success"; textColorClass = "text-success-text"; }
    else if (value >= 85) { colorClass = "bg-warning"; textColorClass = "text-warning-text"; }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">
            {label} ({weight})
          </span>
        </div>
        <div className={`text-sm font-semibold ${textColorClass}`}>
          {value !== null ? fmt(value) : '-'}
          {isMaxCapped && (
            <span className="text-success-text text-xs ml-1 font-bold">Max</span>
          )}
        </div>
      </div>
      
      <div className="relative h-2 bg-border rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-text-disabled';
  if (score >= 95) return 'text-success font-bold text-[11px]';
  return 'text-danger font-bold text-[11px]';
};

export const Leaderboard: React.FC = () => {
  const [toggleMode, setToggleMode] = useState<"tl" | "agent">("agent");
  const [selectedAgent, setSelectedAgent] = useState<LeaderboardRow | null>(null);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAgent(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const {
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
    agentDictionaryByMonth,
    startDate,
    endDate,
    selectedBpo,
    selectedTL,
    selectedGlobalAgent,
  } = useStore();
  const openTab = useStore((s) => s.openTab);

  const handleOpenFiles = () => {
    openTab("files");
  };

  const hasData =
    productivityData.length > 0 ||
    csatScData.length > 0 ||
    slaData.length > 0 ||
    scheduleData.length > 0 ||
    qaData.length > 0;

  const { agentRows, tlRows } = useMemo(() => {
    if (!hasData) return { agentRows: [], tlRows: [] };

    const rawData = processKPIs(
      productivityData,
      csatScData,
      slaData,
      scheduleData,
      qaData,
      startDate,
      endDate,
      agentDictionary,
      agentDictionaryByMonth,
    );

    const scopedRawData = rawData.filter((agent) =>
      !isAgentInactive(agent, endDate)
      && matchesAgentScope(agent, {
        bpo: selectedBpo,
        teamLeader: selectedTL,
        agent: selectedGlobalAgent,
      }),
    );

    // Prepare Agent List
    const aList: LeaderboardRow[] = [];

    // Prepare TL aggregations
    const tlMap: Record<
      string,
      {
        agents: Set<string>;
        qaScoreSum: number;
        qaScoreCount: number;
        csatGood: number;
        csatBad: number;
        totalDuty: number;
        totalChat: number;
      }
    > = {};

    scopedRawData.forEach((agent) => {
      const { composite, csatGood, csatBad, csatPct } =
        getLeaderboardComposite(agent);
      const productivity = getProductivityColumns(
        agent.productivityTotal,
        agent.manDays,
      );

      if (composite.score !== null) {
        aList.push({
          csId: agent.csId,
          name: agent.name || agent.csId,
          tl: agent.teamLeader || "-",
          score: composite.score,
          qa: composite.qaOriginal,
          qa_pct: composite.qaPct,
          qa_points:
            composite.qaPct !== null ? (composite.qaPct / 100) * 50 : null,
          prod: composite.productivityOriginal,
          prod_pct: composite.productivityPct,
          prod_daily_target: DAILY_PRODUCTIVITY_TARGET,
          prod_total_duty: agent.manDays,
          prod_target_chat: productivity.targetChat,
          prod_total_chat: agent.productivityTotal,
          prod_points: productivity.points,
          prod_final_points: productivity.finalPoints,
          prod_difference: productivity.difference,
          csat: composite.csatOriginal,
          csat_pct: composite.csatPct,
          csat_good: csatGood,
          csat_bad: csatBad,
          csat_points: csatPct !== null ? (csatPct / 100) * 20 : null,
          training_total: null,
          training_completion: null,
          training_pct: 100,
          training_points: 5,
          quiz_target: QUIZ_TARGET,
          quiz_score: 100,
          quiz_pct: 100,
          quiz_points: 5,
        });
      }

      // Aggregate for TL
      const tl = agent.teamLeader;
      if (tl && tl.trim() !== "") {
        if (!tlMap[tl]) {
          tlMap[tl] = {
            agents: new Set(),
            qaScoreSum: 0,
            qaScoreCount: 0,
            csatGood: 0,
            csatBad: 0,
            totalDuty: 0,
            totalChat: 0,
          };
        }
        tlMap[tl].agents.add(agent.csId);
        tlMap[tl].totalDuty += agent.manDays;
        tlMap[tl].totalChat += agent.productivityTotal;
        tlMap[tl].csatGood += csatGood;
        tlMap[tl].csatBad += csatBad;
        tlMap[tl].qaScoreSum += agent.qaScoreSum;
        tlMap[tl].qaScoreCount += agent.qaScoreCount;
      }
    });

    // Compute TL composite scores
    const tList: LeaderboardRow[] = [];
    const defaultTlDuty = getPeriodBusinessDays(startDate, endDate);
    Object.entries(tlMap).forEach(([tlName, stats]) => {
      const agentCount = stats.agents.size;
      const tl_qa_pct =
        stats.qaScoreCount > 0 ? (stats.qaScoreSum / stats.qaScoreCount) : null;
      const tlCsatTotal = stats.csatGood + stats.csatBad;
      const tl_csat_pct =
        tlCsatTotal > 0 ? (stats.csatGood / tlCsatTotal) * 100 : null;

      // Client TL data reports team productivity as the average per agent,
      // against the TL's period target rather than the team's summed target.
      const tlDuty = defaultTlDuty || (agentCount > 0 ? stats.totalDuty / agentCount : 0);
      const averageTotalChat = agentCount > 0 ? stats.totalChat / agentCount : 0;
      const productivity = getProductivityColumns(averageTotalChat, tlDuty);
      const tl_prod_pct = productivity.achievement;

      const tl_qa_orig = tl_qa_pct;
      const tl_prod_orig = tl_prod_pct;
      const tl_csat_orig = tl_csat_pct;

      const tlFinalScore =
        calculateCompositeScore({
          qaPct: tl_qa_pct,
          productivityPct: tl_prod_pct !== null ? Math.min(tl_prod_pct, 100) : null,
          csatPct: tl_csat_pct,
        }).score;

      if (tlFinalScore !== null) {
        tList.push({
          name: tlName,
          agent_count: agentCount,
          score: tlFinalScore,
          qa: tl_qa_orig,
          qa_pct: tl_qa_pct,
          qa_points: tl_qa_pct !== null ? (tl_qa_pct / 100) * 50 : null,
          prod: tl_prod_orig,
          prod_pct: tl_prod_pct,
          prod_daily_target: DAILY_PRODUCTIVITY_TARGET,
          prod_total_duty: tlDuty,
          prod_target_chat: productivity.targetChat,
          prod_total_chat: averageTotalChat,
          prod_points: productivity.points,
          prod_final_points: productivity.finalPoints,
          prod_difference: productivity.difference,
          csat: tl_csat_orig,
          csat_pct: tl_csat_pct,
          csat_good: stats.csatGood,
          csat_bad: stats.csatBad,
          csat_points:
            tl_csat_pct !== null ? (tl_csat_pct / 100) * 20 : null,
          training_total: null,
          training_completion: null,
          training_pct: 100,
          training_points: 5,
          quiz_target: QUIZ_TARGET,
          quiz_score: 100,
          quiz_pct: 100,
          quiz_points: 5,
        });
      }
    });

    aList.sort((a, b) => b.score - a.score);
    tList.sort((a, b) => b.score - a.score);

    return { agentRows: aList, tlRows: tList };
  }, [
    hasData,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
    agentDictionaryByMonth,
    startDate,
    endDate,
    selectedBpo,
    selectedTL,
    selectedGlobalAgent,
  ]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full mt-10">
        <Trophy className="w-16 h-16 text-text-muted mb-4 stroke-1" />
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Belum Ada Data
        </h2>
        <p className="text-sm text-text-secondary mb-6 max-w-sm text-center">
          Buka File Center, pilih bulan data, lalu klik Sync sekarang untuk melihat ranking Leaderboard.
        </p>
        <button
          onClick={handleOpenFiles}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-text font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-sm"
        >
          Buka File Center <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const activeData = toggleMode === "tl" ? tlRows : agentRows;

  const bottomThreeIds = activeData.slice(-3).map(a => a.csId || a.name);
  const isBottomThree = (id: string) => toggleMode === "agent" && bottomThreeIds.includes(id);

  const selectedRank = selectedAgent ? activeData.findIndex((a) => (a.csId || a.name) === (selectedAgent.csId || selectedAgent.name)) + 1 : 0;
  const isSelectedBottomThree = selectedAgent ? isBottomThree(selectedAgent.csId || selectedAgent.name) : false;

  let safeScore = activeData.length > 3 ? activeData[activeData.length - 3].score : 0;
  let scoreGap = 0;
  let targetDesc = "";
  let isRank1 = false;
  
  if (selectedAgent) {
    if (isSelectedBottomThree) {
      scoreGap = safeScore - selectedAgent.score + 0.1;
      targetDesc = "TARGET KELUAR BOTTOM 3:";
    } else if (selectedRank > 1) {
      const nextRankAgent = activeData[selectedRank - 2];
      safeScore = nextRankAgent.score;
      scoreGap = safeScore - selectedAgent.score + 0.1;
      targetDesc = `TARGET NAIK KE RANK #${selectedRank - 1}:`;
    } else {
      isRank1 = true;
    }
  }

  return (
    <div className="flex flex-col gap-6 p-2">
      <div>
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Leaderboard
        </h2>
        <p className="text-[13px] text-text-secondary mt-1">
          Bobot skor: QA 50% · Prod 20% · CSAT 20% · Training 5% · Quiz 5% · periode & filter global aktif
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] not-italic">
            <span className="rounded-full border border-border bg-surface px-2 py-1 font-semibold text-text-secondary">
              Periode: {startDate || "-"} s/d {endDate || "-"}
            </span>
            {(selectedBpo !== "All BPO" || selectedTL !== "All TL" || selectedGlobalAgent !== "All Agents") && (
              <span className="font-medium tracking-wide text-text-muted">Filter aktif:</span>
            )}
            {selectedBpo !== "All BPO" && (
              <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-1 font-semibold text-primary">BPO: {selectedBpo}</span>
            )}
            {selectedTL !== "All TL" && selectedTL !== "All Team Leaders" && (
              <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-1 font-semibold text-primary">TL: {selectedTL}</span>
            )}
            {selectedGlobalAgent !== "All Agents" && (
              <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-1 font-semibold text-primary">Agent: {selectedGlobalAgent}</span>
            )}
        </div>
      </div>

      <div className="inline-flex bg-surface-muted p-1 rounded-lg w-max gap-1">
        <button
          onClick={() => {
            setToggleMode("agent");
            setSelectedAgent(null);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "agent"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <User className="w-4 h-4" /> Agent
        </button>
        <button
          onClick={() => {
            setToggleMode("tl");
            setSelectedAgent(null);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "tl"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <Users className="w-4 h-4" /> Team Leader
        </button>
      </div>

      <div className="flex flex-col gap-4">
      <MobileScrollHint label="Geser → untuk lihat semua kolom" />
      <div className="isolate relative w-full overflow-auto bg-card border border-border-strong rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-1 max-h-[calc(100vh-280px)]">
      {toggleMode === "agent" ? (
        <table className="kpi-data-table w-full min-w-[2644px] table-fixed border-collapse whitespace-nowrap text-left">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[190px]" />
            <col className="w-[130px]" />
            <col className="w-[160px]" />
            {Array.from({ length: 21 }).map((_, index) => (
              <col key={`metric-column-${index}`} className="w-[96px]" />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-40 text-white">
            <tr className="bg-primary">
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 text-center font-bold md:sticky md:left-0 z-50 bg-primary">#</th>
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 font-bold md:sticky md:left-[52px] z-50 bg-primary">Nama</th>
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 font-bold md:sticky md:left-[242px] z-50 bg-primary">Email / CS ID</th>
              <th rowSpan={2} className="overflow-hidden border-r-2 border-white/60 p-2 font-bold md:sticky md:left-[372px] z-50 bg-primary shadow-[8px_0_12px_-8px_rgba(0,0,0,0.45)]">Nama leader</th>
              <th colSpan={2} className="border-r-2 border-white/60 p-2 text-center font-bold">QC Score (50 poin)</th>
              <th colSpan={7} className="border-r-2 border-white/60 p-2 text-center font-bold">Productivity (20 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">CSAT Score (20 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Training (5 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Quiz (5 poin)</th>
              <th rowSpan={2} className="border-l-2 border-white/60 p-2 text-center font-bold">Skor akhir</th>
            </tr>
            <tr className="bg-primary border-t border-white/30">
              {[
                "% Ach", "Total Points",
                "Daily Target", "Total Duty", "Target Chat", "Total Chat", "Total Points", "Final Points", "Difference",
                "Total Good Rating", "Total Bad Rating", "Total CSAT", "Total Points",
                "Total Training", "Agent Completion", "% Ach", "Total Points",
                "Target", "Agent Score", "% Ach", "Total Points",
              ].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className={cn(
                    "overflow-hidden border-r border-white/40 px-2 py-1.5 text-center font-bold",
                    [0, 2, 9, 13, 17].includes(index) && "border-l-2 border-l-white/60",
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeData.map((item, idx) => {
              const rank = idx + 1;
              const isBottom = isBottomThree(item.csId || item.name);
              const stickyClass = isBottom
                ? "bg-danger-soft group-hover:bg-danger-soft"
                : "bg-card group-hover:bg-surface-muted";
              const metricCell = "overflow-hidden border-r border-border-strong/70 px-2 py-2 text-center font-semibold text-text-secondary";
              const metricGroupStart = `${metricCell} border-l-2 border-l-border-strong`;

              return (
                <tr
                  key={item.csId || item.name}
                  className={cn(
                    "group border-b border-border-strong/70 transition-colors",
                    isBottom ? "bg-danger-soft/30 hover:bg-danger-soft/50" : "hover:bg-surface-muted",
                  )}
                >
                  <td className={`overflow-hidden border-r border-border-strong px-2 py-2 text-center font-bold text-text-muted md:sticky md:left-0 z-30 ${stickyClass}`}>#{rank}</td>
                  <td className={`overflow-hidden border-r border-border-strong px-2 py-2 md:sticky md:left-[52px] z-30 ${stickyClass}`}>
                    <button onClick={() => setSelectedAgent(item)} className="block max-w-full truncate text-left font-bold text-kpi-neutral-text hover:underline" title={item.name}>
                      {item.name}
                    </button>
                  </td>
                  <td className={`overflow-hidden truncate border-r border-border-strong px-2 py-2 font-medium text-text-secondary md:sticky md:left-[242px] z-30 ${stickyClass}`} title={item.csId || "-"}>
                    {item.csId || "-"}
                  </td>
                  <td className={`overflow-hidden truncate border-r-2 border-border-strong px-2 py-2 font-medium text-text-secondary md:sticky md:left-[372px] z-30 shadow-[8px_0_12px_-8px_rgba(0,0,0,0.35)] ${stickyClass}`} title={item.tl || "-"}>
                    {item.tl || "-"}
                  </td>

                  <td className={metricGroupStart}>{item.qa_pct !== null ? `${formatNum(item.qa_pct, 2)}%` : "-"}</td>
                  <td className={metricCell}>{item.qa_points !== null ? formatNum(item.qa_points, 2) : "-"}</td>

                  <td className={metricGroupStart}>{item.prod_daily_target}</td>
                  <td className={metricCell}>{formatNum(item.prod_total_duty, 0)}</td>
                  <td className={metricCell}>{formatNum(item.prod_target_chat, 0)}</td>
                  <td className={metricCell}>{formatNum(item.prod_total_chat, 0)}</td>
                  <td className={metricCell}>{item.prod_points !== null ? formatNum(item.prod_points, 2) : "-"}</td>
                  <td className={metricCell}>{item.prod_final_points !== null ? formatNum(item.prod_final_points, 2) : "-"}</td>
                  <td className={`${metricCell} font-bold ${item.prod_difference !== null && item.prod_difference > 0 ? "text-success-text" : ""}`}>
                    {item.prod_difference !== null ? item.prod_difference : "-"}
                  </td>

                  <td className={metricGroupStart}>{formatNum(item.csat_good, 0)}</td>
                  <td className={metricCell}>{formatNum(item.csat_bad, 0)}</td>
                  <td className={metricCell}>{item.csat_pct !== null ? `${formatNum(item.csat_pct, 2)}%` : "-"}</td>
                  <td className={metricCell}>{item.csat_points !== null ? formatNum(item.csat_points, 2) : "-"}</td>

                  <td className={metricGroupStart}>{item.training_total ?? "-"}</td>
                  <td className={metricCell}>{item.training_completion ?? "-"}</td>
                  <td className={metricCell}>{formatNum(item.training_pct, 2)}%</td>
                  <td className={metricCell}>{formatNum(item.training_points, 2)}</td>

                  <td className={metricGroupStart}>{item.quiz_target}%</td>
                  <td className={metricCell}>{formatNum(item.quiz_score, 2)}%</td>
                  <td className={metricCell}>{formatNum(item.quiz_pct, 2)}%</td>
                  <td className={metricCell}>{formatNum(item.quiz_points, 2)}</td>

                  <td className="border-l-2 border-border-strong px-2 py-2 text-center">
                    <span className={`text-[11px] ${getScoreColor(item.score)}`}>{formatNum(item.score, 2)}</span>
                  </td>
                </tr>
              );
            })}

            {activeData.length === 0 && (
              <tr>
                <td colSpan={26} className="p-4">
                  <EmptyState
                    title="Tidak ada data leaderboard"
                    description="Pastikan periode aktif memiliki data agent."
                    variant="filter"
                    className="border-0 bg-transparent py-6"
                    showDataActions
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <table className="kpi-data-table w-full min-w-[2580px] table-fixed border-collapse whitespace-nowrap text-left">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[220px]" />
            <col className="w-[80px]" />
            {Array.from({ length: 22 }).map((_, index) => (
              <col key={`tl-metric-column-${index}`} className="w-[105px]" />
            ))}
            <col className="w-[105px]" />
          </colgroup>
          <thead className="sticky top-0 z-40 text-white">
            <tr className="bg-primary">
              <th rowSpan={2} className="border-r border-white/40 p-2 text-center font-bold">#</th>
              <th rowSpan={2} className="border-r border-white/40 p-2 text-left font-bold">Team Leader</th>
              <th rowSpan={2} className="border-r border-white/40 p-2 text-center font-bold">Agent</th>
              <th colSpan={2} className="border-r-2 border-white/60 p-2 text-center font-bold">QC Score (50 poin)</th>
              <th colSpan={7} className="border-r-2 border-white/60 p-2 text-center font-bold">Productivity (20 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">CSAT Score (20 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Training (5 poin)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Quiz (5 poin)</th>
              <th rowSpan={2} className="border-l-2 border-white/60 p-2 text-center font-bold">Skor akhir</th>
            </tr>
            <tr className="border-t border-white/30 bg-primary">
              {[
                "% Ach", "Total Points",
                "Daily Target", "Total Duty", "Target Chat", "Total Chat", "Total Points", "Final Points", "Difference",
                "Total Good Rating", "Total Bad Rating", "Total CSAT", "Total Points",
                "Total Training", "Agent Completion", "% Ach", "Total Points",
                "Target", "Agent Score", "% Ach", "Total Points",
              ].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className={cn(
                    "overflow-hidden border-r border-white/40 px-2 py-1.5 text-center font-bold",
                    [0, 2, 9, 13, 17].includes(index) && "border-l-2 border-l-white/60",
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tlRows.map((item, idx) => (
              <tr key={item.name} className="border-b border-border-strong/70 hover:bg-surface-muted">
                <td className="border-r border-border-strong px-2 py-2 text-center font-bold text-text-muted">#{idx + 1}</td>
                <td className="border-r border-border-strong px-2 py-2 font-bold text-text-primary">{item.name}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center text-text-secondary">{item.agent_count ?? "-"}</td>

                <td className="border-l-2 border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.qa_pct !== null ? `${formatNum(item.qa_pct, 2)}%` : "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.qa_points !== null ? formatNum(item.qa_points, 2) : "-"}</td>

                <td className="border-l-2 border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.prod_daily_target}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.prod_total_duty, 0)}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.prod_target_chat, 0)}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.prod_total_chat, 0)}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.prod_points !== null ? formatNum(item.prod_points, 2) : "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.prod_final_points !== null ? formatNum(item.prod_final_points, 2) : "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.prod_difference !== null ? item.prod_difference : "-"}</td>

                <td className="border-l-2 border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.csat_good, 0)}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.csat_bad, 0)}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.csat_pct !== null ? `${formatNum(item.csat_pct, 2)}%` : "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.csat_points !== null ? formatNum(item.csat_points, 2) : "-"}</td>

                <td className="border-l-2 border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.training_total ?? "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.training_completion ?? "-"}</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-success-text">{formatNum(item.training_pct, 2)}%</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.training_points, 2)}</td>

                <td className="border-l-2 border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{item.quiz_target}%</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.quiz_score, 2)}%</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-success-text">{formatNum(item.quiz_pct, 2)}%</td>
                <td className="border-r border-border-strong px-2 py-2 text-center font-semibold text-text-secondary">{formatNum(item.quiz_points, 2)}</td>

                <td className="border-l-2 border-border-strong px-2 py-2 text-center">
                  <span className={`text-[12px] ${getScoreColor(item.score)}`}>{formatNum(item.score, 2)}</span>
                </td>
              </tr>
            ))}
            {tlRows.length === 0 && (
              <tr>
                <td colSpan={25} className="p-4">
                  <EmptyState
                    title="Tidak ada data Team Leader"
                    description="Pastikan data agent memiliki nama Team Leader pada periode aktif."
                    variant="filter"
                    className="border-0 bg-transparent py-6"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      </div>

      </div>

      {selectedAgent && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity"
          onClick={() => setSelectedAgent(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  Analisis KPI
                </h2>
                <p className="text-text-secondary text-xs mt-0.5">
                  {selectedAgent.name} {selectedAgent.csId && `- ${selectedAgent.csId}`}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-text-muted bg-surface-muted px-2 py-0.5 rounded-full border border-border">
                    Rank #{selectedRank}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedAgent.score >= 95 ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text'}`}>
                    Score {selectedAgent.score.toFixed(1)}
                  </span>
                  {isSelectedBottomThree && (
                    <span className="text-[10px] bg-danger-soft text-danger-text px-2 py-0.5 rounded-full font-semibold border border-danger-soft">
                      Bottom 3
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedAgent(null)}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-muted"
                aria-label="Tutup"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: KPI BREAKDOWN */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-text-secondary tracking-wide mb-2">
                    SKOR KPI KAMU
                  </h3>

              <AgentKpiRow
                label="QA Score"
                weight="50%"
                value={selectedAgent.qa_pct}
                maxValue={100}
                isMaxCapped={false}
              />

              <AgentKpiRow
                label="Produktivitas"
                weight="20%"
                value={selectedAgent.prod !== null ? Math.min(selectedAgent.prod, 100) : null}
                maxValue={100}
                isMaxCapped={selectedAgent.prod !== null && selectedAgent.prod >= 100}
              />

              <AgentKpiRow
                label="CSAT Rating"
                weight="20%"
                value={selectedAgent.csat_pct}
                maxValue={100}
                isMaxCapped={false}
                formatFn={(v) => v.toFixed(2)}
                suffix="%"
              />

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Training (5%)
                  </span>
                  <div className="text-sm font-semibold text-success-text">
                    100%
                  </div>
                </div>
                <div className="relative w-full bg-border-strong rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="absolute top-0 h-full rounded-full transition-all bg-success"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic">
                  Auto 100% - pastikan selesaikan modul training tepat waktu
                </p>
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Quiz (5%)
                  </span>
                  <div className="text-sm font-semibold text-success-text">
                    100%
                  </div>
                </div>
                <div className="relative w-full bg-border-strong rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="absolute top-0 h-full rounded-full transition-all bg-success"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic">
                  Auto 100% - pastikan kerjakan kuis sebelum deadline
                </p>
              </div>
            </div>
            </div>
            
            {/* RIGHT COLUMN: REKOMENDASI */}
            <div className="space-y-4 md:border-l md:border-border md:pl-6 md:pt-0 pt-6 border-t border-border md:border-t-0">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-secondary tracking-wide mb-2">
                  Prioritas Peningkatan
                </h3>

              {isRank1 ? (
                <div className="p-3 bg-primary-soft/20 border border-primary-soft/50 rounded-lg text-center">
                  <span className="text-2xl block mb-2">🏆</span>
                  <p className="text-sm font-bold text-primary">Kamu sudah #1!</p>
                  <p className="text-xs text-text-secondary mt-1">Pertahankan performa luar biasa ini.</p>
                </div>
              ) : (() => {
                const qaNeeded = scoreGap / 0.5;
                const prodNeeded = scoreGap / 0.2;
                const csatNeeded = scoreGap / 0.2;

                const currQa = selectedAgent.qa_pct || 0;
                const currProd = selectedAgent.prod || 0;
                const currCsat = selectedAgent.csat_pct || 0;

                const canQa = (currQa + qaNeeded) <= 100;
                const canProd = currProd < 100 && (currProd + prodNeeded) <= 100;
                const canCsat = (currCsat + csatNeeded) <= 100;

                const isAllCapped = currQa >= 100 && currProd >= 100 && currCsat >= 100;

                if (isAllCapped) {
                  return (
                    <div className="p-3 bg-success-soft/20 border border-success-soft/50 rounded-lg text-center mt-2">
                      <p className="text-sm font-bold text-success-text">Semua KPI sudah maksimal (100%).</p>
                      <p className="text-xs text-text-secondary mt-1">Pertahankan! Tidak ada yang perlu ditingkatkan lagi.</p>
                    </div>
                  );
                }

                const options = [
                  { type: 'qa', needed: qaNeeded, can: canQa, current: currQa },
                  { type: 'prod', needed: prodNeeded, can: canProd, current: currProd },
                  { type: 'csat', needed: csatNeeded, can: canCsat, current: currCsat }
                ].filter(opt => opt.can).sort((a, b) => a.needed - b.needed);

                const easiest = options.length > 0 ? options[0].type : "none";

                return (
                  <>
                    <div className="mb-3 px-2">
                      <p className="text-xs font-bold text-text-primary">{targetDesc}</p>
                      {scoreGap < 0.2 ? (
                        <p className="text-xs text-text-secondary mt-0.5">Hampir! Sedikit lagi naik rank.</p>
                      ) : (
                        <p className="text-xs text-text-secondary mt-0.5">Butuh score &gt;= {safeScore.toFixed(1)} | Gap: {scoreGap.toFixed(1)} poin</p>
                      )}
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'qa' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canQa ? (easiest === 'qa' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">QA Score</span>
                          {easiest === 'qa' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {canQa ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{qaNeeded.toFixed(1)}%</span> dari {currQa.toFixed(1)}% ke {(currQa + qaNeeded).toFixed(1)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh naik +{qaNeeded.toFixed(1)}% (melebihi 100%, sangat sulit)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'prod' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canProd ? (easiest === 'prod' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">Produktivitas</span>
                          {easiest === 'prod' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {currProd >= 100 ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Sudah maksimal (100%, di-cap)
                          </div>
                        ) : canProd ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{prodNeeded.toFixed(1)}%</span> dari {currProd.toFixed(1)}% ke {(currProd + prodNeeded).toFixed(1)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh effort besar / akan terkena cap 100%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'csat' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canCsat ? (easiest === 'csat' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">CSAT Rating</span>
                          {easiest === 'csat' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {canCsat ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{csatNeeded.toFixed(2)}%</span> dari {currCsat.toFixed(2)}% ke {(currCsat + csatNeeded).toFixed(2)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh naik +{csatNeeded.toFixed(2)}% (melebihi 100%, sangat sulit)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 bg-primary-soft/20 rounded-lg border border-primary-soft/50">
                      <p className="text-[11px] font-semibold text-primary">
                        Cara paling mudah:
                      </p>
                      {easiest === 'none' ? (
                        <p className="text-[11px] font-medium text-primary mt-1">
                          Sulit untuk mencapai target ini dengan satu KPI saja. Coba tingkatkan semua KPI secara bertahap.
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-primary mt-1 flex items-center gap-1">
                          Naikkan {easiest === 'qa' ? 'QA' : easiest === 'prod' ? 'Prod' : 'CSAT'} <span className="font-bold">+{easiest === 'qa' ? qaNeeded.toFixed(1) : easiest === 'prod' ? prodNeeded.toFixed(1) : csatNeeded.toFixed(2)}%</span> saja sudah cukup!
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
