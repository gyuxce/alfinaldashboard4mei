import React, { useState, useMemo } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort } from '../../lib/utils';
import { Search, Clock } from 'lucide-react';
import { useStore } from '../../store';
import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from '../ui/EmptyState';
import { PeriodDelta } from '../ui/PeriodDelta';

export const WhuMonitor: React.FC<{ data: AgentKPI[]; previousData?: AgentKPI[] }> = ({ data, previousData = [] }) => {
  const [search, setSearch] = useState('');
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
  const comparisonMode = useStore(state => state.comparisonMode);

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
      return matchSearch && matchTL && a.whu !== null;
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
            aVal = a.whu || 0;
            bVal = b.whu || 0;
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, search, filterTL, sortConfig]);

  const whuSummary = useMemo(() => {
    const calc = (dataset: AgentKPI[]) => {
      let sum = 0;
      let count = 0;
      let under = 0;
      dataset.forEach((d) => {
        if (d.whu !== null) {
          sum += d.whu;
          count++;
          if (d.whu < 96) under++;
        }
      });
      return { avg: count > 0 ? sum / count : 0, under, count };
    };
    return { current: calc(data), previous: calc(previousData) };
  }, [data, previousData]);

  const underWhuAgents = useMemo(() => {
    return data
      .filter((a) => a.whu !== null && (a.whu as number) < 96)
      .sort((a, b) => (a.whu || 0) - (b.whu || 0));
  }, [data]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    tableData.forEach(a => a.dailyHistory?.whu?.forEach(h => dates.add(h.date)));
    return Array.from(dates).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, [tableData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-lg font-bold text-text-primary">WHU Monitor</h1>
          <div className="rounded-xl border border-border bg-card px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" /> Team Avg WHU
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-black ${getKpiColor(whuSummary.current.avg, 'whu')}`}>
                {formatNum(whuSummary.current.avg, 1)}%
              </span>
              {isComparisonEnabled && previousData.length > 0 && (
                <PeriodDelta
                  current={whuSummary.current.avg}
                  previous={whuSummary.previous.avg}
                  suffix="%"
                  label={comparisonMode === 'mom' ? 'vs MoM' : 'vs WoW'}
                />
              )}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              {formatNum(whuSummary.current.under, 0)} agent &lt; 96%
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
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

      {underWhuAgents.length > 0 && (
        <div className="bg-card border border-danger/30 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-danger/5">
            <div className="text-sm font-bold text-danger">Exception: WHU &lt; 96%</div>
            <div className="text-xs text-text-muted mt-0.5">{underWhuAgents.length} agent di bawah target</div>
          </div>
          <div className="max-h-[200px] overflow-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface text-text-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2">Agent</th>
                  <th className="p-2">BPO</th>
                  <th className="p-2">TL</th>
                  <th className="p-2 text-center">WHU</th>
                </tr>
              </thead>
              <tbody>
                {underWhuAgents.map((a, idx) => (
                  <tr key={a.csId} className="border-b border-border hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted">{idx + 1}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => useStore.getState().setSelectedAgentFor360(a.csId)}
                        className="font-semibold text-kpi-neutral-text hover:underline"
                      >
                        {a.name || a.csId}
                      </button>
                    </td>
                    <td className="p-2 uppercase text-text-secondary">{a.bpo || '-'}</td>
                    <td className="p-2 text-text-secondary">{a.teamLeader || '-'}</td>
                    <td className="p-2 text-center font-bold text-danger">{formatNum(a.whu, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <SortableHeader label="Average WHU" sortKey="average" config={sortConfig} onSort={handleSort} className="text-center text-text-primary bg-surface shrink-0 z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]" />
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
                      const daily = agent.dailyHistory?.whu?.find(h => h.date === date);
                      const sched = agent.dailyHistory?.schedule?.find(h => h.date === date);
                      const status = sched?.status?.toUpperCase() || '';
                      
                      const isOff = status === 'OFF' || status === 'C';
                      const isPullout = status === 'PULLOUT';
                      const bgClass = '';
                      const baseColor = daily && daily.value !== null ? getKpiColor(daily.value, 'whu') : 'text-text-disabled';
                      const textColor = isPullout && daily && daily.value !== null ? 'text-text-muted italic' : baseColor;

                      return (
                        <td key={date} className={`p-2 text-center  z-10 transition-colors ${bgClass}`}>
                          <span className={`font-bold text-[11px] ${textColor}`}>
                            {daily && daily.value !== null ? formatNum(daily.value, 2) + '%' : '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-bold border-border z-10 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      <span className={`font-bold text-[11px] ${getKpiColor(agent.whu, 'whu')}`}>
                        {formatNum(agent.whu)}{agent.whu !== null ? '%' : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={5 + uniqueDates.length} className="p-4 z-10">
                    <EmptyState
                      title="Tidak ada data WHU"
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
