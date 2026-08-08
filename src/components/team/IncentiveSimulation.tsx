import React, { useMemo } from "react";
import { Calculator, CheckCircle2, CircleAlert, FileText, Info, KeyRound, LockKeyhole, User, Users, X } from "lucide-react";
import { useStore } from "../../store";
import { AgentKPI, getCsatBadRatingCount, matchesAgentScope, processKPIs } from "../../lib/dataProcessor";
import { cn, formatNum } from "../../lib/utils";

const DAILY_LIVECHAT_TARGET = 100;
const LIVECHAT_PRODUCTIVITY_BONUS_PER_100 = 40000;
const TEAM_LEADER_ACCESS_PIN = "170845";
const TEAM_LEADER_BEST_BONUS = 500000;
// PKWT TL: gaji Rp2.828.000 + jabatan Rp1.000.000 + transport Rp500.000 per bulan.
const TEAM_LEADER_GROSS_SALARY = 4328000;

type IncentiveStatus = "eligible" | "ineligible" | "incomplete";

interface IncentiveRow {
  csId: string;
  name: string;
  teamLeader: string;
  qaPct: number | null;
  qaPoints: number | null;
  csatPct: number | null;
  csatPoints: number | null;
  productivityActual: number | null;
  productivityTarget: number | null;
  productivityPct: number | null;
  productivityPoints: number | null;
  totalScore: number | null;
  tier: string;
  baseIncentive: number | null;
  productivityBonus: number | null;
  totalIncentive: number | null;
  status: IncentiveStatus;
}

interface TeamLeaderIncentiveRow {
  teamLeader: string;
  agentCount: number;
  incompleteCount: number;
  finalQaPct: number | null;
  finalCsatPct: number | null;
  finalProductivityPct: number | null;
  averageQaPoints: number | null;
  averageCsatPoints: number | null;
  averageProductivityPoints: number | null;
  finalScore: number | null;
  tier: string;
  baseIncentive: number | null;
  productivityBonus: number;
  bestLeaderBonus: number;
  totalIncentive: number | null;
  grossSalary: number;
  grossThp: number | null;
  status: IncentiveStatus;
}

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDateLabel = (date: string) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
};

const getPreviousCalendarMonthRange = (referenceDate: string) => {
  const [yearValue, monthValue] = referenceDate.split("-").map(Number);
  const year = yearValue || new Date().getFullYear();
  const month = monthValue || new Date().getMonth() + 1;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(previousYear, previousMonth, 0).getDate();

  return {
    start: `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`,
    end: `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
};

const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const isInactiveAgent = (agent: Pick<AgentKPI, "name">, periodEnd: string) =>
  normalizeAgentName(agent.name || "") === "edgar gasita adhigama" &&
  periodEnd.slice(0, 7) >= "2026-06";

const getQcPoints = (qaPct: number) => {
  if (qaPct >= 98) return 55;
  if (qaPct >= 95) return 48.4;
  if (qaPct >= 90) return 38.5;
  if (qaPct >= 85) return 24.75;
  if (qaPct >= 80) return 11;
  return 0;
};

const getTier = (score: number) => {
  if (score >= 96) return { label: "T1", incentive: 2000000 };
  if (score >= 88) return { label: "T2", incentive: 1250000 };
  if (score >= 80) return { label: "T3", incentive: 750000 };
  return { label: "-", incentive: 0 };
};

const getTeamLeaderTier = (score: number) => {
  if (score >= 90) return { label: "T1", incentive: 2000000 };
  if (score >= 85) return { label: "T2", incentive: 1250000 };
  if (score >= 80) return { label: "T3", incentive: 750000 };
  return { label: "-", incentive: 0 };
};

const getCsatStats = (agent: AgentKPI) => {
  const good = agent.csat4Count + agent.csat5Count;
  const bad = getCsatBadRatingCount(agent);

  return { good, bad, total: good + bad };
};

const getCsatPercent = (agent: AgentKPI) => {
  const { good, total } = getCsatStats(agent);
  return total > 0 ? (good / total) * 100 : null;
};

const buildIncentiveRow = (agent: AgentKPI): IncentiveRow => {
  const qaPct = agent.qaScoreCount > 0
    ? agent.qaScoreSum / agent.qaScoreCount
    : null;
  const csatPct = getCsatPercent(agent);
  const productivityTarget = agent.manDays > 0
    ? agent.manDays * DAILY_LIVECHAT_TARGET
    : null;
  const productivityActual = productivityTarget !== null
    ? agent.productivityTotal
    : null;
  const hasCompleteData = qaPct !== null && csatPct !== null && productivityActual !== null;

  if (!hasCompleteData) {
    return {
      csId: agent.csId,
      name: agent.name || agent.csId,
      teamLeader: agent.teamLeader || "-",
      qaPct,
      qaPoints: null,
      csatPct,
      csatPoints: null,
      productivityActual,
      productivityTarget,
      productivityPct: productivityTarget ? (productivityActual! / productivityTarget) * 100 : null,
      productivityPoints: null,
      totalScore: null,
      tier: "-",
      baseIncentive: null,
      productivityBonus: null,
      totalIncentive: null,
      status: "incomplete",
    };
  }

  const qaPoints = getQcPoints(qaPct);
  const csatPoints = (csatPct / 100) * 25;
  const productivityPct = (productivityActual / productivityTarget!) * 100;
  const productivityPoints = Math.min(productivityPct, 100) / 100 * 20;
  const totalScore = qaPoints + csatPoints + productivityPoints;
  const tier = getTier(totalScore);
  const isEligible = tier.label !== "-";
  const productivityBonus = isEligible
    ? Math.max(0, productivityActual - productivityTarget!) / 100 * LIVECHAT_PRODUCTIVITY_BONUS_PER_100
    : 0;

  return {
    csId: agent.csId,
    name: agent.name || agent.csId,
    teamLeader: agent.teamLeader || "-",
    qaPct,
    qaPoints,
    csatPct,
    csatPoints,
    productivityActual,
    productivityTarget,
    productivityPct,
    productivityPoints,
    totalScore,
    tier: tier.label,
    baseIncentive: tier.incentive,
    productivityBonus,
    totalIncentive: tier.incentive + productivityBonus,
    status: isEligible ? "eligible" : "ineligible",
  };
};

const statusLabel: Record<IncentiveStatus, string> = {
  eligible: "Eligible",
  ineligible: "Tidak eligible",
  incomplete: "Data belum lengkap",
};

const statusClass: Record<IncentiveStatus, string> = {
  eligible: "bg-success-soft text-success-text",
  ineligible: "bg-danger-soft text-danger-text",
  incomplete: "bg-warning-soft text-warning-text",
};

const SummaryCard = ({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
    <p className={cn(
      "mt-1 text-xl font-bold",
      tone === "success" ? "text-success-text" : tone === "warning" ? "text-warning-text" : "text-text-primary",
    )}>{value}</p>
    <p className="mt-0.5 text-[11px] text-text-muted">{detail}</p>
  </div>
);

export const IncentiveSimulation: React.FC = () => {
  const [viewMode, setViewMode] = React.useState<"agent" | "tl">("agent");
  const [isTlUnlocked, setIsTlUnlocked] = React.useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = React.useState(false);
  const [pinInput, setPinInput] = React.useState("");
  const [pinError, setPinError] = React.useState("");
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

  const openTlView = () => {
    if (isTlUnlocked) {
      setViewMode("tl");
      return;
    }
    setPinInput("");
    setPinError("");
    setIsPinDialogOpen(true);
  };

  const unlockTlView = (event: React.FormEvent) => {
    event.preventDefault();
    if (pinInput !== TEAM_LEADER_ACCESS_PIN) {
      setPinError("PIN tidak sesuai.");
      return;
    }
    setIsTlUnlocked(true);
    setIsPinDialogOpen(false);
    setPinInput("");
    setPinError("");
    setViewMode("tl");
  };

  const simulationPeriod = useMemo(
    () => getPreviousCalendarMonthRange(endDate || startDate),
    [endDate, startDate],
  );

  const rawData = useMemo(
    () => processKPIs(
      productivityData,
      csatScData,
      slaData,
      scheduleData,
      qaData,
      simulationPeriod.start,
      simulationPeriod.end,
      agentDictionary,
      agentDictionaryByMonth,
    ),
    [
      agentDictionary,
      agentDictionaryByMonth,
      csatScData,
      productivityData,
      qaData,
      scheduleData,
      simulationPeriod.end,
      simulationPeriod.start,
      slaData,
    ],
  );

  const filteredAgents = useMemo(() => {
    return rawData.filter(
      (agent) => !isInactiveAgent(agent, simulationPeriod.end)
        && matchesAgentScope(agent, {
          bpo: selectedBpo,
          teamLeader: selectedTL,
          agent: selectedGlobalAgent,
        }),
    );
  }, [
    rawData,
    selectedBpo,
    selectedGlobalAgent,
    selectedTL,
    simulationPeriod.end,
  ]);

  const rows = useMemo(() => filteredAgents
      .map(buildIncentiveRow)
      .sort((a, b) => {
        if (a.totalScore === null && b.totalScore === null) return a.name.localeCompare(b.name);
        if (a.totalScore === null) return 1;
        if (b.totalScore === null) return -1;
        return b.totalScore - a.totalScore;
      }), [filteredAgents]);

  const teamLeaderRows = useMemo(() => {
    const grouped = new Map<string, AgentKPI[]>();
    filteredAgents.forEach((agent) => {
      const teamLeader = String(agent.teamLeader || "-").trim() || "-";
      const current = grouped.get(teamLeader) || [];
      current.push(agent);
      grouped.set(teamLeader, current);
    });

    const leaderRows = Array.from(grouped.entries())
      .map(([teamLeader, teamAgents]): TeamLeaderIncentiveRow => {
        const agentRows = teamAgents.map(buildIncentiveRow);
        const qaCount = teamAgents.reduce((sum, agent) => sum + agent.qaScoreCount, 0);
        const qaSum = teamAgents.reduce((sum, agent) => sum + agent.qaScoreSum, 0);
        const csatStats = teamAgents.reduce(
          (totals, agent) => {
            const stats = getCsatStats(agent);
            return {
              good: totals.good + stats.good,
              bad: totals.bad + stats.bad,
            };
          },
          { good: 0, bad: 0 },
        );
        const totalDuty = teamAgents.reduce((sum, agent) => sum + agent.manDays, 0);
        const totalChat = teamAgents.reduce((sum, agent) => sum + agent.productivityTotal, 0);
        const finalQaPct = qaCount > 0 ? qaSum / qaCount : null;
        const csatTotal = csatStats.good + csatStats.bad;
        const finalCsatPct = csatTotal > 0
          ? (csatStats.good / csatTotal) * 100
          : null;
        const productivityTarget = totalDuty > 0 ? totalDuty * DAILY_LIVECHAT_TARGET : null;
        const finalProductivityPct = productivityTarget !== null
          ? (totalChat / productivityTarget) * 100
          : null;
        const incompleteCount = agentRows.filter((row) => row.status === "incomplete").length;
        const hasCompleteData = incompleteCount === 0
          && agentRows.length > 0
          && finalQaPct !== null
          && finalCsatPct !== null
          && finalProductivityPct !== null;
        const averageQaPoints = hasCompleteData
          ? agentRows.reduce((sum, row) => sum + (row.qaPoints || 0), 0) / agentRows.length
          : null;
        const averageCsatPoints = hasCompleteData
          ? agentRows.reduce((sum, row) => sum + (row.csatPoints || 0), 0) / agentRows.length
          : null;
        const averageProductivityPoints = hasCompleteData
          ? agentRows.reduce((sum, row) => sum + (row.productivityPoints || 0), 0) / agentRows.length
          : null;
        const finalScore = hasCompleteData
          ? agentRows.reduce((sum, row) => sum + (row.totalScore || 0), 0) / agentRows.length
          : null;

        if (finalScore === null) {
          return {
            teamLeader,
            agentCount: agentRows.length,
            incompleteCount,
            finalQaPct,
            finalCsatPct,
            finalProductivityPct,
            averageQaPoints,
            averageCsatPoints,
            averageProductivityPoints,
            finalScore,
            tier: "-",
            baseIncentive: null,
            productivityBonus: 0,
            bestLeaderBonus: 0,
            totalIncentive: null,
            grossSalary: TEAM_LEADER_GROSS_SALARY,
            grossThp: null,
            status: "incomplete",
          };
        }

        const tier = getTeamLeaderTier(finalScore);
        const isEligible = tier.label !== "-";

        return {
          teamLeader,
          agentCount: agentRows.length,
          incompleteCount,
          finalQaPct,
          finalCsatPct,
          finalProductivityPct,
          averageQaPoints,
          averageCsatPoints,
          averageProductivityPoints,
          finalScore,
          tier: tier.label,
          baseIncentive: tier.incentive,
          productivityBonus: 0,
          bestLeaderBonus: 0,
          totalIncentive: isEligible ? tier.incentive : 0,
          grossSalary: TEAM_LEADER_GROSS_SALARY,
          grossThp: TEAM_LEADER_GROSS_SALARY + (isEligible ? tier.incentive : 0),
          status: isEligible ? "eligible" : "ineligible",
        };
      })
      .sort((a, b) => (b.finalScore || -1) - (a.finalScore || -1));

    const eligibleScores = leaderRows
      .filter((row) => row.status === "eligible" && row.finalScore !== null)
      .map((row) => row.finalScore as number);
    const bestLeaderScore = eligibleScores.length > 0 ? Math.max(...eligibleScores) : null;

    return leaderRows.map((row) => {
      const isBestLeader = bestLeaderScore !== null
        && row.status === "eligible"
        && row.finalScore !== null
        && Math.abs(row.finalScore - bestLeaderScore) < 0.0001;
      const bestLeaderBonus = isBestLeader ? TEAM_LEADER_BEST_BONUS : 0;
      const totalIncentive = row.status === "eligible"
        ? (row.baseIncentive || 0) + bestLeaderBonus
        : row.totalIncentive;
      return {
        ...row,
        bestLeaderBonus,
        totalIncentive,
        grossThp: totalIncentive === null ? null : row.grossSalary + totalIncentive,
      };
    });
  }, [filteredAgents]);

  const eligibleRows = rows.filter((row) => row.status === "eligible");
  const ineligibleRows = rows.filter((row) => row.status === "ineligible");
  const totalIncentive = eligibleRows.reduce(
    (sum, row) => sum + (row.totalIncentive || 0),
    0,
  );
  const hasData = productivityData.length > 0 || csatScData.length > 0 || qaData.length > 0 || scheduleData.length > 0;
  const teamLeaderAgentCount = teamLeaderRows.reduce((sum, row) => sum + row.agentCount, 0);
  const teamLeaderIneligibleCount = teamLeaderRows.reduce(
    (sum, row) => sum + (row.status === "ineligible" ? 1 : 0),
    0,
  );
  const teamLeaderTotalIncentive = teamLeaderRows.reduce((sum, row) => sum + (row.totalIncentive || 0), 0);
  const teamLeaderTotalGrossThp = teamLeaderRows.reduce(
    (sum, row) => sum + (row.grossThp || 0),
    0,
  );
  return (
    <div className="flex flex-col gap-5 p-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Calculator className="h-5 w-5 text-primary" />
          Simulasi Insentif Baru
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">
          Skema Livechat berdasarkan data periode yang sudah selesai.
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Data simulasi: {simulationPeriod.start} s/d {simulationPeriod.end}; roster TL dan agent mengikuti periode simulasi.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1">
            QC 55% + CSAT 25% + Produktivitas 20%
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm font-semibold text-text-primary">Data simulasi belum tersedia</p>
          <p className="mt-1 text-xs text-text-muted">Sync data periode sebelumnya melalui File Center.</p>
        </div>
      ) : (
        <>
          <div className="inline-flex w-max items-center gap-1 rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode("agent")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-semibold transition-colors",
                viewMode === "agent" ? "bg-card text-primary shadow-sm" : "text-text-muted hover:text-text-primary",
              )}
            >
              <User className="h-3.5 w-3.5" /> Agents
            </button>
            <button
              type="button"
              onClick={openTlView}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-semibold transition-colors",
                viewMode === "tl" ? "bg-card text-primary shadow-sm" : "text-text-muted hover:text-text-primary",
              )}
            >
              {isTlUnlocked ? <Users className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />} Team Leaders
            </button>
          </div>

          {isPinDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                      <KeyRound className="h-4 w-4 text-primary" />
                      Akses Simulasi Team Leader
                    </h3>
                    <p className="mt-1 text-[11px] text-text-muted">Masukkan PIN untuk membuka simulasi khusus Team Leader.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPinDialogOpen(false)}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary"
                    aria-label="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={unlockTlView} className="mt-4 space-y-3">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="PIN akses"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {pinError && <p className="text-[11px] font-semibold text-danger">{pinError}</p>}
                  <button type="submit" className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90">
                    Buka Simulasi TL
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2",
            viewMode === "tl" ? "xl:grid-cols-5" : "xl:grid-cols-4",
          )}>
            {viewMode === "agent" ? (
              <>
                <SummaryCard label="Agent disimulasikan" value={rows.length} detail="Mengikuti filter global" />
                <SummaryCard label="Eligible" value={eligibleRows.length} detail="Mendapat tier insentif" tone="success" />
                <SummaryCard label="Tidak eligible" value={ineligibleRows.length} detail="Skor total di bawah 80" tone="warning" />
                <SummaryCard label="Total estimasi" value={formatCurrency(totalIncentive)} detail="Tier + bonus produktivitas" tone="success" />
              </>
            ) : (
              <>
                <SummaryCard label="TL disimulasikan" value={teamLeaderRows.length} detail="Mengikuti filter global" />
                <SummaryCard label="Total agent" value={teamLeaderAgentCount} detail="Agent di bawah TL" />
                <SummaryCard label="Tidak eligible" value={teamLeaderIneligibleCount} detail="Skor total di bawah 80" tone="warning" />
                <SummaryCard label="Total estimasi" value={formatCurrency(teamLeaderTotalIncentive)} detail="Tier TL + bonus TL terbaik" tone="success" />
                <SummaryCard label="Total THP gross" value={formatCurrency(teamLeaderTotalGrossThp)} detail="Gaji gross + insentif TL" tone="success" />
              </>
            )}
          </div>

          <section className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  {viewMode === "agent" ? "Simulasi per Agent" : "Simulasi per Team Leader"}
                </h3>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {viewMode === "agent"
                    ? "Nilai produktivitas di atas target menghasilkan bonus tambahan."
                    : "Skor TL adalah rata-rata final score agent di dalam timnya."}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Info className="h-3.5 w-3.5 text-primary" />
                Kuis dan training bersifat mandatory, tidak masuk total skor.
              </div>
            </div>

            {viewMode === "agent" ? (
            <div className="max-h-[calc(100vh-350px)] overflow-auto">
              <table className="min-w-[1240px] w-full table-fixed border-collapse text-left text-[10px]">
                <colgroup>
                  <col className="w-[34px]" />
                  <col className="w-[190px]" />
                  <col className="w-[120px]" />
                  <col className="w-[64px]" />
                  <col className="w-[72px]" />
                  <col className="w-[64px]" />
                  <col className="w-[72px]" />
                  <col className="w-[84px]" />
                  <col className="w-[76px]" />
                  <col className="w-[72px]" />
                  <col className="w-[50px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-[108px]" />
                  <col className="w-[112px]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-primary text-white">
                  <tr>
                    {[
                      "#", "Agent", "Team Leader", "QA", "Poin QA", "CSAT", "Poin CSAT",
                      "Produktivitas", "Poin Prod", "Total Score", "Tier", "Insentif Tier",
                      "Bonus Prod", "Total Insentif", "Status",
                    ].map((label) => (
                      <th key={label} className="border-r border-white/30 px-2 py-2 font-bold last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.csId} className="border-b border-border hover:bg-surface-muted">
                      <td className="px-2 py-2 font-semibold text-text-muted">{index + 1}</td>
                      <td className="px-2 py-2">
                        <p className="truncate font-bold text-text-primary" title={row.name}>{row.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-text-muted" title={row.csId}>{row.csId}</p>
                      </td>
                      <td className="truncate px-2 py-2 text-text-secondary" title={row.teamLeader}>{row.teamLeader}</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {formatNum(row.qaPct, 2)}%
                      </td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {formatNum(row.qaPoints, 2)} / 55
                      </td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {formatNum(row.csatPct, 2)}%
                      </td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {formatNum(row.csatPoints, 2)} / 25
                      </td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {row.productivityActual === null || row.productivityTarget === null
                          ? "-"
                          : `${formatNum(row.productivityActual, 0)} / ${formatNum(row.productivityTarget, 0)}`}
                      </td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">
                        {formatNum(row.productivityPoints, 2)} / 20
                      </td>
                      <td className="px-2 py-2 font-bold text-text-primary">
                        {formatNum(row.totalScore, 2)}
                      </td>
                      <td className="px-2 py-2 font-bold text-primary">{row.tier}</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatCurrency(row.baseIncentive)}</td>
                      <td className="px-2 py-2 font-semibold text-success-text">{formatCurrency(row.productivityBonus)}</td>
                      <td className="px-2 py-2 font-bold text-text-primary">{formatCurrency(row.totalIncentive)}</td>
                      <td className="px-2 py-2">
                        <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold", statusClass[row.status])}>
                          {statusLabel[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-xs text-text-muted">
                        Tidak ada agent pada filter yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : (
            <div className="max-h-[calc(100vh-350px)] overflow-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left text-[10px]">
                <thead className="sticky top-0 z-20 bg-primary text-white">
                  <tr>
                    {[
                      "#", "Team Leader", "Agents", "Final QA", "Final CSAT", "Final Prod",
                      "Breakdown Poin", "Final KPI", "Tier TL", "Insentif TL", "Bonus TL Terbaik",
                      "Gaji Gross", "Total THP Gross", "Status",
                    ].map((label) => (
                      <th key={label} className="border-r border-white/30 px-2 py-2 font-bold last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamLeaderRows.map((row, index) => (
                    <tr key={row.teamLeader} className="border-b border-border hover:bg-surface-muted">
                      <td className="px-2 py-2 font-semibold text-text-muted">{index + 1}</td>
                      <td className="px-2 py-2 font-bold text-text-primary">{row.teamLeader}</td>
                      <td className="px-2 py-2 text-text-secondary">{row.agentCount}</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatNum(row.finalQaPct, 2)}%</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatNum(row.finalCsatPct, 2)}%</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatNum(row.finalProductivityPct, 1)}%</td>
                      <td className="px-2 py-2 text-[9px] leading-4 text-text-secondary">
                        <div>QA: <strong className="text-text-primary">{formatNum(row.averageQaPoints, 2)} / 55</strong></div>
                        <div>CSAT: <strong className="text-text-primary">{formatNum(row.averageCsatPoints, 2)} / 25</strong></div>
                        <div>Prod: <strong className="text-text-primary">{formatNum(row.averageProductivityPoints, 2)} / 20</strong></div>
                      </td>
                      <td className="px-2 py-2 font-bold text-text-primary">{formatNum(row.finalScore, 2)}</td>
                      <td className="px-2 py-2 font-bold text-primary">{row.tier}</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatCurrency(row.baseIncentive)}</td>
                      <td className="px-2 py-2 font-semibold text-success-text">{formatCurrency(row.bestLeaderBonus)}</td>
                      <td className="px-2 py-2 font-semibold text-text-secondary">{formatCurrency(row.grossSalary)}</td>
                      <td className="px-2 py-2 font-bold text-text-primary">{formatCurrency(row.grossThp)}</td>
                      <td className="px-2 py-2">
                        <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-bold", statusClass[row.status])}>
                          {statusLabel[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {teamLeaderRows.length === 0 && (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-xs text-text-muted">
                        Tidak ada Team Leader pada filter yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
            {viewMode === "tl" && (
              <div className="border-t border-border bg-surface-muted px-4 py-3 text-[11px] text-text-secondary">
                <strong className="text-text-primary">Cara baca:</strong> persentase QA/CSAT/Prod adalah ringkasan tim, sedangkan Final KPI dihitung dari rata-rata Final KPI setiap agent. Breakdown poin menunjukkan rata-rata poin agent sebelum dijumlahkan menjadi Final KPI TL.
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Kurva Poin QC Livechat
              </h3>
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-surface-muted text-text-muted">
                    <tr><th className="px-3 py-2">Nilai QC</th><th className="px-3 py-2">Poin</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ["98% ke atas", "55"],
                      ["95 - 97%", "48,4"],
                      ["90 - 94%", "38,5"],
                      ["85 - 89%", "24,75"],
                      ["80 - 84%", "11"],
                      ["Di bawah 80%", "0"],
                    ].map(([range, points]) => (
                      <tr key={range} className="border-t border-border">
                        <td className="px-3 py-2 text-text-secondary">{range}</td>
                        <td className="px-3 py-2 font-semibold text-text-primary">{points} / 55</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <Calculator className="h-4 w-4 text-primary" />
                Tier Insentif
              </h3>
              <div className="mt-3 space-y-2 text-[11px]">
                {(viewMode === "tl"
                  ? [
                    ["T1", "90 ke atas", "Rp2.000.000"],
                    ["T2", "85 - 89,99", "Rp1.250.000"],
                    ["T3", "80 - 84,99", "Rp750.000"],
                    ["-", "Di bawah 80", "Tidak eligible"],
                  ]
                  : [
                    ["T1", "96 ke atas", "Rp2.000.000"],
                    ["T2", "88 - 95,99", "Rp1.250.000"],
                    ["T3", "80 - 87,99", "Rp750.000"],
                    ["-", "Di bawah 80", "Tidak eligible"],
                  ]
                ).map(([tier, range, amount]) => (
                  <div key={tier} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="font-bold text-primary">{tier}</span>
                    <span className="text-text-secondary">{range}</span>
                    <span className="font-bold text-text-primary">{amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <CircleAlert className="h-4 w-4 text-warning" />
                Aturan Tambahan
              </h3>
              <div className="mt-3 space-y-2 text-[11px] text-text-secondary">
                {viewMode === "agent" ? (
                  <p className="rounded-lg bg-surface-muted p-3">Bonus Livechat: setiap 100 chat di atas target = <strong className="text-text-primary">Rp40.000</strong>.</p>
                ) : (
                  <>
                    <p className="rounded-lg bg-surface-muted p-3">Skor TL dihitung dari rata-rata final score seluruh agent dalam tim.</p>
                    <p className="rounded-lg bg-success-soft p-3 text-success-text">TL terbaik di channel Livechat mendapat bonus tambahan <strong>Rp500.000</strong>.</p>
                    <p className="rounded-lg bg-surface-muted p-3">Gaji gross TL per bulan <strong className="text-text-primary">Rp4.328.000</strong>. THP gross = gaji gross + insentif TL.</p>
                    <p className="rounded-lg bg-warning-soft p-3 text-warning-text">THP gross belum dikurangi pajak/BPJS dan belum termasuk lembur, hari libur, atau shift malam.</p>
                  </>
                )}
                <p className="rounded-lg bg-surface-muted p-3">Kuis dan training wajib diselesaikan, tetapi tidak menambah skor insentif.</p>
                <p className="rounded-lg bg-warning-soft p-3 text-warning-text">QA, CSAT, atau produktivitas yang belum tersedia akan berstatus <strong>Data belum lengkap</strong>.</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default IncentiveSimulation;
