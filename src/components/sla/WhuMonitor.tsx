import React, { useState, useMemo, useRef } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, indexByDate, uniqueCalendarDates, getByCalendarDate } from '../../lib/utils';
import { Search, Clock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store';
import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from '../ui/EmptyState';
import { MobileScrollHint } from '../ui/ChartScrollArea';
import { VirtualizedTbody } from '../ui/VirtualizedTbody';
import { useVirtualRows } from '../../hooks/useVirtualRows';

export const WhuMonitor: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
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
  const { startDate, endDate, setDateRange } = useStore(useShallow((s) => ({
    startDate: s.startDate,
    endDate: s.endDate,
    setDateRange: s.setDateRange,
  })));

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

  const avgWhu = useMemo(() => {
    let sum = 0;
    let count = 0;
    data.forEach(d => {
      if (d.whu !== null) {
        sum += d.whu;
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  }, [data]);

  const uniqueDates = useMemo(() => {
    return uniqueCalendarDates(tableData.flatMap((a) => [
      a.dailyHistory?.schedule,
      a.dailyHistory?.whu,
    ]));
  }, [tableData]);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableVirtual = useVirtualRows({
    count: tableData.length,
    rowHeight: 52,
    scrollRef: tableScrollRef,
  });
  const tableColSpan = 5 + uniqueDates.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary">WHU Monitor</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Cari CS ID atau nama..." 
              className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:border-primary focus:outline-none w-full md:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <MobileScrollHint label="Geser → untuk lihat semua kolom" />
      <div ref={tableScrollRef} className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="kpi-data-table w-full text-left whitespace-nowrap border-collapse">
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
            <VirtualizedTbody
              colSpan={tableColSpan}
              paddingTop={tableVirtual.paddingTop}
              paddingBottom={tableVirtual.paddingBottom}
            >
              {tableVirtual.virtualIndexes.map((index) => {
                const agent = tableData[index];
                if (!agent) return null;
                const displayName = agent.name || agent.csId;
                const whuByDate = indexByDate(agent.dailyHistory?.whu);
                const scheduleByDate = indexByDate(agent.dailyHistory?.schedule);

                return (
                  <tr key={agent.csId} className="border-b border-border transition-colors group hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[60px] max-w-[60px]">{index + 1}</td>
                    <td className="p-2 font-medium md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[250px] max-w-[250px] truncate">
                      <span className="text-kpi-neutral-text font-semibold">
                        {displayName}
                      </span>
                      <div className="text-[9px] text-text-muted font-normal mt-0.5">{agent.csId}</div>
                    </td>
                    <td className="p-2 font-medium text-text-primary uppercase md:sticky md:left-[310px] z-20 bg-card group-hover:bg-surface-muted min-w-[80px] max-w-[80px] truncate">
                      {agent.bpo || '-'}
                    </td>
                    <td className="p-2 font-medium text-text-primary md:sticky md:left-[390px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[120px] max-w-[120px] truncate">{agent.teamLeader || '-'}</td>
                    {uniqueDates.map(date => {
                      const daily = getByCalendarDate(whuByDate, date);
                      const sched = getByCalendarDate(scheduleByDate, date);
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
                  <td colSpan={tableColSpan} className="p-4 z-10">
                    <EmptyState
                      title="Tidak ada data WHU"
                      description="Coba ubah pencarian, filter TL, atau rentang tanggal."
                      variant="filter"
                      className="border-0 bg-transparent py-6"
                      showDataActions
                    />
                  </td>
                </tr>
              )}
            </VirtualizedTbody>
          </table>
      </div>
    </div>
  );
};
