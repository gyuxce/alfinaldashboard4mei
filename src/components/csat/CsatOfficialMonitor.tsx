import React, { useState, useMemo } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort } from '../../lib/utils';
import { Search, Star } from 'lucide-react';
import { useStore } from '../../store';
import { KpiTicker, buildRankingItems, TickerItem } from '../ui/KpiTicker';
import { SortableHeader } from '../ui/SortableHeader';

export const CsatOfficialMonitor: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
  const [search, setSearch] = useState('');
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const dict = useStore(state => state.agentDictionary);
  const { startDate, endDate, setDateRange } = useStore();

  const tableData = useMemo(() => {
    let filtered = data.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      const hasData = a.csatAsli !== null;
      return matchSearch && matchTL && hasData;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

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
            aVal = a.csatAsli || 0;
            bVal = b.csatAsli || 0;
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, search, filterTL, sortConfig]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    tableData.forEach(a => {
       if (a.dailyHistory && a.dailyHistory.csat) {
          a.dailyHistory.csat.forEach(h => dates.add(h.date));
       }
    });
    return Array.from(dates).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, [tableData]);

  const tickerItems: TickerItem[] = useMemo(() => {
    // We must manually compute bpo and tl since we don't have KpiInfoBar anymore
    let totalSum = 0;
    let totalCount = 0;
    const bpoStats: Record<string, { sum: number; count: number }> = {};
    const tlStats: Record<string, { sum: number; count: number }> = {};

    tableData.forEach(agent => {
       if (agent.csatAsli !== null) {
          totalSum += agent.csatAsli;
          totalCount += 1;
          const bpo = agent.bpo || 'Unknown';
          if (!bpoStats[bpo]) bpoStats[bpo] = { sum: 0, count: 0 };
          bpoStats[bpo].sum += agent.csatAsli;
          bpoStats[bpo].count += 1;

          const tl = agent.teamLeader || 'Unknown';
          if (!tlStats[tl]) tlStats[tl] = { sum: 0, count: 0 };
          tlStats[tl].sum += agent.csatAsli;
          tlStats[tl].count += 1;
       }
    });

    const bpoArr = Object.entries(bpoStats).map(([bpo, st]) => ({ bpo, avg: st.sum / st.count })).sort((a,b) => b.avg - a.avg);
    const tlArr = Object.entries(tlStats).map(([tl, st]) => ({ tl, avg: st.sum / st.count })).filter(x => x.tl !== 'Unknown' && x.tl !== '-').sort((a,b) => b.avg - a.avg);

    const sortedTLs = tlArr.slice(0, 5);
    const sortedAgents = [...tableData].filter(a => a.csatAsli !== null).sort((a, b) => (b.csatAsli || 0) - (a.csatAsli || 0)).slice(0, 5);

    const bpoArrStr = bpoArr.map(b => `${b.bpo} ${formatNum(b.avg, 2)}`).join(' · ');
    const overallAvg = totalCount > 0 ? formatNum(totalSum / totalCount, 2) : '-';

    return [
      { label: 'CSAT OFFICIAL', value: overallAvg, colorType: 'warning' },
      { isSeparator: true },
      { label: 'BPO:', value: bpoArrStr, colorType: 'neutral' },
      { isSeparator: true },
      ...buildRankingItems(sortedTLs.map(t => ({ name: t.tl, value: formatNum(t.avg, 2) })), 'TL:', 3),
      { isSeparator: true },
      ...buildRankingItems(sortedAgents.map(a => {
           return { name: (a.name || a.csId).split(' ')[0], value: formatNum(a.csatAsli || 0, 2) };
      }), 'Agent:', 5), { isSeparator: true } ];
  }, [tableData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-bold text-text-primary">CSAT Official Monitor</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 flex-col md:flex-row">
             <div className="relative mt-2 md:mt-0">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search CS ID or Name..." 
                  className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:border-primary focus:outline-none w-full md:w-56"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
          </div>
        </div>
      </div>

      <KpiTicker items={tickerItems} />

      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
              <thead className="bg-surface text-text-secondary sticky top-0 z-30">
              <tr>
                <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                <SortableHeader label="Name / CS ID" sortKey="name" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
                <SortableHeader label="BPO" sortKey="bpo" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
                <SortableHeader label="Team Leader" sortKey="teamLeader" config={sortConfig} onSort={handleSort} className="md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
                {uniqueDates.map(date => (
                  <th key={date} className="p-2 font-bold text-center text-text-muted bg-surface ">{date}</th>
                ))}
                <SortableHeader label="Official CSAT (Avg)" sortKey="average" config={sortConfig} onSort={handleSort} className="text-center text-text-primary bg-surface shrink-0 z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]" />
              </tr>
            </thead>
            <tbody className="">
              {tableData.map((agent, index) => {
                const displayName = agent.name || agent.csId;

                return (
                  <tr key={agent.csId} className="border-b border-border transition-colors group hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[60px] max-w-[60px]">{index + 1}</td>
                    <td className="p-2 font-medium md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[250px] max-w-[250px] truncate">
                      <button 
                        onClick={() => useStore.getState().setSelectedAgentFor360(agent.csId)}
                        className="text-kpi-neutral-text hover:underline font-semibold"
                      >
                        {displayName}
                      </button>
                      <div className="text-[9px] text-text-muted font-normal mt-0.5">{agent.csId}</div>
                    </td>
                    <td className="p-2 font-medium text-text-primary uppercase md:sticky md:left-[310px] z-20 bg-card group-hover:bg-surface-muted min-w-[80px] max-w-[80px] truncate">
                      {agent.bpo || '-'}
                    </td>
                    <td className="p-2 font-medium text-text-primary md:sticky md:left-[390px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[120px] max-w-[120px] truncate">{agent.teamLeader || '-'}</td>
                    {uniqueDates.map(date => {
                      const daily = agent.dailyHistory?.csat?.find(h => h.date === date);
                      const sched = agent.dailyHistory?.schedule?.find(h => h.date === date);
                      const status = sched?.status?.toUpperCase() || '';
                      
                      const isOff = status === 'OFF' || status === 'C';
                      const isPullout = status === 'PULLOUT';
                      const bgClass = '';
                      const baseColor = daily && daily.value !== null ? getKpiColor(daily.value, 'csatOfficial') : 'text-text-disabled';
                      const textColor = isPullout && daily && daily.value !== null ? 'text-text-muted italic' : baseColor;

                      return (
                        <td key={date} className={`p-2 text-center  z-10 transition-colors ${bgClass}`}>
                          <span className={`font-bold text-[11px] ${textColor}`}>
                            {daily && daily.value !== null ? formatNum(daily.value) : '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-bold border-border z-10 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      <span className={`font-bold text-[11px] ${getKpiColor(agent.csatAsli, 'csatOfficial')}`}>
                        {agent.csatAsli !== null ? formatNum(agent.csatAsli) : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={5 + uniqueDates.length} className="p-4 text-center text-text-muted text-sm z-10">
                    Tidak ada data yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
};
