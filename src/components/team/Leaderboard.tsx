import React, { useMemo, useState } from "react";
import { useStore } from "../../store";
import { AgentKPI, processKPIs } from "../../lib/dataProcessor";
import { Trophy, Users, User, ArrowRight, ClipboardList } from "lucide-react";
import { formatNum } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { EmptyState } from '../ui/EmptyState';
import { calculateAgentCompositeScore, calculateCompositeScore } from "../../lib/kpiScoring";

const DAILY_PRODUCTIVITY_TARGET = 100;
const QUIZ_TARGET = 92;

interface LeaderboardRow {
  csId?: string;
  name: string;
  tl?: string;
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

type DevelopmentStage = "development" | "sp1" | "sp2" | "termination";

interface DevelopmentRow {
  csId: string;
  name: string;
  tl: string;
  stage: DevelopmentStage;
  cleanStreak: number;
  bottomCount: number;
  lastBottomMonth: string;
  currentRank: number | null;
}

const DEVELOPMENT_STAGE_META: Record<
  DevelopmentStage,
  { label: string; next: string; className: string }
> = {
  development: {
    label: "Development Plan",
    next: "SP 1",
    className: "bg-warning-soft text-warning",
  },
  sp1: {
    label: "SP 1",
    next: "SP 2",
    className: "bg-orange-100 text-orange-700",
  },
  sp2: {
    label: "SP 2",
    next: "Termination",
    className: "bg-danger-soft text-danger",
  },
  termination: {
    label: "Termination",
    next: "Final",
    className: "bg-danger text-white",
  },
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

const getLeaderboardComposite = (agent: AgentKPI) => {
  const baseComposite = calculateAgentCompositeScore(agent);
  const csatGood = agent.csat4Count + agent.csat5Count;
  const csatBad = agent.qaHistory.filter((entry) => {
    const checkingType = String(entry.systemCheckingType || "")
      .trim()
      .toUpperCase();
    const mistakeLevel = String(entry.mistakeLevel || "")
      .trim()
      .toUpperCase();
    return (
      checkingType === "CSAT" &&
      mistakeLevel !== "" &&
      !mistakeLevel.includes("NO MISTAKE")
    );
  }).length;
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
    startDate,
    endDate,
  } = useStore();

  const handleOpenFiles = () => {
    const navButtons = document.querySelectorAll("nav button");
    const fileBtn = Array.from(navButtons).find((el) =>
      el.textContent?.includes("File Center"),
    );
    if (fileBtn) {
      (fileBtn as HTMLButtonElement).click();
    }
  };

  const hasData =
    productivityData.length > 0 ||
    csatScData.length > 0 ||
    slaData.length > 0 ||
    scheduleData.length > 0 ||
    qaData.length > 0;

  const { agentRows, tlRows, developmentRows } = useMemo(() => {
    if (!hasData) return { agentRows: [], tlRows: [], developmentRows: [] };

    const rawData = processKPIs(
      productivityData,
      csatScData,
      slaData,
      scheduleData,
      qaData,
      startDate,
      endDate,
      agentDictionary,
    );

    // Prepare Agent List
    const aList: LeaderboardRow[] = [];

    // Prepare TL aggregations
    const tlMap: Record<
      string,
      {
        agents: Set<string>;
        qaPctSum: number;
        qaPctCount: number;
        prodPctSum: number;
        prodPctCount: number;
        csatPctSum: number;
        csatPctCount: number;
        qaOrigSum: number;
        qaOrigCount: number;
        prodOrigSum: number;
        prodOrigCount: number;
        csatOrigSum: number;
        csatOrigCount: number;
        csatGood: number;
        csatBad: number;
        finalScoreSum: number;
        finalScoreCount: number;
        totalDuty: number;
        totalChat: number;
      }
    > = {};

    rawData.forEach((agent) => {
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
            qaPctSum: 0,
            qaPctCount: 0,
            prodPctSum: 0,
            prodPctCount: 0,
            csatPctSum: 0,
            csatPctCount: 0,
            qaOrigSum: 0,
            qaOrigCount: 0,
            prodOrigSum: 0,
            prodOrigCount: 0,
            csatOrigSum: 0,
            csatOrigCount: 0,
            csatGood: 0,
            csatBad: 0,
            finalScoreSum: 0,
            finalScoreCount: 0,
            totalDuty: 0,
            totalChat: 0,
          };
        }
        tlMap[tl].agents.add(agent.csId);
        tlMap[tl].totalDuty += agent.manDays;
        tlMap[tl].totalChat += agent.productivityTotal;
        tlMap[tl].csatGood += csatGood;
        tlMap[tl].csatBad += csatBad;
        if (composite.score !== null) {
          tlMap[tl].finalScoreSum += composite.score;
          tlMap[tl].finalScoreCount += 1;
        }

        if (composite.qaPct !== null) {
          tlMap[tl].qaPctSum += composite.qaPct;
          tlMap[tl].qaPctCount++;
          tlMap[tl].qaOrigSum += composite.qaOriginal!;
          tlMap[tl].qaOrigCount++;
        }
        if (composite.productivityPct !== null) {
          tlMap[tl].prodPctSum += composite.productivityPct;
          tlMap[tl].prodPctCount++;
          tlMap[tl].prodOrigSum += composite.productivityOriginal!;
          tlMap[tl].prodOrigCount++;
        }
        if (composite.csatPct !== null) {
          tlMap[tl].csatPctSum += composite.csatPct;
          tlMap[tl].csatPctCount++;
          tlMap[tl].csatOrigSum += composite.csatOriginal!;
          tlMap[tl].csatOrigCount++;
        }
      }
    });

    // Compute TL composite scores
    const tList: LeaderboardRow[] = [];
    Object.entries(tlMap).forEach(([tlName, stats]) => {
      const tl_qa_pct =
        stats.qaPctCount > 0 ? stats.qaPctSum / stats.qaPctCount : null;
      const tl_prod_pct =
        stats.prodPctCount > 0 ? stats.prodPctSum / stats.prodPctCount : null;
      const tlCsatTotal = stats.csatGood + stats.csatBad;
      const tl_csat_pct =
        tlCsatTotal > 0 ? (stats.csatGood / tlCsatTotal) * 100 : null;

      const tl_qa_orig =
        stats.qaOrigCount > 0 ? stats.qaOrigSum / stats.qaOrigCount : null;
      const tl_prod_orig =
        stats.prodOrigCount > 0
          ? stats.prodOrigSum / stats.prodOrigCount
          : null;
      const tl_csat_orig = tl_csat_pct;
      const productivity = getProductivityColumns(
        stats.totalChat,
        stats.totalDuty,
      );

      const tlFinalScore =
        stats.finalScoreCount > 0
          ? stats.finalScoreSum / stats.finalScoreCount
          : null;

      if (tlFinalScore !== null) {
        tList.push({
          name: tlName,
          score: tlFinalScore,
          qa: tl_qa_orig,
          qa_pct: tl_qa_pct,
          qa_points: tl_qa_pct !== null ? (tl_qa_pct / 100) * 50 : null,
          prod: tl_prod_orig,
          prod_pct: tl_prod_pct,
          prod_daily_target: DAILY_PRODUCTIVITY_TARGET,
          prod_total_duty: stats.totalDuty,
          prod_target_chat: productivity.targetChat,
          prod_total_chat: stats.totalChat,
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

    const monthRanges: { start: string; end: string; label: string }[] = [];
    const activeEnd = new Date(`${endDate}T12:00:00`);
    if (!Number.isNaN(activeEnd.getTime())) {
      let year = 2026;
      let monthIndex = 4;
      while (
        year < activeEnd.getFullYear() ||
        (year === activeEnd.getFullYear() && monthIndex <= activeEnd.getMonth())
      ) {
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const monthNumber = String(monthIndex + 1).padStart(2, "0");
        monthRanges.push({
          start: `${year}-${monthNumber}-01`,
          end: `${year}-${monthNumber}-${String(lastDay).padStart(2, "0")}`,
          label: new Intl.DateTimeFormat("id-ID", {
            month: "short",
            year: "numeric",
          }).format(new Date(year, monthIndex, 1)),
        });
        monthIndex += 1;
        if (monthIndex > 11) {
          monthIndex = 0;
          year += 1;
        }
      }
    }

    const developmentMap = new Map<string, DevelopmentRow>();

    monthRanges.forEach((monthRange) => {
      const monthlyAgents = processKPIs(
        productivityData,
        csatScData,
        slaData,
        scheduleData,
        qaData,
        monthRange.start,
        monthRange.end,
        agentDictionary,
      )
        .map((agent) => ({
          agent,
          score: getLeaderboardComposite(agent).composite.score,
        }))
        .filter(
          (entry): entry is { agent: AgentKPI; score: number } =>
            entry.score !== null,
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            (a.agent.name || a.agent.csId).localeCompare(
              b.agent.name || b.agent.csId,
            ),
        );

      const eligibleIds = new Set(monthlyAgents.map((entry) => entry.agent.csId));
      const bottomRanks = new Map(
        monthlyAgents.slice(-3).map((entry) => [
          entry.agent.csId,
          monthlyAgents.findIndex((candidate) => candidate.agent.csId === entry.agent.csId) + 1,
        ]),
      );

      eligibleIds.forEach((csId) => {
        const monthlyEntry = monthlyAgents.find((entry) => entry.agent.csId === csId)!;
        const current = developmentMap.get(csId);
        const bottomRank = bottomRanks.get(csId);

        if (bottomRank !== undefined) {
          const nextStage: DevelopmentStage = !current
            ? "development"
            : current.stage === "development"
              ? "sp1"
              : current.stage === "sp1"
                ? "sp2"
                : "termination";

          developmentMap.set(csId, {
            csId,
            name: monthlyEntry.agent.name || csId,
            tl: monthlyEntry.agent.teamLeader || "-",
            stage: nextStage,
            cleanStreak: 0,
            bottomCount: (current?.bottomCount || 0) + 1,
            lastBottomMonth: monthRange.label,
            currentRank: bottomRank,
          });
          return;
        }

        if (!current || current.stage === "termination") return;
        const cleanStreak = current.cleanStreak + 1;
        if (cleanStreak >= 3) {
          developmentMap.delete(csId);
        } else {
          developmentMap.set(csId, {
            ...current,
            name: monthlyEntry.agent.name || current.name,
            tl: monthlyEntry.agent.teamLeader || current.tl,
            cleanStreak,
            currentRank: null,
          });
        }
      });
    });

    const stagePriority: Record<DevelopmentStage, number> = {
      termination: 4,
      sp2: 3,
      sp1: 2,
      development: 1,
    };
    const developmentList = Array.from(developmentMap.values()).sort(
      (a, b) =>
        stagePriority[b.stage] - stagePriority[a.stage] ||
        a.name.localeCompare(b.name),
    );

    return { agentRows: aList, tlRows: tList, developmentRows: developmentList };
  }, [
    hasData,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
    startDate,
    endDate,
  ]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full mt-10">
        <Trophy className="w-16 h-16 text-text-muted mb-4 stroke-1" />
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Belum Ada Data
        </h2>
        <p className="text-sm text-text-secondary mb-6 max-w-sm text-center">
          Buka File Center, pilih bulan data, lalu klik Sync Now untuk melihat ranking Leaderboard.
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
          Weighted Score: QA 50% &middot; Prod 20% &middot; CSAT 20% &middot; Training 5% &middot; Quiz 5%
        </p>
        <p className="text-[11px] text-text-muted italic mt-0.5">
          Mengikuti periode aktif, ranking mencakup seluruh agent
        </p>
      </div>

      <div className="inline-flex bg-surface-muted p-1 rounded-lg w-max gap-1">
        <button
          onClick={() => setToggleMode("agent")}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "agent"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <User className="w-4 h-4" /> Agents
        </button>
        <button
          onClick={() => setToggleMode("tl")}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "tl"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <Users className="w-4 h-4" /> Team Leaders
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="isolate relative w-full overflow-auto bg-card border border-border-strong rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-1 max-h-[calc(100vh-280px)]">
        <table className="w-full min-w-[2644px] table-fixed border-collapse whitespace-nowrap text-left text-[10px]">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[190px]" />
            <col className="w-[130px]" />
            <col className="w-[160px]" />
            {Array.from({ length: 22 }).map((_, index) => (
              <col key={`metric-column-${index}`} className="w-[96px]" />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-40 text-white">
            <tr className="bg-primary">
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 text-center font-bold md:sticky md:left-0 z-50 bg-primary">#</th>
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 font-bold md:sticky md:left-[52px] z-50 bg-primary">Name</th>
              <th rowSpan={2} className="overflow-hidden border-r border-white/40 p-2 font-bold md:sticky md:left-[242px] z-50 bg-primary">Email / CS ID</th>
              <th rowSpan={2} className="overflow-hidden border-r-2 border-white/60 p-2 font-bold md:sticky md:left-[372px] z-50 bg-primary shadow-[8px_0_12px_-8px_rgba(0,0,0,0.45)]">Leader Name</th>
              <th colSpan={2} className="border-r-2 border-white/60 p-2 text-center font-bold">QC Score (50 Points)</th>
              <th colSpan={7} className="border-r-2 border-white/60 p-2 text-center font-bold">Productivity (20 Points)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">CSAT Score (20 Points)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Training Completion (5 Points)</th>
              <th colSpan={4} className="border-r-2 border-white/60 p-2 text-center font-bold">Quiz Score (5 Points)</th>
              <th rowSpan={2} className="border-l-2 border-white/60 p-2 text-center font-bold">Final Score</th>
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
                    description="Jika belum sync, buka File Center lalu klik Sync Now dan pastikan periode aktif memiliki data."
                    variant="filter"
                    className="border-0 bg-transparent py-6"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <aside className="overflow-hidden rounded-lg border border-border-strong bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] xl:sticky xl:top-4">
        <div className="flex items-center justify-between border-b border-border-strong bg-surface-muted px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-xs font-bold text-text-primary">Development Plan</h3>
              <p className="text-[9px] text-text-muted">Monthly Bottom 3 tracking</p>
            </div>
          </div>
          <span className="text-xs font-black text-text-primary">{developmentRows.length}</span>
        </div>

        <div className="max-h-[calc(100vh-344px)] overflow-y-auto">
          {developmentRows.length > 0 ? (
            <table className="w-full table-fixed text-left text-[10px]">
              <thead className="sticky top-0 z-10 bg-surface text-text-muted">
                <tr className="border-b border-border-strong">
                  <th className="w-[46%] px-3 py-2 font-bold uppercase">Agent</th>
                  <th className="px-3 py-2 font-bold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {developmentRows.map((row) => {
                  const stageMeta = DEVELOPMENT_STAGE_META[row.stage];
                  return (
                    <tr key={row.csId} className="border-b border-border last:border-b-0 align-top">
                      <td className="px-3 py-2.5">
                        <div className="truncate font-bold text-text-primary" title={row.name}>{row.name}</div>
                        <div className="mt-0.5 truncate text-[9px] text-text-muted" title={`${row.csId} · ${row.tl}`}>
                          {row.csId} · {row.tl}
                        </div>
                        <div className="mt-1 text-[9px] font-semibold text-text-secondary">
                          Bottom {row.bottomCount}x · Last {row.lastBottomMonth}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex px-1.5 py-0.5 text-[9px] font-black", stageMeta.className)}>
                          {stageMeta.label}
                        </span>
                        <div className="mt-1.5 text-[9px] text-text-secondary">
                          {row.currentRank !== null
                            ? `Current rank #${row.currentRank}`
                            : `Clean streak ${row.cleanStreak}/3`}
                        </div>
                        <div className="mt-0.5 text-[9px] text-text-muted">
                          Next: {stageMeta.next}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-xs font-bold text-text-primary">Tidak ada status aktif</p>
              <p className="mt-1 text-[10px] text-text-muted">Riwayat dimulai dari Mei 2026.</p>
            </div>
          )}
        </div>
      </aside>
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
                  KPI Analysis
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
                aria-label="Close modal"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: KPI BREAKDOWN */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
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
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
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
