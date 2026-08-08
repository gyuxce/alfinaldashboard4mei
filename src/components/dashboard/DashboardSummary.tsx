import React, { useMemo, useState, useRef, useEffect } from "react";
import { AgentKPI, getOfficialCsatAggregate, getPreviousMonthPeriod, getPreviousPeriod } from "../../lib/dataProcessor";
import { formatNum, getKpiColor, parseDateForSort } from "../../lib/utils";
import { Activity, Star, Clock, CheckCircle, TrendingUp, Users, Info, ChevronDown } from "lucide-react";
import { useStore } from "../../store";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardAgentTable } from "./DashboardAgentTable";
import { EmptyState } from "../ui/EmptyState";

interface Props {
  data: AgentKPI[];
  previousData?: AgentKPI[];
  previousData2?: AgentKPI[];
  previousData3?: AgentKPI[];
}

export const DashboardSummary: React.FC<Props> = ({ data, previousData = [], previousData2 = [], previousData3 = [] }) => {
  const [search, setSearch] = useState("");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { startDate, endDate, comparisonMode } = useStore();

  const tableData = useMemo(() => {
    return data.filter(
      (a) =>
        a.csId.toLowerCase().includes(search.toLowerCase()) ||
        (a.name || "").toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const calculate = (dataset: AgentKPI[]) => {
      let totalProd = 0, sumManDays = 0, sumSla1m = 0, sumSla3m = 0, sumWhu = 0;
      let sumCsatScFull = 0, countCsatScFull = 0, sumCsatScFair = 0, countCsatScFair = 0;
      let sumQa = 0, countQa = 0, sla1mCount = 0, sla3mCount = 0, whuCount = 0, attPresence = 0, attDuty = 0;
      const officialCsat = getOfficialCsatAggregate(dataset);

      dataset.forEach((d) => {
        totalProd += d.productivityTotal;
        sumManDays += d.manDays;
        if (d.sla1m !== null) { sumSla1m += d.sla1m; sla1mCount++; }
        if (d.sla3m !== null) { sumSla3m += d.sla3m; sla3mCount++; }
        if (d.whu !== null) { sumWhu += d.whu; whuCount++; }
        sumCsatScFull += d.csatScGoodCount || 0;
        countCsatScFull += d.csatScTotalValid || 0;
        sumCsatScFair += d.csatScFairGoodCount || 0;
        countCsatScFair += d.csatScFairTotalValid || 0;
        sumQa += d.qaScoreSum;
        countQa += d.qaScoreCount;
        attPresence += d.attendancePresence || 0;
        attDuty += d.attendanceDuty || 0;
      });

      return {
        productivity: totalProd,
        avgProductivity: sumManDays > 0 ? totalProd / sumManDays : 0,
        csat: officialCsat.score || 0,
        csatPercent: officialCsat.score !== null ? (officialCsat.score / 5) * 100 : 0,
        csatScFull: countCsatScFull > 0 ? (sumCsatScFull / countCsatScFull) * 100 : 0,
        csatScFullCount: countCsatScFull,
        csatScFair: countCsatScFair > 0 ? (sumCsatScFair / countCsatScFair) * 100 : 0,
        csatScFairCount: countCsatScFair,
        sla1m: sla1mCount > 0 ? sumSla1m / sla1mCount : 0,
        sla3m: sla3mCount > 0 ? sumSla3m / sla3mCount : 0,
        whu: whuCount > 0 ? sumWhu / whuCount : 0,
        qa: countQa > 0 ? sumQa / countQa : 0,
        attendance: attDuty > 0 ? (attPresence / attDuty) * 100 : 0,
        agentsCount: dataset.length,
      };
    };

    return {
      current: calculate(data),
      previous: calculate(previousData),
      previous2: calculate(previousData2),
      previous3: calculate(previousData3),
    };
  }, [data, previousData, previousData2, previousData3]);

  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
  const currentStats = stats.current;
  const previousStats = stats.previous;
  const previousStats2 = stats.previous2;
  const previousStats3 = stats.previous3;

  const getDelta = (curr: number, prev: number) => {
    if (!isComparisonEnabled || !previousData.length) return undefined;
    return curr - prev;
  };

  const generateDailyTrend = (dataset: AgentKPI[]) => {
    const datesSet = new Set<string>();
    const rawToNormDate = new Map<string, string>();

    dataset.forEach((a) => {
      if (a.dailyHistory) {
        a.dailyHistory.productivity.forEach((h) => {
          const norm = h.date;
          datesSet.add(norm);
          rawToNormDate.set(h.date, norm);
        });
      }
    });

    const sortedDates = Array.from(datesSet).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));

    return sortedDates.map((date) => {
      let totalProd = 0, sumCsat = 0, countCsat = 0, sumCsatFull = 0, countCsatFull = 0;
      let sumCsatFair = 0, countCsatFair = 0, sumSla1m = 0, countSla1m = 0, sumSla3m = 0, countSla3m = 0;
      let sumWhu = 0, countWhu = 0, sumQa = 0, countQa = 0, totalAttendancePresence = 0, totalAttendanceDuty = 0;

      dataset.forEach((a) => {
        const prodEntry = a.dailyHistory.productivity.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (prodEntry && prodEntry.value) totalProd += prodEntry.value;

        const csatEntry = a.dailyHistory.csat.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (csatEntry && csatEntry.value) {
          const respondentCount = csatEntry.count || 1;
          sumCsat += csatEntry.sum ?? csatEntry.value * respondentCount;
          countCsat += respondentCount;
        }

        const sla1mEntry = a.dailyHistory.sla1m.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (sla1mEntry && sla1mEntry.value) { sumSla1m += sla1mEntry.value; countSla1m++; }

        const sla3mEntry = a.dailyHistory.sla3m.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (sla3mEntry && sla3mEntry.value) { sumSla3m += sla3mEntry.value; countSla3m++; }

        const whuEntry = a.dailyHistory.whu.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (whuEntry && whuEntry.value) { sumWhu += whuEntry.value; countWhu++; }

        if (a.qaHistory) {
          const qaEntries = a.qaHistory.filter(h => (h.normDate || rawToNormDate.get(h.date) || h.date) === date);
          qaEntries.forEach(q => { if (q.score !== undefined) { sumQa += q.score; countQa++; } });
        }

        const sysCsatFullEntry = a.dailyHistory.csatScFull.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (sysCsatFullEntry && sysCsatFullEntry.count > 0) { sumCsatFull += sysCsatFullEntry.score; countCsatFull += sysCsatFullEntry.count; }

        const sysCsatFairEntry = a.dailyHistory.csatScFair.find(h => (rawToNormDate.get(h.date) || h.date) === date);
        if (sysCsatFairEntry && sysCsatFairEntry.count > 0) { sumCsatFair += sysCsatFairEntry.score; countCsatFair += sysCsatFairEntry.count; }

        const schedEntry = a.dailyHistory.schedule.find(s => (s.normDate || s.date) === date);
        if (schedEntry) {
          if (schedEntry.isManDay || schedEntry.status === "PULLOUT") totalAttendanceDuty += 1;
          const isNum = !isNaN(parseFloat(schedEntry.status.replace(",", "."))) && schedEntry.status !== "";
          if (isNum || schedEntry.status === "PULLOUT") totalAttendancePresence += 1;
        }
      });

      let dateLabel = date;
      const parts = date.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) dateLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
      }

      return {
        date, dateLabel, productivity: totalProd,
        csat: countCsat > 0 ? Number((sumCsat / countCsat).toFixed(2)) : null,
        csatScFull: countCsatFull > 0 ? Number(((sumCsatFull / countCsatFull) * 100).toFixed(2)) : null,
        csatScFair: countCsatFair > 0 ? Number(((sumCsatFair / countCsatFair) * 100).toFixed(2)) : null,
        sla1m: countSla1m > 0 ? Number((sumSla1m / countSla1m).toFixed(2)) : null,
        sla3m: countSla3m > 0 ? Number((sumSla3m / countSla3m).toFixed(2)) : null,
        whu: countWhu > 0 ? Number((sumWhu / countWhu).toFixed(2)) : null,
        qa: countQa > 0 ? Number((sumQa / countQa).toFixed(2)) : null,
        attendance: totalAttendanceDuty > 0 ? Number(((totalAttendancePresence / totalAttendanceDuty) * 100).toFixed(2)) : null,
        avgProductivity: totalAttendanceDuty > 0 ? Number((totalProd / totalAttendanceDuty).toFixed(2)) : null,
      };
    });
  };

  const dailyTrend = useMemo(() => {
    const current = generateDailyTrend(data);
    const previous = isComparisonEnabled ? generateDailyTrend(previousData) : [];

    return current.map((item, idx) => {
      const prevItem = previous[idx];
      return {
        ...item,
        prevProductivity: prevItem ? prevItem.productivity : null,
        prevDateLabel: prevItem ? prevItem.dateLabel : null,
      };
    });
  }, [data, previousData, isComparisonEnabled]);


  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
        <h1 className="text-lg font-bold text-text-primary shrink-0">
          Dashboard Summary{" "}
          <span className="text-text-muted font-normal text-sm ml-2">
            Active Period: Live
          </span>
        </h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search CS ID or Name..."
              className="pl-8 pr-3 py-1.5 border border-border bg-card text-text-primary rounded-xl text-xs focus:border-primary focus:outline-none w-full md:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg
              className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
        </div>
      </div>

      {!data.length && (
        <EmptyState
          title="Belum ada data KPI untuk ditampilkan"
          description="Buka File Center, pilih bulan data, lalu klik Sync Now. Setelah sync berhasil, dashboard akan menampilkan data sesuai bulan yang dipilih."
          variant="data"
        />
      )}

      {data.length > 0 && (
        <>


          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Productivity"
              value={formatNum(currentStats.productivity, 0)}
              delta={getDelta(currentStats.productivity, previousStats.productivity)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.productivity, 0) : undefined}
              kpiTheme="productivity"
            />
            <StatCard
              title="Avg Productivity"
              value={formatNum(currentStats.avgProductivity, 0)}
              delta={getDelta(currentStats.avgProductivity, previousStats.avgProductivity)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.avgProductivity, 0) : undefined}
              kpiTheme="productivity-avg"
            />
            <StatCard
              title="CSAT Official"
              value={formatNum(currentStats.csat)}
              subValue={currentStats.csatPercent > 0 ? formatNum(currentStats.csatPercent, 2) + "%" : undefined}
              delta={getDelta(currentStats.csatPercent, previousStats.csatPercent)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.csatPercent) + "%" : undefined}
              kpiTheme="csat"
            />
            <StatCard
              title="CSAT SC Full"
              value={formatNum(currentStats.csatScFull) + "%"}
              subValue={currentStats.csatScFull > 0 ? formatNum((currentStats.csatScFull / 100) * 5, 2) + " poin" : undefined}
              delta={getDelta(currentStats.csatScFull, previousStats.csatScFull)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.csatScFull) + "%" : undefined}
              kpiTheme="csat"
            />
            <StatCard
              title="CSAT SC After Takeout"
              value={formatNum(currentStats.csatScFair) + "%"}
              subValue={currentStats.csatScFair > 0 ? formatNum((currentStats.csatScFair / 100) * 5, 2) + " poin" : undefined}
              delta={getDelta(currentStats.csatScFair, previousStats.csatScFair)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.csatScFair) + "%" : undefined}
              kpiTheme="csat"
            />
            <StatCard
              title="SLA 1 Menit"
              value={formatNum(currentStats.sla1m) + "%"}
              delta={getDelta(currentStats.sla1m, previousStats.sla1m)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.sla1m) + "%" : undefined}
              kpiTheme="sla"
            />
            <StatCard
              title="SLA 3 Menit"
              value={formatNum(currentStats.sla3m) + "%"}
              delta={getDelta(currentStats.sla3m, previousStats.sla3m)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.sla3m) + "%" : undefined}
              kpiTheme="sla"
            />
            <StatCard
              title="WHU (%)"
              value={formatNum(currentStats.whu) + "%"}
              delta={getDelta(currentStats.whu, previousStats.whu)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.whu) + "%" : undefined}
              kpiTheme="whu"
            />
            <StatCard
              title="QA Score"
              value={formatNum(currentStats.qa) + "%"}
              delta={getDelta(currentStats.qa, previousStats.qa)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.qa) + "%" : undefined}
              kpiTheme="qa"
            />
            <StatCard
              title="Attendance"
              value={formatNum(currentStats.attendance) + "%"}
              delta={getDelta(currentStats.attendance, previousStats.attendance)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.attendance) + "%" : undefined}
              kpiTheme="neutral"
            />
          </div>

          <KpiRulesPanel
            isOpen={isRulesOpen}
            onToggle={() => setIsRulesOpen((value) => !value)}
          />

          {/* Weekly Report Panel - only shown when comparison is active */}
          {isComparisonEnabled && previousData.length > 0 && (
            <WeeklyReportPanel
              currentStats={currentStats}
              previousStats={previousStats}
              previousStats2={previousStats2}
              previousStats3={previousStats3}
              hasPrev2={previousData2.length > 0}
              hasPrev3={previousData3.length > 0}
              startDate={startDate}
              endDate={endDate}
              comparisonMode={comparisonMode}
            />
          )}

          <DashboardCharts stats={currentStats} dailyTrend={dailyTrend} />
          <DashboardAgentTable tableData={tableData} />
        </>
      )}
    </div>
  );
};

type KpiFormula = {
  target?: string;
  formula: string;
  source: string;
  note?: string;
};

const KPI_FORMULAS: Record<string, KpiFormula> = {
  "Total Productivity": {
    formula: "Jumlah seluruh chat atau tiket pada periode yang dipilih.",
    source: "Data produktivitas",
  },
  "Avg Productivity": {
    target: "100",
    formula: "Total produktivitas dibagi jumlah hari kerja.",
    source: "Data produktivitas dan jadwal",
  },
  "CSAT Official": {
    target: "3.75 / 5",
    formula: "Jumlah poin rating dibagi jumlah responden.",
    source: "Data CSAT Official",
    note: "Rating 1 sampai 5 dihitung sesuai jumlah responden.",
  },
  "CSAT SC Full": {
    target: "75%",
    formula: "Jumlah rating 4 dan 5 dibagi seluruh rating yang valid.",
    source: "Data survei CSAT",
    note: "Seluruh rating valid, termasuk rating 3, tetap dihitung.",
  },
  "CSAT SC After Takeout": {
    target: "92%",
    formula: "Jumlah rating 4 dan 5 dibagi rating valid setelah kasus takeout dikeluarkan.",
    source: "Data survei CSAT",
    note: "Kasus yang masuk kategori takeout tidak ikut dihitung.",
  },
  "SLA 1 Menit": {
    target: "92%",
    formula: "Rata-rata persentase respons yang memenuhi batas 1 menit.",
    source: "Data SLA",
  },
  "SLA 3 Menit": {
    target: "96%",
    formula: "Rata-rata persentase respons yang memenuhi batas 3 menit.",
    source: "Data SLA",
  },
  "WHU (%)": {
    target: "96%",
    formula: "Rata-rata persentase WHU dari data yang tersedia.",
    source: "Data produktivitas",
  },
  "QA Score": {
    target: "92%",
    formula: "Rata-rata nilai pemeriksaan QA yang memiliki nilai.",
    source: "Data QA",
  },
  "Attendance": {
    target: "95%",
    formula: "Hari hadir dibagi hari kerja, lalu dikali 100.",
    source: "Data jadwal",
    note: "Hari PULLOUT tetap dihitung sebagai hari kerja dan hadir.",
  },
  "Training Completion": {
    target: "100%",
    formula: "Nilai mengikuti status penyelesaian training.",
    source: "Data training",
    note: "Data training belum tersedia, sehingga sementara dinilai 100%.",
  },
  "Quiz": {
    target: "92%",
    formula: "Nilai mengikuti hasil quiz dibandingkan target.",
    source: "Data quiz",
    note: "Data quiz belum tersedia, sehingga sementara dinilai 100%.",
  },
  "Final Score": {
    target: "100",
    formula: "Gabungan QA 50%, produktivitas 20%, CSAT 20%, training 5%, dan quiz 5%.",
    source: "Seluruh KPI",
  },
};

const FormulaTooltip = ({ title }: { title: string }) => {
  const formula = KPI_FORMULAS[title];
  if (!formula) return null;

  return (
    <span className="group/formula relative inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-label={`Penjelasan ${title}`}
        title={`${title}: ${formula.formula}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Info size={12} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-border bg-card p-3 text-left shadow-xl group-hover/formula:block group-focus-within/formula:block">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-text-primary">
          {title}
        </span>
        {formula.target && (
          <span className="mt-1 block text-[11px] text-text-muted">
            Target: <span className="font-semibold text-text-secondary">{formula.target}</span>
          </span>
        )}
        <span className="mt-2 block text-[11px] leading-relaxed text-text-secondary">
          {formula.formula}
        </span>
        <span className="mt-2 block text-[10px] text-text-muted">
          Sumber data: {formula.source}
        </span>
        {formula.note && (
          <span className="mt-1 block text-[10px] leading-relaxed text-text-muted">
            Note: {formula.note}
          </span>
        )}
      </span>
    </span>
  );
};

const KpiRulesPanel = ({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const rules = Object.entries(KPI_FORMULAS);

  return (
    <section className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Info size={14} className="shrink-0 text-primary" />
            <h2 className="text-sm font-bold text-text-primary">Aturan KPI</h2>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Target dan ringkasan cara penilaian setiap KPI.
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-bold uppercase tracking-wide">KPI</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-wide">Target</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-wide">Cara Hitung</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-wide">Sumber Data</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-wide">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(([name, rule], index) => (
                  <tr
                    key={name}
                    className={`border-t border-border/60 ${index % 2 === 0 ? 'bg-surface/20' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">
                      {name}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">
                      {rule.target || '-'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary min-w-[260px]">
                      {rule.formula}
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {rule.source}
                    </td>
                    <td className="px-4 py-3 text-text-muted min-w-[220px]">
                      {rule.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

const parseDisplayValue = (value: string) => {
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return {
    target: Number(match[1]),
    decimals,
    suffix: match[2],
  };
};

const CountUpValue = ({ value }: { value: string }) => {
  const parsed = parseDisplayValue(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!parsed || Number.isNaN(parsed.target)) {
      setDisplayValue(value);
      return;
    }

    let animationFrame = 0;
    const durationMs = 2400;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = parsed.target * eased;
      setDisplayValue(`${nextValue.toFixed(parsed.decimals)}${parsed.suffix}`);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    setDisplayValue(`${(0).toFixed(parsed.decimals)}${parsed.suffix}`);
    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, parsed?.target, parsed?.decimals, parsed?.suffix]);

  return <>{displayValue}</>;
};

const StatCard = ({ 
  title, 
  value, 
  subValue,
  kpiTheme,
  delta,
  previousValue,
}: {
  title: string;
  value: string;
  subValue?: string;
  kpiTheme: string;
  delta?: number;
  previousValue?: string;
}) => {
  let Icon = Users;
  if (kpiTheme.includes('productivity')) Icon = TrendingUp;
  else if (kpiTheme === 'csat') Icon = Star;
  else if (kpiTheme === 'sla') Icon = Clock;
  else if (kpiTheme === 'whu') Icon = Activity;
  else if (kpiTheme === 'qa') Icon = CheckCircle;

  const colorMap: Record<string, string> = {
    'productivity': '#E31E24',
    'productivity-avg': '#EF4444',
    'csat': '#F59E0B',
    'qa': '#F59E0B',
    'sla': '#22C55E',
    'whu': '#22C55E',
    'neutral': '#3B82F6',
  };

  const color = colorMap[kpiTheme] || '#3B82F6';
  const isCompareMode = previousValue !== undefined;

  return (
    <div className={`bg-card w-full border border-border rounded-xl p-4 lg:p-5 flex flex-col justify-start hover:shadow-md transition-all ${ isCompareMode ? 'h-36' : 'h-28' } relative overflow-visible`}>
      <div className="flex items-center gap-2 mb-1.5 w-full">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-surface-muted border border-border/50">
          <Icon size={12} style={{ color }} />
        </div>
        <p className="min-w-0 flex-1 text-xs font-semibold text-text-secondary uppercase tracking-wide truncate">{title}</p>
        <FormulaTooltip title={title} />
      </div>

      {/* Current Period */}
      <div className="flex items-baseline justify-between mt-auto">
        <span className="text-[26px] font-bold tracking-tight leading-none" style={{ color }}>
          <CountUpValue value={value} />
        </span>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            delta > 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}>
            {delta > 0 ? '+' : '-'} {Math.abs(delta).toFixed(1)}
          </div>
        )}
      </div>

      {/* SubValue - shown as small grey text below main value */}
      {subValue && !isCompareMode && (
        <div className="mt-0.5">
          <span className="text-[10px] font-medium text-text-muted italic">{subValue}</span>
        </div>
      )}

      {/* Previous Period - always visible when compare mode is ON */}
      {isCompareMode && (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/60">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Prev:</span>
          <span className="text-sm font-semibold text-text-muted">{previousValue}</span>
        </div>
      )}
    </div>
  );
};

// --- Weekly Report Panel ---
const WeeklyReportPanel = ({
  currentStats,
  previousStats,
  previousStats2,
  previousStats3,
  hasPrev2,
  hasPrev3,
  startDate,
  endDate,
  comparisonMode,
}: {
  currentStats: any;
  previousStats: any;
  previousStats2?: any;
  previousStats3?: any;
  hasPrev2?: boolean;
  hasPrev3?: boolean;
  startDate: string;
  endDate: string;
  comparisonMode: 'wow' | 'mom';
}) => {
  const formatDate = (d: string) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
  };

  const getPeriodLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d);
    if (comparisonMode === 'mom') {
      return `${month} ${d.getFullYear()}`;
    }
    const weekNum = Math.ceil(d.getDate() / 7);
    return `W${weekNum} ${month}`;
  };

  const getPrevRange = comparisonMode === 'mom' ? getPreviousMonthPeriod : getPreviousPeriod;
  const prevRange = getPrevRange(startDate, endDate);
  const prev2Range = getPrevRange(prevRange.start, prevRange.end);
  const prev3Range = getPrevRange(prev2Range.start, prev2Range.end);

  const prevStart = (() => {
    return prevRange.start;
  })();
  const prevEnd = (() => {
    return prevRange.end;
  })();
  
  const prev2Start = (() => {
    return prev2Range.start;
  })();
  const prev2End = (() => {
    return prev2Range.end;
  })();
  
  const prev3Start = (() => {
    return prev3Range.start;
  })();
  const prev3End = (() => {
    return prev3Range.end;
  })();

  const showPrev3 = comparisonMode !== 'mom' && Boolean(hasPrev3);

  const rows = [
    { label: 'Total Productivity', curr: formatNum(currentStats.productivity, 0),  prev: formatNum(previousStats.productivity, 0), prev2: formatNum(previousStats2?.productivity || 0, 0), prev3: formatNum(previousStats3?.productivity || 0, 0), delta: currentStats.productivity - previousStats.productivity,   isCount: true,  target: null,  rawCurr: currentStats.productivity,    rawPrev: previousStats.productivity, rawPrev2: previousStats2?.productivity || 0, rawPrev3: previousStats3?.productivity || 0 },
    { label: 'Avg Productivity',   curr: formatNum(currentStats.avgProductivity, 0),prev: formatNum(previousStats.avgProductivity, 0),prev2: formatNum(previousStats2?.avgProductivity || 0, 0),prev3: formatNum(previousStats3?.avgProductivity || 0, 0),delta: currentStats.avgProductivity - previousStats.avgProductivity,isCount: true,  target: 100,   rawCurr: currentStats.avgProductivity, rawPrev: previousStats.avgProductivity, rawPrev2: previousStats2?.avgProductivity || 0, rawPrev3: previousStats3?.avgProductivity || 0 },
    { label: 'CSAT Official',      curr: formatNum(currentStats.csat),        prev: formatNum(previousStats.csat), prev2: formatNum(previousStats2?.csat || 0), prev3: formatNum(previousStats3?.csat || 0), delta: currentStats.csat - previousStats.csat,                     isCount: false, target: 3.75,    rawCurr: currentStats.csat,            rawPrev: previousStats.csat, rawPrev2: previousStats2?.csat || 0, rawPrev3: previousStats3?.csat || 0 },
    { label: 'CSAT SC Full',       curr: formatNum(currentStats.csatScFull) + '%',  prev: formatNum(previousStats.csatScFull) + '%', prev2: formatNum(previousStats2?.csatScFull || 0) + '%', prev3: formatNum(previousStats3?.csatScFull || 0) + '%', delta: currentStats.csatScFull - previousStats.csatScFull,         isCount: false, target: 75,    rawCurr: currentStats.csatScFull,      rawPrev: previousStats.csatScFull, rawPrev2: previousStats2?.csatScFull || 0, rawPrev3: previousStats3?.csatScFull || 0 },
    { label: 'CSAT SC After Takeout', curr: formatNum(currentStats.csatScFair) + '%', prev: formatNum(previousStats.csatScFair) + '%', prev2: formatNum(previousStats2?.csatScFair || 0) + '%', prev3: formatNum(previousStats3?.csatScFair || 0) + '%', delta: currentStats.csatScFair - previousStats.csatScFair, isCount: false, target: 92, rawCurr: currentStats.csatScFair, rawPrev: previousStats.csatScFair, rawPrev2: previousStats2?.csatScFair || 0, rawPrev3: previousStats3?.csatScFair || 0 },
    { label: 'SLA 1 Menit',        curr: formatNum(currentStats.sla1m) + '%',       prev: formatNum(previousStats.sla1m) + '%', prev2: formatNum(previousStats2?.sla1m || 0) + '%', prev3: formatNum(previousStats3?.sla1m || 0) + '%', delta: currentStats.sla1m - previousStats.sla1m,                   isCount: false, target: 92,    rawCurr: currentStats.sla1m,           rawPrev: previousStats.sla1m, rawPrev2: previousStats2?.sla1m || 0, rawPrev3: previousStats3?.sla1m || 0 },
    { label: 'SLA 3 Menit',        curr: formatNum(currentStats.sla3m) + '%',       prev: formatNum(previousStats.sla3m) + '%', prev2: formatNum(previousStats2?.sla3m || 0) + '%', prev3: formatNum(previousStats3?.sla3m || 0) + '%', delta: currentStats.sla3m - previousStats.sla3m,                   isCount: false, target: 96,    rawCurr: currentStats.sla3m,           rawPrev: previousStats.sla3m, rawPrev2: previousStats2?.sla3m || 0, rawPrev3: previousStats3?.sla3m || 0 },
    { label: 'WHU (%)',             curr: formatNum(currentStats.whu) + '%',         prev: formatNum(previousStats.whu) + '%', prev2: formatNum(previousStats2?.whu || 0) + '%', prev3: formatNum(previousStats3?.whu || 0) + '%', delta: currentStats.whu - previousStats.whu,                       isCount: false, target: 96,    rawCurr: currentStats.whu,             rawPrev: previousStats.whu, rawPrev2: previousStats2?.whu || 0, rawPrev3: previousStats3?.whu || 0 },
    { label: 'QA Score',           curr: formatNum(currentStats.qa) + '%',          prev: formatNum(previousStats.qa) + '%', prev2: formatNum(previousStats2?.qa || 0) + '%', prev3: formatNum(previousStats3?.qa || 0) + '%', delta: currentStats.qa - previousStats.qa,                         isCount: false, target: 92,    rawCurr: currentStats.qa,              rawPrev: previousStats.qa, rawPrev2: previousStats2?.qa || 0, rawPrev3: previousStats3?.qa || 0 },
    { label: 'Attendance',         curr: formatNum(currentStats.attendance) + '%',  prev: formatNum(previousStats.attendance) + '%', prev2: formatNum(previousStats2?.attendance || 0) + '%', prev3: formatNum(previousStats3?.attendance || 0) + '%', delta: currentStats.attendance - previousStats.attendance,         isCount: false, target: 95,    rawCurr: currentStats.attendance,      rawPrev: previousStats.attendance, rawPrev2: previousStats2?.attendance || 0, rawPrev3: previousStats3?.attendance || 0 },
  ];

  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={reportRef} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6 relative group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border bg-surface/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              {comparisonMode === 'mom' ? 'Monthly Performance Report' : 'Weekly Performance Report'}
            </h2>
            <p className="text-[10px] text-text-muted mt-0.5">Perbandingan antar periode</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap justify-end mt-2 sm:mt-0">
          <div
            className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-1 rounded-full font-bold whitespace-nowrap"
            title={`${formatDate(startDate)} - ${formatDate(endDate)}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            {getPeriodLabel(endDate)}
          </div>
          <div
            className="flex items-center gap-1.5 bg-surface-muted text-text-muted px-2 py-1 rounded-full font-semibold whitespace-nowrap"
            title={`${formatDate(prevStart)} - ${formatDate(prevEnd)}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted"></span>
            {getPeriodLabel(prevEnd)}
          </div>
          {hasPrev2 && (
            <div
              className="flex items-center gap-1.5 bg-surface-muted text-text-muted px-2 py-1 rounded-full font-semibold whitespace-nowrap"
              title={`${formatDate(prev2Start)} - ${formatDate(prev2End)}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted"></span>
              {getPeriodLabel(prev2End)}
            </div>
          )}
          {showPrev3 && (
            <div
              className="flex items-center gap-1.5 bg-surface-muted text-text-muted px-2 py-1 rounded-full font-semibold whitespace-nowrap"
              title={`${formatDate(prev3Start)} - ${formatDate(prev3End)}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted"></span>
              {getPeriodLabel(prev3End)}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">KPI</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">Target</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getPeriodLabel(endDate)}</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getPeriodLabel(prevEnd)}</th>
              {hasPrev2 && <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getPeriodLabel(prev2End)}</th>}
              {showPrev3 && <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getPeriodLabel(prev3End)}</th>}
              <th className="text-right px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isUp = row.delta > 0;
              const isFlat = Math.abs(row.delta) < 0.01;
              // Determine color: if no target, use neutral; otherwise green if meets target, red if not
              const meetsTarget = row.target === null ? null : row.rawCurr >= row.target;
              const currColor = meetsTarget === null
                ? 'text-text-primary'
                : meetsTarget ? 'text-success' : 'text-danger';

              const meetsPrevTarget = row.target === null ? null : row.rawPrev >= row.target;
              const prevColor = meetsPrevTarget === null
                ? 'text-text-primary'
                : meetsPrevTarget ? 'text-success' : 'text-danger';
                
              const meetsPrev2Target = row.target === null ? null : row.rawPrev2 >= row.target;
              const prev2Color = meetsPrev2Target === null
                ? 'text-text-primary'
                : meetsPrev2Target ? 'text-success' : 'text-danger';
                
              const meetsPrev3Target = row.target === null ? null : row.rawPrev3 >= row.target;
              const prev3Color = meetsPrev3Target === null
                ? 'text-text-primary'
                : meetsPrev3Target ? 'text-success' : 'text-danger';

              return (
                <tr key={i} className={`border-b border-border/50 transition-colors ${ i % 2 === 0 ? 'bg-surface/20' : '' }`}>
                  <td className="px-5 py-3 font-semibold text-text-primary text-[13px] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      <FormulaTooltip title={row.label} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] font-medium text-text-muted">
                    {row.target !== null ? row.label === 'CSAT Official' ? formatNum(row.target) : `${row.target}%` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-[14px] ${currColor}`}>
                    {row.curr}
                  </td>
                  <td className={`px-4 py-3 text-right text-[14px] font-bold ${prevColor}`}>{row.prev}</td>
                  {hasPrev2 && <td className={`px-4 py-3 text-right text-[14px] font-bold ${prev2Color}`}>{row.prev2}</td>}
                  {showPrev3 && <td className={`px-4 py-3 text-right text-[14px] font-bold ${prev3Color}`}>{row.prev3}</td>}
                  <td className="px-5 py-3 text-right">
                    {isFlat ? (
                      <span className="text-[11px] font-semibold text-text-muted">-</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full ${
                        isUp ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                      }`}>
                        {isUp ? '+' : '-'}
                        {Math.abs(row.delta).toFixed(row.isCount ? 0 : 2)}
                        {row.isCount ? '' : ' poin'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


