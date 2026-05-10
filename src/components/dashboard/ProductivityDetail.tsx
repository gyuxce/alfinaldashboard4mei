import React, { useMemo, useState } from "react";
import { AgentKPI } from "../../lib/dataProcessor";
import { formatNum, getKpiColor, parseDateForSort } from "../../lib/utils";
import { useStore } from "../../store";
import {
  Search,
  MessageSquare,
  TrendingUp,
  Activity,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Award,
  AlertCircle,
  Target,
  TrendingDown,
} from "lucide-react";
import { KpiTicker, buildRankingItems, TickerItem } from '../ui/KpiTicker';
import { SortableHeader } from '../ui/SortableHeader';

export const ProductivityDetail: React.FC<{ data: AgentKPI[] }> = ({
  data,
}) => {
  const [search, setSearch] = useState("");
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const dict = useStore((state) => state.agentDictionary);
  const { startDate, endDate, setDateRange } = useStore();

  const filteredData = useMemo(() => {
    return data.filter((a) => {
      const matchSearch =
        a.csId.toLowerCase().includes(search.toLowerCase()) ||
        (a.name || "").toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      return matchSearch && matchTL && a.productivityBase > 0;
    });
  }, [data, search, filterTL]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    filteredData.forEach((a) =>
      a.dailyHistory?.productivity?.forEach((h) => dates.add(h.date)),
    );
    return Array.from(dates).sort(
      (a, b) => parseDateForSort(a) - parseDateForSort(b),
    );
  }, [filteredData]);

  const tableData = useMemo(() => {
    let sorted = [...filteredData];
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        const getLocalGap = (agent: AgentKPI) => {
          const localManDays = agent.dailyHistory?.schedule?.filter(
            (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
          ).length || 0;
          return agent.productivityTotal - (localManDays * 100);
        };

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
            aVal = a.prodAvg || 0;
            bVal = b.prodAvg || 0;
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
  }, [filteredData, sortConfig, uniqueDates]);

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
      const localManDays =
        agent.dailyHistory?.schedule?.filter(
          (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
        ).length || 0;
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

    const avg = sumManDays > 0 ? sumChat / sumManDays : 0;
    const achievement = sumQuota > 0 ? (sumChat / sumQuota) * 100 : 0;

    const bpoArr = Object.entries(bpoStats)
      .map(([bpo, stat]) => ({
        bpo,
        avg: stat.mdays > 0 ? stat.sum / stat.mdays : 0,
        gap: stat.gap,
        achievement: stat.quota > 0 ? (stat.sum / stat.quota) * 100 : 0,
      }))
      .filter((x) => x.bpo !== "-");
    bpoArr.sort((a, b) => b.avg - a.avg);

    const tlArr = Object.entries(tlStats)
      .map(([tl, stat]) => ({
        tl,
        avg: stat.mdays > 0 ? stat.sum / stat.mdays : 0,
        gap: stat.gap,
        achievement: stat.quota > 0 ? (stat.sum / stat.quota) * 100 : 0,
      }))
      .filter((x) => x.tl !== "-");
    tlArr.sort((a, b) => b.gap - a.gap); // Sort by gap to easily see plus/minus

    return {
      totalChat: sumChat,
      totalAvg: avg,
      totalManDays: sumManDays,
      activeAgents: filteredForWidgets.length,
      overTarget,
      underTarget,
      totalQuota: sumQuota,
      quotaAchievement: achievement,
      totalGap: sumGap,
      bpoList: bpoArr,
      tlList: tlArr,
    };
  }, [data, uniqueDates]);

  const tickerItems: TickerItem[] = useMemo(() => {
    const sortedTLs = [...tlList].sort((a, b) => b.avg - a.avg).slice(0, 5);
    // Sort agent by localAvg (because it uses local target)
    const sortedAgents = [...tableData]
      .sort((a, b) => {
        const localManDaysA =
          a.dailyHistory?.schedule?.filter(
            (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
          ).length || 0;
        const localManDaysB =
          b.dailyHistory?.schedule?.filter(
            (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
          ).length || 0;
        const avgA =
          localManDaysA > 0 ? a.productivityTotal / localManDaysA : 0;
        const avgB =
          localManDaysB > 0 ? b.productivityTotal / localManDaysB : 0;
        return avgB - avgA;
      })
      .slice(0, 5);

    const bpoArrStr = bpoList
      .map((b) => `${b.bpo} ${formatNum(b.avg, 0)}`)
      .join(" · ");

    return [
      { label: "BPO:", value: bpoArrStr, colorType: "neutral" },
      { isSeparator: true },
      ...buildRankingItems(
        sortedTLs.map((t) => ({ name: t.tl, value: formatNum(t.avg, 0) })),
        "TL:",
        3,
      ),
      { isSeparator: true },
      ...buildRankingItems(
        sortedAgents.map((a) => {
          const localManDays =
            a.dailyHistory?.schedule?.filter(
              (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
            ).length || 0;
          const avg = localManDays > 0 ? a.productivityTotal / localManDays : 0;
          return {
            name: (a.name || a.csId).split(" ")[0],
            value: formatNum(avg, 0),
          };
        }),
        "Agent:",
        5,
      ),
      { isSeparator: true },
    ];
  }, [totalAvg, bpoList, tlList, tableData, uniqueDates]);

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

      {/* SUMMARY WIDGETS ROW */}
      <KpiTicker items={tickerItems} />

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
              const localManDays =
                agent.dailyHistory?.schedule?.filter(
                  (sch) => uniqueDates.includes(sch.date) && sch.isManDay,
                ).length || 0;
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
                    const daily = agent.dailyHistory?.productivity?.find(
                      (h) => h.date === date,
                    );
                    const sched = agent.dailyHistory?.schedule?.find(
                      (h) => h.date === date,
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
                  className="p-8 text-center text-text-muted text-sm z-10"
                >
                  <div className="flex flex-col items-center justify-center text-text-secondary">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    Tidak ada data yang sesuai filter.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
