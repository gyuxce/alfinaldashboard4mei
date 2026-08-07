import React, { useMemo } from "react";
import { Calculator, CheckCircle2, CircleAlert, FileText, Info } from "lucide-react";
import { useStore } from "../../store";
import { AgentKPI, processKPIs } from "../../lib/dataProcessor";
import { cn, formatNum } from "../../lib/utils";

const DAILY_LIVECHAT_TARGET = 100;
const LIVECHAT_PRODUCTIVITY_BONUS_PER_100 = 40000;

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

const getCsatPercent = (agent: AgentKPI) => {
  if (agent.csatRespondents <= 0 || agent.csatAsli === null) return null;
  return agent.csatAsli <= 5 ? (agent.csatAsli / 5) * 100 : agent.csatAsli;
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

  const rows = useMemo(() => {
    let filtered = rawData.filter(
      (agent) => !isInactiveAgent(agent, simulationPeriod.end),
    );

    if (selectedBpo && selectedBpo !== "All BPO") {
      filtered = filtered.filter(
        (agent) => (agent.bpo || "").toUpperCase() === selectedBpo.toUpperCase(),
      );
    }
    if (selectedTL && selectedTL !== "All TL" && selectedTL !== "All Team Leaders") {
      filtered = filtered.filter(
        (agent) => (agent.teamLeader || "").toUpperCase() === selectedTL.toUpperCase(),
      );
    }
    if (selectedGlobalAgent && selectedGlobalAgent !== "All Agents") {
      filtered = filtered.filter(
        (agent) => agent.name === selectedGlobalAgent || agent.csId === selectedGlobalAgent,
      );
    }

    return filtered
      .map(buildIncentiveRow)
      .sort((a, b) => {
        if (a.totalScore === null && b.totalScore === null) return a.name.localeCompare(b.name);
        if (a.totalScore === null) return 1;
        if (b.totalScore === null) return -1;
        return b.totalScore - a.totalScore;
      });
  }, [
    endDate,
    rawData,
    selectedBpo,
    selectedGlobalAgent,
    selectedTL,
    simulationPeriod.end,
  ]);

  const completeRows = rows.filter((row) => row.status !== "incomplete");
  const eligibleRows = rows.filter((row) => row.status === "eligible");
  const incompleteRows = rows.filter((row) => row.status === "incomplete");
  const totalIncentive = eligibleRows.reduce(
    (sum, row) => sum + (row.totalIncentive || 0),
    0,
  );
  const hasData = productivityData.length > 0 || csatScData.length > 0 || qaData.length > 0 || scheduleData.length > 0;
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${simulationPeriod.start}T00:00:00`));

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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
          <span className="rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            Periode simulasi: {periodLabel}
          </span>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Agent disimulasikan" value={rows.length} detail="Mengikuti filter global" />
            <SummaryCard label="Eligible" value={eligibleRows.length} detail="Mendapat tier insentif" tone="success" />
            <SummaryCard label="Data belum lengkap" value={incompleteRows.length} detail="Tidak dipaksakan menjadi nol" tone="warning" />
            <SummaryCard label="Total estimasi" value={formatCurrency(totalIncentive)} detail="Tier + bonus produktivitas" tone="success" />
          </div>

          <section className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Simulasi per Agent</h3>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  Nilai produktivitas di atas target menghasilkan bonus tambahan.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Info className="h-3.5 w-3.5 text-primary" />
                Kuis dan training bersifat mandatory, tidak masuk total skor.
              </div>
            </div>

            <div className="max-h-[calc(100vh-390px)] overflow-auto">
              <table className="min-w-[1820px] w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 z-20 bg-primary text-white">
                  <tr>
                    {[
                      "#", "Agent", "Team Leader", "QA", "Poin QA", "CSAT", "Poin CSAT",
                      "Produktivitas", "Poin Prod", "Total Score", "Tier", "Insentif Tier",
                      "Bonus Prod", "Total Insentif", "Status",
                    ].map((label) => (
                      <th key={label} className="border-r border-white/30 px-3 py-2.5 font-bold last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.csId} className="border-b border-border hover:bg-surface-muted">
                      <td className="px-3 py-2.5 font-semibold text-text-muted">{index + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-text-primary">{row.name}</p>
                        <p className="mt-0.5 text-[10px] text-text-muted">{row.csId}</p>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{row.teamLeader}</td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {formatNum(row.qaPct, 2)}%
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {formatNum(row.qaPoints, 2)} / 55
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {formatNum(row.csatPct, 2)}%
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {formatNum(row.csatPoints, 2)} / 25
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {row.productivityActual === null || row.productivityTarget === null
                          ? "-"
                          : `${formatNum(row.productivityActual, 0)} / ${formatNum(row.productivityTarget, 0)} (${formatNum(row.productivityPct, 1)}%)`}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">
                        {formatNum(row.productivityPoints, 2)} / 20
                      </td>
                      <td className="px-3 py-2.5 font-bold text-text-primary">
                        {formatNum(row.totalScore, 2)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-primary">{row.tier}</td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">{formatCurrency(row.baseIncentive)}</td>
                      <td className="px-3 py-2.5 font-semibold text-success-text">{formatCurrency(row.productivityBonus)}</td>
                      <td className="px-3 py-2.5 font-bold text-text-primary">{formatCurrency(row.totalIncentive)}</td>
                      <td className="px-3 py-2.5">
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
                {[
                  ["T1", "96 ke atas", "Rp2.000.000"],
                  ["T2", "88 - 95,99", "Rp1.250.000"],
                  ["T3", "80 - 87,99", "Rp750.000"],
                  ["-", "Di bawah 80", "Tidak eligible"],
                ].map(([tier, range, amount]) => (
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
                <p className="rounded-lg bg-surface-muted p-3">Bonus Livechat: setiap 100 chat di atas target = <strong className="text-text-primary">Rp40.000</strong>.</p>
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
