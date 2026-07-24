import React, { useMemo, useState } from "react";
import { AgentKPI, normalizeDateStr } from "../../lib/dataProcessor";
import { formatNum, getKpiColor } from "../../lib/utils";
import { useStore } from "../../store";
import {
  Search,
  Activity,
  AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from "recharts";
import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from "../ui/EmptyState";

export const ProductivityDetail: React.FC<{ 
  data: AgentKPI[];
  previousData?: AgentKPI[];
  previousData2?: AgentKPI[];
  previousData3?: AgentKPI[];
}> = ({
  data,
  previousData = [],
  previousData2 = [],
  previousData3 = [],
}) => {
  const [search, setSearch] = useState("");
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const dict = useStore((state) => state.agentDictionary);
  const { startDate, endDate, setDateRange, isComparisonEnabled, comparisonMode } = useStore();

  const filteredData = useMemo(() => {
    return data.filter((a) => {
      const matchSearch =
        a.csId.toLowerCase().includes(search.toLowerCase()) ||
        (a.name || "").toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      return matchSearch && matchTL && a.productivityBase > 0;
    });
  }, [data, search, filterTL]);

  // One column per calendar day (normDate), preferring schedule date labels
  const uniqueDates = useMemo(() => {
    const byNorm = new Map<string, string>();

    filteredData.forEach((a) => {
      a.dailyHistory?.schedule?.forEach((s) => {
        const nd = s.normDate || normalizeDateStr(s.date);
        if (nd && !byNorm.has(nd)) byNorm.set(nd, s.date);
      });
      a.dailyHistory?.productivity?.forEach((h) => {
        const nd = normalizeDateStr(h.date);
        if (nd && !byNorm.has(nd)) byNorm.set(nd, h.date);
      });
    });

    return Array.from(byNorm.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, date]) => date);
  }, [filteredData]);

  const tableData = useMemo(() => {
    let sorted = [...filteredData];
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        const getLocalGap = (agent: AgentKPI) =>
          agent.productivityTotal - agent.manDays * 100;

        const getLocalAverage = (agent: AgentKPI) =>
          agent.manDays > 0 ? agent.productivityTotal / agent.manDays : 0;

        switch (sortConfig.key) {
          case 'name':
            aVal = a.name || a.csId;
            bVal = b.name || b.csId;
            break;
          case 'bpo':
            aVal = a.bpo || '';
            bVal = b.bpo || '';
            break;
          case 'teamLeader':
            aVal = a.teamLeader || '';
            bVal = b.teamLeader || '';
            break;
          case 'average':
            aVal = getLocalAverage(a);
            bVal = getLocalAverage(b);
            break;
          case 'gap':
            aVal = getLocalGap(a);
            bVal = getLocalGap(b);
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredData, sortConfig]);

  // --- CUSTOM BENTO DASHBOARD WIDGETS ---
  const {
    totalChat,
    totalAvg,
    totalManDays,
    activeAgents,
    overTarget,
    underTarget,
    totalQuota,
    quotaAchievement,
    totalGap,
    bpoList,
    tlList,
  } = useMemo(() => {
    const filteredForWidgets = data.filter((a) => a.productivityBase > 0);

    let sumChat = 0;
    let sumManDays = 0;
    let sumQuota = 0;
    let sumGap = 0;
    let overTarget = 0;
    let underTarget = 0;

    const bpoStats: Record<
      string,
      { sum: number; mdays: number; quota: number; gap: number }
    > = {};
    const tlStats: Record<
      string,
      { sum: number; mdays: number; quota: number; gap: number }
    > = {};

    filteredForWidgets.forEach((agent) => {
      sumChat += agent.productivityTotal;
      const localManDays = agent.manDays;
      sumManDays += localManDays;
      const localTargetQuota = localManDays * 100;
      sumQuota += localTargetQuota;
      const localGap = agent.productivityTotal - localTargetQuota;
      sumGap += localGap;

      const localAvg =
        localManDays > 0 ? agent.productivityTotal / localManDays : 0;
      if (localAvg >= 100) overTarget++;
      else if (localAvg > 0 && localAvg < 70) underTarget++;

      const bpo = agent.bpo || "-";
      if (!bpoStats[bpo])
        bpoStats[bpo] = { sum: 0, mdays: 0, quota: 0, gap: 0 };
      bpoStats[bpo].sum += agent.productivityTotal;
      bpoStats[bpo].mdays += localManDays;
      bpoStats[bpo].quota += localTargetQuota;
      bpoStats[bpo].gap += localGap;

      const tl = agent.teamLeader || "-";
      if (!tlStats[tl]) tlStats[tl] = { sum: 0, mdays: 0, quota: 0, gap: 0 };
      tlStats[tl].sum += agent.productivityTotal;
      tlStats[tl].mdays += localManDays;
      tlStats[tl].quota += localTargetQuota;
      tlStats[tl].gap += localGap;
    });

    const bpoArr = Object.entries(bpoStats)
      .map(([bpo, s]) => ({
        bpo,
        avg: s.mdays > 0 ? s.sum / s.mdays : 0,
        gap: s.gap,
        quota: s.quota,
        sum: s.sum,
        achievement: s.quota > 0 ? (s.sum / s.quota) * 100 : 0,
      }))
      .filter((x) => x.bpo !== "-");
    bpoArr.sort((a, b) => b.avg - a.avg);

    const tlArr = Object.entries(tlStats)
      .map(([tl, s]) => ({
        tl,
        avg: s.mdays > 0 ? s.sum / s.mdays : 0,
        gap: s.gap,
        quota: s.quota,
        sum: s.sum,
        achievement: s.quota > 0 ? (s.sum / s.quota) * 100 : 0,
      }))
      .filter((x) => x.tl !== "-");
    tlArr.sort((a, b) => b.gap - a.gap);

    return {
      totalChat: sumChat,
      totalAvg: sumManDays > 0 ? sumChat / sumManDays : 0,
      totalManDays: sumManDays,
      activeAgents: filteredForWidgets.length,
      overTarget,
      underTarget,
      totalQuota: sumQuota,
      quotaAchievement: sumQuota > 0 ? (sumChat / sumQuota) * 100 : 0,
      totalGap: sumGap,
      bpoList: bpoArr,
      tlList: tlArr,
    };
  }, [data]);

  const hourlyDataWow = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    const filterAgent = (a: AgentKPI) => {
      const matchSearch =
        a.csId.toLowerCase().includes(search.toLowerCase()) ||
        (a.name || "").toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      return matchSearch && matchTL && a.productivityBase > 0;
    };
    
    const prevFiltered = previousData.filter(filterAgent);
    const prev2Filtered = previousData2.filter(filterAgent);
    const prev3Filtered = previousData3.filter(filterAgent);

    return hours.map((hr) => {
      const getSum = (dataset: AgentKPI[]) => dataset.reduce(
        (sum, agent) => sum + (agent.hourlyProductivity?.[hr] || 0),
        0
      );
      
      return {
        hour: `${String(hr).padStart(2, "0")}:00`,
        total: getSum(tableData),
        prev: previousData.length ? getSum(prevFiltered) : null,
        prev2: previousData2.length ? getSum(prev2Filtered) : null,
        prev3: previousData3.length ? getSum(prev3Filtered) : null,
      };
    });
  }, [tableData, previousData, previousData2, previousData3, search, filterTL]);

  const intervalCategoryInsights = useMemo(() => {
    return hourlyDataWow.map((hourData, hourIndex) => {
      const categoryCounts: Record<string, number> = {};

      tableData.forEach((agent) => {
        const hourlyCounts = agent.hourlyCategoryCounts?.[hourIndex] || {};
        Object.entries(hourlyCounts).forEach(([category, count]) => {
          categoryCounts[category] = (categoryCounts[category] || 0) + Number(count);
        });
      });

      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({
          category,
          count,
          share: hourData.total > 0 ? (count / hourData.total) * 100 : 0,
        }));

      return {
        hour: hourData.hour,
        total: hourData.total,
        change: typeof hourData.prev === "number" ? hourData.total - hourData.prev : null,
        topCategories,
      };
    });
  }, [hourlyDataWow, tableData]);

  const busiestHourIndex = useMemo(() => {
    return hourlyDataWow.reduce((bestIndex, item, index) => {
      return item.total > hourlyDataWow[bestIndex].total ? index : bestIndex;
    }, 0);
  }, [hourlyDataWow]);

  const activeHourIndex = selectedHourIndex ?? busiestHourIndex;
  const selectedIntervalInsight = intervalCategoryInsights[activeHourIndex];

  const handleChartIntervalClick = (_data: unknown, index?: number) => {
    if (typeof index === "number") {
      setSelectedHourIndex(index);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-text-primary">
          Productivity Dashboard
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
            <Search className="w-4 h-4 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* HOURLY PRODUCTIVITY CHART */}
      <div className="bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Hourly Traffic Distribution (Chat/Tiket per Jam)
        </h2>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {isComparisonEnabled && previousData.length > 0 ? (
              <LineChart
                data={hourlyDataWow}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} minTickGap={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                <RechartsTooltip 
                  cursor={{ fill: 'var(--color-surface-muted)', strokeWidth: 2 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border p-2 rounded-lg shadow-lg">
                          <div className="text-xs font-bold text-text-primary mb-1">{payload[0].payload.hour}</div>
                          {payload.map((p, i) => (
                             <div key={i} className="text-xs text-text-secondary mt-1 flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                               {p.name}: <span className="font-bold text-primary" style={{ color: p.color }}>{formatNum(p.value as number, 0)}</span>
                             </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  name={comparisonMode === 'mom' ? 'Bulan Ini' : 'Minggu Ini'}
                  dataKey="total"
                  stroke="#E31E24"
                  strokeWidth={3}
                  dot={{ r: 3, cursor: "pointer", onClick: handleChartIntervalClick }}
                  activeDot={{ r: 5, cursor: "pointer", onClick: handleChartIntervalClick }}
                />
                <Line type="monotone" name={comparisonMode === 'mom' ? 'Bulan Lalu' : 'Minggu Lalu'} dataKey="prev" stroke="#6B7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                {previousData2.length > 0 && <Line type="monotone" name={comparisonMode === 'mom' ? '2 Bulan Lalu' : '2 Minggu Lalu'} dataKey="prev2" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="3 3" dot={false} />}
                {previousData3.length > 0 && <Line type="monotone" name={comparisonMode === 'mom' ? '3 Bulan Lalu' : '3 Minggu Lalu'} dataKey="prev3" stroke="#D1D5DB" strokeWidth={2} strokeDasharray="2 2" dot={false} />}
              </LineChart>
            ) : (
              <BarChart
                data={hourlyDataWow}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} minTickGap={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                <RechartsTooltip 
                  cursor={{ fill: 'var(--color-surface-muted)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border p-2 rounded-lg shadow-lg">
                          <div className="text-xs font-bold text-text-primary">{payload[0].payload.hour}</div>
                          <div className="text-xs text-text-secondary mt-1">Traffic: <span className="font-bold text-primary">{formatNum(payload[0].value as number, 0)}</span> chats</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} onClick={handleChartIntervalClick}>
                  {hourlyDataWow.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      cursor="pointer"
                      onClick={() => setSelectedHourIndex(index)}
                      fill={
                        index === activeHourIndex
                          ? "var(--color-danger-text)"
                          : entry.total > 0
                            ? "var(--color-primary)"
                            : "var(--color-border)"
                      }
                      fillOpacity={index === activeHourIndex ? 1 : 0.88}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {selectedIntervalInsight && (
          <div className="rounded-xl border border-border bg-surface/60 p-4 pt-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                  Selected Interval {selectedIntervalInsight.hour}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black leading-none text-text-primary">
                    {formatNum(selectedIntervalInsight.total, 0)}
                  </span>
                  <span className="text-xs font-semibold text-text-muted">chats</span>
                  {selectedIntervalInsight.change !== null && (
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${selectedIntervalInsight.change > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
                      {selectedIntervalInsight.change >= 0 ? "+" : ""}
                      {formatNum(selectedIntervalInsight.change, 0)} vs pembanding
                    </span>
                  )}
                </div>
              </div>
              {selectedIntervalInsight.topCategories[0] && (
                <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 md:max-w-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-text-primary" title={selectedIntervalInsight.topCategories[0].category}>
                        {selectedIntervalInsight.topCategories[0].category}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        {formatNum(selectedIntervalInsight.topCategories[0].count, 0)} cases &middot; {formatNum(selectedIntervalInsight.topCategories[0].share, 1)}% dari interval
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedIntervalInsight.topCategories.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted text-text-muted">
                    <tr>
                      <th className="w-12 px-3 py-2 font-bold uppercase tracking-wide">Rank</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-wide">Category</th>
                      <th className="w-28 px-3 py-2 text-right font-bold uppercase tracking-wide">Cases</th>
                      <th className="w-28 px-3 py-2 text-right font-bold uppercase tracking-wide">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIntervalInsight.topCategories.map((category, index) => (
                      <tr key={category.category} className="border-t border-border">
                        <td className="px-3 py-2 font-bold text-text-muted">#{index + 1}</td>
                        <td className="max-w-[360px] truncate px-3 py-2 font-semibold text-text-primary" title={category.category}>
                          {category.category}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-text-primary">
                          {formatNum(category.count, 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-text-secondary">
                          {formatNum(category.share, 1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-card px-3 py-4 text-sm font-semibold text-text-muted">
                Tidak ada category terdeteksi untuk interval ini.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all max-h-[calc(100vh-280px)]">
        <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
          <thead className="bg-surface text-text-secondary sticky top-0 z-30">
            <tr>
              <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">
                No
              </th>
              <SortableHeader label="Name / CS ID" sortKey="name" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
              <SortableHeader label="BPO" sortKey="bpo" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
              <SortableHeader label="Team Leader" sortKey="teamLeader" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
              {uniqueDates.map((date) => (
                <th
                  key={date}
                  className="p-2 font-bold text-center text-text-muted bg-surface"
                >
                  {date}
                </th>
              ))}
              <th className="p-2 font-bold text-center text-text-primary  bg-surface shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-30 relative">
                Total Prod
              </th>
              <th className="p-2 font-bold text-center text-text-muted  bg-surface z-30 relative">
                Man-Days
              </th>
              <SortableHeader label="Average" sortKey="average" config={sortConfig} onSort={handleSort} className="text-center text-text-primary bg-surface z-30 relative" />
              <th className="p-2 font-bold text-center text-text-muted  bg-surface z-30 relative">
                Target Quota
              </th>
              <SortableHeader label="Gap (+/-)" sortKey="gap" config={sortConfig} onSort={handleSort} className="text-center text-text-primary bg-surface z-30 relative" />
            </tr>
          </thead>
          <tbody className="">
            {tableData.map((agent, idx) => {
              const displayName = agent.name || agent.csId;
              const localManDays = agent.manDays;
              const localTargetQuota = localManDays * 100;
              const localGap = agent.productivityTotal - localTargetQuota;
              const localAvg =
                localManDays > 0 ? agent.productivityTotal / localManDays : 0;

              return (
                <tr
                  key={agent.csId}
                  className="border-b border-border transition-colors group hover:bg-surface-muted"
                >
                  <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[60px] max-w-[60px]">
                    {idx + 1}
                  </td>
                  <td className="p-2 font-medium md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[250px] max-w-[250px] truncate">
                    <button 
                      onClick={() => useStore.getState().setSelectedAgentFor360(agent.csId)}
                      className="text-kpi-neutral-text hover:underline font-semibold"
                    >
                      {displayName}
                    </button>
                    <div className="text-[9px] text-text-muted font-normal mt-0.5">
                      {agent.csId}
                    </div>
                  </td>
                  <td className="p-2 font-medium text-text-primary uppercase md:sticky md:left-[310px] z-20 bg-card group-hover:bg-surface-muted min-w-[80px] max-w-[80px] truncate">
                    {agent.bpo || "-"}
                  </td>
                  <td className="p-2 font-medium text-text-primary md:sticky md:left-[390px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[120px] max-w-[120px] truncate">
                    {agent.teamLeader || "-"}
                  </td>
                  {uniqueDates.map((date) => {
                    const dateNorm = normalizeDateStr(date);
                    const daily = agent.dailyHistory?.productivity?.find(
                      (h) =>
                        h.date === date ||
                        normalizeDateStr(h.date) === dateNorm,
                    );
                    const sched = agent.dailyHistory?.schedule?.find(
                      (h) =>
                        h.date === date ||
                        (dateNorm != null && h.normDate === dateNorm),
                    );
                    const status = sched?.status?.toUpperCase() || "";

                    const isOff = status === "OFF" || status === "C";
                    const isPullout = status === "PULLOUT";
                    const isShift22 = status === "22";

                    let bgClass = "";

                    let numContent = (
                      <span className="text-text-disabled font-medium">-</span>
                    );

                    if (daily) {
                      numContent = (
                        <span
                          className={`font-bold text-[11px] h-full flex flex-col justify-center ${getKpiColor(daily.value, "productivity")}`}
                        >
                          {formatNum(daily.value, 0)}
                        </span>
                      );
                    }

                    return (
                      <td
                        key={date}
                        className={`p-2 text-center z-10 transition-colors ${bgClass}`}
                      >
                        <div className="flex items-center justify-center gap-1 relative">
                          {numContent}
                          {(isShift22 || isPullout) && daily && (
                            <div className="group/tooltip relative flex items-center justify-center">
                              <span className="text-[9px] text-text-muted font-medium cursor-help px-1 rounded">
                                {isPullout ? "(PO)" : "(22)"}
                              </span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[240px] bg-gray-900 text-white text-[10px] rounded px-2 py-1 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 shadow-lg whitespace-normal text-left">
                                {isPullout 
                                  ? "Agent berstatus Pullout, namun produktivitasnya tetap dihitung masuk ke target harian agent ini."
                                  : "Shift malam (22:00). Sebagian atau seluruh produktivitas shift ini dihitung pada hari sebelum atau sesudahnya."}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center z-10 relative">
                    <span
                      className={`font-bold text-[11px] ${getKpiColor(agent.productivityTotal, "productivity")}`}
                    >
                      {formatNum(agent.productivityTotal, 0)}
                    </span>
                  </td>
                  <td className="p-2 text-center text-text-muted font-medium z-10 relative">
                    {localManDays}
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    {localManDays > 0 ? (
                      <span
                        className={`font-bold text-[11px] ${getKpiColor(localAvg, "productivity")}`}
                      >
                        {formatNum(localAvg, 0)}
                      </span>
                    ) : (
                      <span className="text-text-disabled font-bold text-[11px]">
                        -
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center text-text-muted font-medium z-10 relative">
                    {localTargetQuota}
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    {localManDays > 0 ? (
                      <span
                        className={`font-bold text-[11px] ${localGap >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {localGap > 0 ? `+${localGap}` : localGap}
                      </span>
                    ) : (
                      <span className="text-text-disabled font-bold text-[11px]">
                        -
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {tableData.length === 0 && (
              <tr>
                <td
                  colSpan={8 + uniqueDates.length}
                  className="p-4 z-10"
                >
                  <EmptyState
                    title="Tidak ada data productivity"
                    description="Jika belum sync, buka File Center lalu klik Sync Now. Jika sudah sync, coba ubah search, filter Team Leader, atau range tanggal."
                    variant="filter"
                    className="border-0 bg-transparent py-6"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
