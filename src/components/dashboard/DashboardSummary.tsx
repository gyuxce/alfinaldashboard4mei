import React, { useMemo, useState, useRef, useEffect } from "react";
import { AgentKPI } from "../../lib/dataProcessor";
import { formatNum, getKpiColor, parseDateForSort } from "../../lib/utils";
import { Activity, Star, Clock, CheckCircle, TrendingUp, Smile, Users } from "lucide-react";
import { useStore } from "../../store";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardAgentTable } from "./DashboardAgentTable";

interface Props {
  data: AgentKPI[];
  previousData?: AgentKPI[];
  previousData2?: AgentKPI[];
  previousData3?: AgentKPI[];
}

export const DashboardSummary: React.FC<Props> = ({ data, previousData = [], previousData2 = [], previousData3 = [] }) => {
  const [search, setSearch] = useState("");
  const dict = useStore((state) => state.agentDictionary);
  const { startDate, endDate, setDateRange } = useStore();

  const tickerRef = useRef<HTMLDivElement>(null);
  const [tickerDuration, setTickerDuration] = useState(30);

  const tableData = useMemo(() => {
    return data.filter(
      (a) =>
        a.csId.toLowerCase().includes(search.toLowerCase()) ||
        (a.name || "").toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  const topAgentsList = useMemo(() => {
    const aList: { name: string; score: number }[] = [];
    tableData.forEach((agent) => {
      // 1. QA
      const qaOriginal =
        agent.qaScoreCount > 0 ? agent.qaScoreSum / agent.qaScoreCount : null;
      const qa_pct = qaOriginal;

      // 2. Productivity
      const prodOriginal =
        agent.targetQuota > 0
          ? (agent.productivityTotal / agent.targetQuota) * 100
          : null;
      const prod_pct =
        prodOriginal !== null ? Math.min(prodOriginal, 100) : null;

      // 3. CSAT
      const csatOriginal = agent.csatAsli;
      let csat_pct = null;
      if (csatOriginal !== null && !isNaN(csatOriginal)) {
        if (csatOriginal > 5) {
          csat_pct = csatOriginal;
        } else {
          csat_pct = (csatOriginal / 5) * 100;
        }
      }

      // Calculate points
      const qa_points = qa_pct !== null ? (qa_pct / 100) * 50 : null;
      const prod_points = prod_pct !== null ? (prod_pct / 100) * 20 : null;
      const csat_points = csat_pct !== null ? (csat_pct / 100) * 20 : null;
      const fixed_points = 10;

      const kpiList = [
        { points: qa_points, maxWeight: 50, valid: qa_points !== null },
        { points: prod_points, maxWeight: 20, valid: prod_points !== null },
        { points: csat_points, maxWeight: 20, valid: csat_points !== null },
      ];

      const validKpis = kpiList.filter((k) => k.valid);

      let compScore = null;
      if (validKpis.length > 0) {
        const totalAvailableWeight = validKpis.reduce(
          (acc, k) => acc + k.maxWeight,
          0
        );
        const rawWeightedSum = validKpis.reduce(
          (acc, k) => acc + (k.points as number),
          0
        );
        const scaledScore = (rawWeightedSum / totalAvailableWeight) * 90;
        compScore = scaledScore + fixed_points;
      }

      if (compScore !== null) {
        aList.push({
          name: agent.name && agent.name !== "-" ? agent.name : agent.csId,
          score: compScore,
        });
      }
    });

    aList.sort((a, b) => b.score - a.score);
    return aList.slice(0, 5);
  }, [tableData]);

  useEffect(() => {
    let observer: ResizeObserver;
    if (tickerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
           const distance = entry.target.scrollWidth / 2;
           setTickerDuration(Math.max(distance / 50, 1));
        }
      });
      observer.observe(tickerRef.current);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [topAgentsList]);

  const stats = useMemo(() => {
    const calculate = (dataset: AgentKPI[]) => {
      let totalProd = 0, sumManDays = 0, sumCsat = 0, sumSla1m = 0, sumSla3m = 0, sumWhu = 0;
      let sumCsatScFull = 0, countCsatScFull = 0, sumCsatScFair = 0, countCsatScFair = 0;
      let sumQa = 0, countQa = 0, csatCount = 0, slaCount = 0, whuCount = 0, attPresence = 0, attDuty = 0;

      dataset.forEach((d) => {
        totalProd += d.productivityTotal;
        sumManDays += d.manDays;
        if (d.csatAsli !== null) { sumCsat += d.csatAsli; csatCount++; }
        if (d.sla1m !== null) sumSla1m += d.sla1m;
        if (d.sla3m !== null) { sumSla3m += d.sla3m; slaCount++; }
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
        csat: csatCount > 0 ? sumCsat / csatCount : 0,
        csatPoin: csatCount > 0 ? (sumCsat / csatCount / 100) * 5 : 0,  // convert % back to 1-5 scale
        csatScFull: countCsatScFull > 0 ? (sumCsatScFull / countCsatScFull) * 100 : 0,
        csatScFullCount: countCsatScFull,
        csatScFair: countCsatScFair > 0 ? (sumCsatScFair / countCsatScFair) * 100 : 0,
        csatScFairCount: countCsatScFair,
        sla1m: slaCount > 0 ? sumSla1m / slaCount : 0,
        sla3m: slaCount > 0 ? sumSla3m / slaCount : 0,
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
        if (csatEntry && csatEntry.value) { sumCsat += csatEntry.value; countCsat++; }

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
        <div className="text-warning p-4 rounded border border-warning/20 text-sm">
          Belum ada data. Silakan upload file CSV di File Center.
        </div>
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
              value={formatNum(currentStats.csat) + "%"}
              subValue={currentStats.csatPoin > 0 ? formatNum(currentStats.csatPoin, 2) + " poin" : undefined}
              delta={getDelta(currentStats.csat, previousStats.csat)}
              previousValue={isComparisonEnabled && previousData.length ? formatNum(previousStats.csat) + "%" : undefined}
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
              title="CSAT SC Takeout"
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
            />
          )}

          <DashboardCharts stats={currentStats} dailyTrend={dailyTrend} />
          <DashboardAgentTable tableData={tableData} />
        </>
      )}
    </div>
  );
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
    <div className={`bg-card w-full border border-border rounded-xl p-4 lg:p-5 flex flex-col justify-start hover:shadow-md transition-all ${ isCompareMode ? 'h-36' : 'h-28' } relative overflow-hidden`}>
      <div className="flex items-center gap-2 mb-1.5 w-full">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-surface-muted border border-border/50">
          <Icon size={12} style={{ color }} />
        </div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide truncate">{title}</p>
      </div>

      {/* Current Period */}
      <div className="flex items-baseline justify-between mt-auto">
        <span className="text-[26px] font-bold tracking-tight leading-none" style={{ color }}>
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            delta > 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
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
}: {
  currentStats: any;
  previousStats: any;
  previousStats2?: any;
  previousStats3?: any;
  hasPrev2?: boolean;
  hasPrev3?: boolean;
  startDate: string;
  endDate: string;
}) => {
  const formatDate = (d: string) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
  };

  const getWeekLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d);
    const weekNum = Math.ceil(d.getDate() / 7);
    return `Week ${weekNum} ${month}`;
  };

  // Compute previous period range label
  const prevStart = (() => {
    if (!startDate || !endDate) return '';
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    const ps = new Date(pe); ps.setDate(ps.getDate() - diff + 1);
    return ps.toISOString().split('T')[0];
  })();
  const prevEnd = (() => {
    if (!startDate) return '';
    const s = new Date(startDate);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    return pe.toISOString().split('T')[0];
  })();

  const diff = startDate && endDate ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1 : 0;
  
  const prev2Start = (() => {
    if (!startDate || !prevStart) return '';
    const d = new Date(prevStart); d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  })();
  const prev2End = (() => {
    if (!startDate || !prevEnd) return '';
    const d = new Date(prevEnd); d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  })();
  
  const prev3Start = (() => {
    if (!startDate || !prev2Start) return '';
    const d = new Date(prev2Start); d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  })();
  const prev3End = (() => {
    if (!startDate || !prev2End) return '';
    const d = new Date(prev2End); d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  })();

  const rows = [
    { label: 'Total Productivity', curr: formatNum(currentStats.productivity, 0),  prev: formatNum(previousStats.productivity, 0), prev2: formatNum(previousStats2?.productivity || 0, 0), prev3: formatNum(previousStats3?.productivity || 0, 0), delta: currentStats.productivity - previousStats.productivity,   isCount: true,  target: null,  rawCurr: currentStats.productivity,    rawPrev: previousStats.productivity, rawPrev2: previousStats2?.productivity || 0, rawPrev3: previousStats3?.productivity || 0 },
    { label: 'Avg Productivity',   curr: formatNum(currentStats.avgProductivity, 0),prev: formatNum(previousStats.avgProductivity, 0),prev2: formatNum(previousStats2?.avgProductivity || 0, 0),prev3: formatNum(previousStats3?.avgProductivity || 0, 0),delta: currentStats.avgProductivity - previousStats.avgProductivity,isCount: true,  target: 100,   rawCurr: currentStats.avgProductivity, rawPrev: previousStats.avgProductivity, rawPrev2: previousStats2?.avgProductivity || 0, rawPrev3: previousStats3?.avgProductivity || 0 },
    { label: 'CSAT Official',      curr: formatNum(currentStats.csat) + '%',        prev: formatNum(previousStats.csat) + '%', prev2: formatNum(previousStats2?.csat || 0) + '%', prev3: formatNum(previousStats3?.csat || 0) + '%', delta: currentStats.csat - previousStats.csat,                     isCount: false, target: 75,    rawCurr: currentStats.csat,            rawPrev: previousStats.csat, rawPrev2: previousStats2?.csat || 0, rawPrev3: previousStats3?.csat || 0 },
    { label: 'CSAT SC Full',       curr: formatNum(currentStats.csatScFull) + '%',  prev: formatNum(previousStats.csatScFull) + '%', prev2: formatNum(previousStats2?.csatScFull || 0) + '%', prev3: formatNum(previousStats3?.csatScFull || 0) + '%', delta: currentStats.csatScFull - previousStats.csatScFull,         isCount: false, target: 75,    rawCurr: currentStats.csatScFull,      rawPrev: previousStats.csatScFull, rawPrev2: previousStats2?.csatScFull || 0, rawPrev3: previousStats3?.csatScFull || 0 },
    { label: 'CSAT SC Takeout',    curr: formatNum(currentStats.csatScFair) + '%',  prev: formatNum(previousStats.csatScFair) + '%', prev2: formatNum(previousStats2?.csatScFair || 0) + '%', prev3: formatNum(previousStats3?.csatScFair || 0) + '%', delta: currentStats.csatScFair - previousStats.csatScFair,         isCount: false, target: 92,    rawCurr: currentStats.csatScFair,      rawPrev: previousStats.csatScFair, rawPrev2: previousStats2?.csatScFair || 0, rawPrev3: previousStats3?.csatScFair || 0 },
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
              Weekly Performance Report
            </h2>
            <p className="text-[10px] text-text-muted mt-0.5">Perbandingan antar periode</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] flex-wrap justify-end mt-2 sm:mt-0">
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            {getWeekLabel(endDate)}: {formatDate(startDate)} – {formatDate(endDate)}
          </div>
          <div className="flex items-center gap-1.5 bg-surface-muted text-text-muted px-2.5 py-1 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted"></span>
            {getWeekLabel(prevEnd)}: {formatDate(prevStart)} – {formatDate(prevEnd)}
          </div>
          {hasPrev2 && (
            <div className="flex items-center gap-1.5 bg-surface-muted/50 text-text-muted/70 px-2.5 py-1 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50"></span>
              {getWeekLabel(prev2End)}: {formatDate(prev2Start)} – {formatDate(prev2End)}
            </div>
          )}
          {hasPrev3 && (
            <div className="flex items-center gap-1.5 bg-surface-muted/30 text-text-muted/50 px-2.5 py-1 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/30"></span>
              {getWeekLabel(prev3End)}: {formatDate(prev3Start)} – {formatDate(prev3End)}
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
              <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getWeekLabel(endDate)}</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">{getWeekLabel(prevEnd)}</th>
              {hasPrev2 && <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted/70 uppercase tracking-widest">{getWeekLabel(prev2End)}</th>}
              {hasPrev3 && <th className="text-right px-4 py-3 text-[11px] font-bold text-text-muted/50 uppercase tracking-widest">{getWeekLabel(prev3End)}</th>}
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
                ? 'text-text-secondary'
                : meetsPrevTarget ? 'text-success/80' : 'text-danger/80';
                
              const meetsPrev2Target = row.target === null ? null : row.rawPrev2 >= row.target;
              const prev2Color = meetsPrev2Target === null
                ? 'text-text-secondary/70'
                : meetsPrev2Target ? 'text-success/60' : 'text-danger/60';
                
              const meetsPrev3Target = row.target === null ? null : row.rawPrev3 >= row.target;
              const prev3Color = meetsPrev3Target === null
                ? 'text-text-secondary/50'
                : meetsPrev3Target ? 'text-success/40' : 'text-danger/40';

              return (
                <tr key={i} className={`border-b border-border/50 transition-colors ${ i % 2 === 0 ? 'bg-surface/20' : '' }`}>
                  <td className="px-5 py-3 font-semibold text-text-primary text-[13px] whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] font-medium text-text-muted">
                    {row.target !== null ? `${row.target}%` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-[15px] ${currColor}`}>
                    {row.curr}
                  </td>
                  <td className={`px-4 py-3 text-right text-[13px] font-semibold ${prevColor}`}>{row.prev}</td>
                  {hasPrev2 && <td className={`px-4 py-3 text-right text-[13px] font-medium ${prev2Color}`}>{row.prev2}</td>}
                  {hasPrev3 && <td className={`px-4 py-3 text-right text-[13px] font-medium ${prev3Color}`}>{row.prev3}</td>}
                  <td className="px-5 py-3 text-right">
                    {isFlat ? (
                      <span className="text-[11px] font-semibold text-text-muted">—</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full ${
                        isUp ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                      }`}>
                        {isUp ? '▲' : '▼'}
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


