import React, { useMemo, useState, useRef, useEffect } from "react";
import { AgentKPI } from "../../lib/dataProcessor";
import { formatNum, getKpiColor } from "../../lib/utils";
import { Activity, Star, Clock, CheckCircle, TrendingUp, Smile, Users } from "lucide-react";
import { useStore } from "../../store";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardAgentTable } from "./DashboardAgentTable";

interface Props {
  data: AgentKPI[];
}

export const DashboardSummary: React.FC<Props> = ({ data }) => {
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
    let totalProd = 0;
    let sumManDays = 0;
    let sumCsat = 0;
    let sumSla3m = 0;
    let sumSla1m = 0;
    let sumWhu = 0;

    let sumCsatScFull = 0,
      countCsatScFull = 0;
    let sumCsatScFair = 0,
      countCsatScFair = 0;
    let sumQa = 0,
      countQa = 0;

    let csatCount = 0;
    let slaCount = 0;
    let whuCount = 0;

    let attPresence = 0;
    let attDuty = 0;

    data.forEach((d) => {
      totalProd += d.productivityTotal;
      sumManDays += d.manDays;
      if (d.csatAsli !== null) {
        sumCsat += d.csatAsli;
        csatCount++;
      }
      if (d.sla1m !== null) {
        sumSla1m += d.sla1m;
      }
      if (d.sla3m !== null) {
        sumSla3m += d.sla3m;
        slaCount++;
      }
      if (d.whu !== null) {
        sumWhu += d.whu;
        whuCount++;
      }

      sumCsatScFull += d.csatScFullScore;
      countCsatScFull += d.csatScFullCount;

      sumCsatScFair += d.csatScFairScore;
      countCsatScFair += d.csatScFairCount;

      sumQa += d.qaScoreSum;
      countQa += d.qaScoreCount;

      attPresence += d.attendancePresence || 0;
      attDuty += d.attendanceDuty || 0;
    });

    return {
      productivity: totalProd,
      avgProductivity: sumManDays > 0 ? totalProd / sumManDays : 0,
      csat: csatCount > 0 ? sumCsat / csatCount : 0,
      csatScFull: countCsatScFull > 0 ? sumCsatScFull / countCsatScFull : 0,
      csatScFair: countCsatScFair > 0 ? sumCsatScFair / countCsatScFair : 0,
      sla1m: slaCount > 0 ? sumSla1m / slaCount : 0,
      sla3m: slaCount > 0 ? sumSla3m / slaCount : 0,
      whu: whuCount > 0 ? sumWhu / whuCount : 0,
      qa: countQa > 0 ? sumQa / countQa : 0,
      attendance: attDuty > 0 ? (attPresence / attDuty) * 100 : 0,
      agentsCount: data.length,
    };
  }, [data]);

  const dailyTrend = useMemo(() => {
    const datesSet = new Set<string>();
    const rawToNormDate = new Map<string, string>();

    data.forEach((a) => {
      a.dailyHistory.schedule.forEach((s) => {
        if (s.normDate) {
          datesSet.add(s.normDate);
          rawToNormDate.set(s.date, s.normDate);
        } else {
          datesSet.add(s.date);
        }
      });
    });
    const dates = Array.from(datesSet).sort();

    return dates.map((date) => {
      let totalProd = 0;

      let sumCsat = 0,
        countCsat = 0;
      let sumCsatFull = 0,
        countCsatFull = 0;
      let sumCsatFair = 0,
        countCsatFair = 0;

      let sumSla1m = 0,
        countSla1m = 0;
      let sumSla3m = 0,
        countSla3m = 0;
      let sumWhu = 0,
        countWhu = 0;
      let sumQa = 0,
        countQa = 0;

      let totalAttendancePresence = 0;
      let totalAttendanceDuty = 0;

      data.forEach((a) => {
        // Prod
        const prodEntry = a.dailyHistory.productivity.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (prodEntry && prodEntry.value) totalProd += prodEntry.value;

        // CSAT Asli
        const csatEntry = a.dailyHistory.csat.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (csatEntry && csatEntry.value) {
          sumCsat += csatEntry.value;
          countCsat++;
        }

        // Sla1m
        const sla1mEntry = a.dailyHistory.sla1m.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (sla1mEntry && sla1mEntry.value) {
          sumSla1m += sla1mEntry.value;
          countSla1m++;
        }

        // Sla3m
        const sla3mEntry = a.dailyHistory.sla3m.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (sla3mEntry && sla3mEntry.value) {
          sumSla3m += sla3mEntry.value;
          countSla3m++;
        }

        // WHU
        const whuEntry = a.dailyHistory.whu.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (whuEntry && whuEntry.value) {
          sumWhu += whuEntry.value;
          countWhu++;
        }

        // QA
        if (a.qaHistory && a.qaHistory.length > 0) {
          const qaEntries = a.qaHistory.filter(
            (h) => (h.normDate || rawToNormDate.get(h.date) || h.date) === date,
          );
          qaEntries.forEach((qaEntry) => {
            if (qaEntry && qaEntry.score !== undefined) {
              sumQa += qaEntry.score;
              countQa++;
            }
          });
        }

        // CSAT SC Full
        const sysCsatFullEntry = a.dailyHistory.csatScFull.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (sysCsatFullEntry && sysCsatFullEntry.count > 0) {
          sumCsatFull += sysCsatFullEntry.score;
          countCsatFull += sysCsatFullEntry.count;
        }

        const sysCsatFairEntry = a.dailyHistory.csatScFair.find(
          (h) => (rawToNormDate.get(h.date) || h.date) === date,
        );
        if (sysCsatFairEntry && sysCsatFairEntry.count > 0) {
          sumCsatFair += sysCsatFairEntry.score;
          countCsatFair += sysCsatFairEntry.count;
        }

        // Attendance
        const schedEntry = a.dailyHistory.schedule.find(
          (s) => (s.normDate || s.date) === date,
        );
        if (schedEntry) {
          if (schedEntry.isManDay || schedEntry.status === "PULLOUT")
            totalAttendanceDuty += 1;
          const isNumber =
            !isNaN(parseFloat(schedEntry.status.replace(",", "."))) &&
            schedEntry.status !== "";
          if (isNumber || schedEntry.status === "PULLOUT")
            totalAttendancePresence += 1;
        }
      });

      // Formatting date
      let dateLabel = date;
      const parts = date.split("-");
      if (parts.length === 3) {
        // YYYY-MM-DD
        const d = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
        if (!isNaN(d.getTime())) {
          dateLabel = new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
          }).format(d);
        }
      }

      return {
        date,
        dateLabel,
        productivity: totalProd,
        csat: countCsat > 0 ? Number((sumCsat / countCsat).toFixed(2)) : null,
        csatScFull:
          countCsatFull > 0
            ? Number((((sumCsatFull / countCsatFull) * 100) / 5).toFixed(2))
            : null,
        csatScFair:
          countCsatFair > 0
            ? Number((((sumCsatFair / countCsatFair) * 100) / 5).toFixed(2))
            : null,
        sla1m:
          countSla1m > 0 ? Number((sumSla1m / countSla1m).toFixed(2)) : null,
        sla3m:
          countSla3m > 0 ? Number((sumSla3m / countSla3m).toFixed(2)) : null,
        whu: countWhu > 0 ? Number((sumWhu / countWhu).toFixed(2)) : null,
        qa: countQa > 0 ? Number((sumQa / countQa).toFixed(2)) : null,
        attendance:
          totalAttendanceDuty > 0
            ? Number(
                ((totalAttendancePresence / totalAttendanceDuty) * 100).toFixed(
                  2,
                ),
              )
            : null,
        avgProductivity:
          totalAttendanceDuty > 0
            ? Number((totalProd / totalAttendanceDuty).toFixed(2))
            : null,
      };
    });
  }, [data]);

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
          {topAgentsList.length > 0 && (
            <div className="relative flex overflow-hidden bg-surface-muted rounded-xl border border-border/50 mb-2 py-2.5 group">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none rounded-l-xl" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none rounded-r-xl" />
              <div 
                ref={tickerRef}
                className="flex whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused]"
                style={{ animationDuration: `${tickerDuration}s` }}
              >
                <div className="flex items-center shrink-0 pr-12 text-sm font-semibold tracking-wide text-text-primary">
                  <span className="mr-8" style={{ color: '#E31E24' }}>🏆 TOP AGENTS:</span>
                  {topAgentsList.map((agent, i) => {
                    const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
                    return (
                      <span key={i} className="flex items-center mr-8">
                        <span className="mr-1">{medals[i]} {i + 1}.</span>
                        <span style={{ color: '#E31E24' }}>{agent.name}</span>
                        <span className="text-text-muted ml-1 font-normal">(Score: {agent.score.toFixed(0)})</span>
                        {i < topAgentsList.length - 1 && <span className="ml-8 text-border">|</span>}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center shrink-0 pr-12 text-sm font-semibold tracking-wide text-text-primary">
                  <span className="mr-8" style={{ color: '#E31E24' }}>🏆 TOP AGENTS:</span>
                  {topAgentsList.map((agent, i) => {
                    const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
                    return (
                      <span key={i} className="flex items-center mr-8 flex-shrink-0">
                        <span className="mr-1">{medals[i]} {i + 1}.</span>
                        <span style={{ color: '#E31E24' }}>{agent.name}</span>
                        <span className="text-text-muted ml-1 font-normal">(Score: {agent.score.toFixed(0)})</span>
                        {i < topAgentsList.length - 1 && <span className="ml-8 text-border">|</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Productivity"
              value={formatNum(stats.productivity, 0)}
              kpiTheme="productivity"
            />
            <StatCard
              title="Avg Productivity"
              value={formatNum(stats.avgProductivity, 0)}
              kpiTheme="productivity-avg"
            />
            <StatCard
              title="CSAT Asli (Official)"
              value={formatNum(stats.csat)}
              kpiTheme="csat"
            />
            <StatCard
              title="CSAT SC Full"
              value={formatNum((stats.csatScFull * 100) / 5) + "%"}
              subValue={"(" + formatNum(stats.csatScFull) + ")"}
              kpiTheme="csat"
            />
            <StatCard
              title="CSAT SC Fair"
              value={formatNum((stats.csatScFair * 100) / 5) + "%"}
              subValue={"(" + formatNum(stats.csatScFair) + ")"}
              kpiTheme="csat"
            />
            <StatCard
              title="WHU (%)"
              value={formatNum(stats.whu) + "%"}
              kpiTheme="whu"
            />
            <StatCard
              title="SLA 1 Menit"
              value={formatNum(stats.sla1m) + "%"}
              kpiTheme="sla"
            />
            <StatCard
              title="SLA 3 Menit"
              value={formatNum(stats.sla3m) + "%"}
              kpiTheme="sla"
            />
            <StatCard
              title="QA Score"
              value={formatNum(stats.qa) + "%"}
              kpiTheme="qa"
            />
            <StatCard
              title="Avg Attendance"
              value={formatNum(stats.attendance, 1) + "%"}
              kpiTheme="neutral"
            />
          </div>

                    <DashboardCharts stats={stats} dailyTrend={dailyTrend} />
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
}: {
  title: string;
  value: string;
  subValue?: string;
  kpiTheme: string;
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

  return (
    <div className="bg-card w-full border border-border rounded-xl p-4 lg:p-5 flex flex-col justify-start hover:shadow-md transition-shadow h-28">
      <div className="flex items-center gap-2 mb-2 w-full">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-surface-muted border border-border/50"
        >
          <Icon size={12} style={{ color }} />
        </div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide truncate">
          {title}
        </p>
      </div>
      <div className="flex items-baseline gap-2 mt-auto">
        <span className="text-[28px] font-bold tracking-tight leading-none" style={{ color }}>
          {value}
        </span>
        {subValue && (
          <span className="text-sm font-medium text-text-muted mb-0.5">{subValue}</span>
        )}
      </div>
    </div>
  );
};
