import React, { useState, useMemo } from 'react';
import { AgentKPI, getOfficialCsatAggregate } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort, cn } from '../../lib/utils';
import { Search, Star, Users, TrendingDown, CalendarDays } from 'lucide-react';
import { useStore } from '../../store';
import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

export const CsatOfficialMonitor: React.FC<{ data: AgentKPI[], previousData?: AgentKPI[], previousData2?: AgentKPI[], previousData3?: AgentKPI[] }> = ({ data, previousData = [], previousData2 = [], previousData3 = [] }) => {
  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
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

  const highlightStats = useMemo(() => {
    const aggregate = getOfficialCsatAggregate(tableData);
    const lowestAgent = [...tableData]
      .filter(agent => agent.csatAsli !== null)
      .sort((a, b) => (a.csatAsli || 0) - (b.csatAsli || 0))[0];

    const dailyMap = new Map<string, { sum: number; count: number }>();
    tableData.forEach(agent => {
      agent.dailyHistory?.csat?.forEach(entry => {
        const count = entry.count || 1;
        const current = dailyMap.get(entry.date) || { sum: 0, count: 0 };
        dailyMap.set(entry.date, {
          sum: current.sum + (entry.sum ?? entry.value * count),
          count: current.count + count,
        });
      });
    });

    const lowestDay = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, score: stats.count > 0 ? stats.sum / stats.count : 0 }))
      .sort((a, b) => a.score - b.score)[0];

    return { aggregate, lowestAgent, lowestDay };
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Skor CSAT</span>
            <Star className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 text-2xl font-black text-text-primary">
            {highlightStats.aggregate.score !== null ? `${formatNum(highlightStats.aggregate.score, 2)} / 5` : '-'}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">Target 3.75</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Responden</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-black text-text-primary">{formatNum(highlightStats.aggregate.respondents, 0)}</div>
          <p className="mt-1 text-[11px] text-text-muted">Pada periode terpilih</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Hari Terendah</span>
            <CalendarDays className="h-4 w-4 text-danger" />
          </div>
          <div className="mt-2 truncate text-lg font-black text-text-primary" title={highlightStats.lowestDay?.date || '-'}>
            {highlightStats.lowestDay?.date || '-'}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            {highlightStats.lowestDay ? `${formatNum(highlightStats.lowestDay.score, 2)} / 5` : 'Belum ada data'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Skor Terendah</span>
            <TrendingDown className="h-4 w-4 text-danger" />
          </div>
          <div className="mt-2 truncate text-lg font-black text-text-primary" title={highlightStats.lowestAgent?.name || '-'}>
            {highlightStats.lowestAgent?.name || '-'}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            {highlightStats.lowestAgent?.csatAsli !== null && highlightStats.lowestAgent?.csatAsli !== undefined
              ? `${formatNum(highlightStats.lowestAgent.csatAsli, 2)} / 5`
              : 'Belum ada data'}
          </p>
        </div>
      </div>

      {isComparisonEnabled && (
        <WoWChartPanel 
          data={data} 
          previousData={previousData} 
          previousData2={previousData2} 
          previousData3={previousData3} 
        />
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
                  <td colSpan={5 + uniqueDates.length} className="p-4 z-10">
                    <EmptyState
                      title="Tidak ada data CSAT official"
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

const WoWChartPanel = ({ data, previousData, previousData2, previousData3 }: any) => {
  const { startDate, endDate } = useStore();
  const comparisonMode = useStore(state => state.comparisonMode);
  const [trendMode, setTrendMode] = useState<'weekly' | 'daily'>('weekly');

  const getWeekLabel = (offset: number) => {
    if (!startDate || !endDate) return `Week -${offset}`;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const end = new Date(endDate);
    if (comparisonMode === 'mom') {
      end.setMonth(end.getMonth() - offset);
      const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(end);
      return `${month} ${end.getFullYear()}`;
    }
    end.setDate(end.getDate() - (offset * diff));
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(end);
    const weekNum = Math.ceil(end.getDate() / 7);
    return `W${weekNum} ${month}`;
  };

  const calcStats = (dataset: AgentKPI[]) => {
    let sumFull = 0, countFull = 0;
    let sumTakeout = 0, countTakeout = 0;
    const officialCsat = getOfficialCsatAggregate(dataset || []);
    
    (dataset || []).forEach(d => {
      sumFull += d.csatScGoodCount || 0;
      countFull += d.csatScTotalValid || 0;
      sumTakeout += d.csatScFairGoodCount || 0;
      countTakeout += d.csatScFairTotalValid || 0;
    });

    return {
      asli: officialCsat.score !== null ? Number(officialCsat.score.toFixed(2)) : 0,
      full: countFull > 0 ? Number(((sumFull / countFull) * 100).toFixed(2)) : 0,
      takeout: countTakeout > 0 ? Number(((sumTakeout / countTakeout) * 100).toFixed(2)) : 0,
    };
  };

  const w0 = calcStats(data);
  const w1 = calcStats(previousData);
  const w2 = calcStats(previousData2);
  const w3 = calcStats(previousData3);

  const chartData = [
    { name: getWeekLabel(3), 'CSAT Official': w3.asli, 'SC Full': w3.full, 'SC After Takeout': w3.takeout },
    { name: getWeekLabel(2), 'CSAT Official': w2.asli, 'SC Full': w2.full, 'SC After Takeout': w2.takeout },
    { name: getWeekLabel(1), 'CSAT Official': w1.asli, 'SC Full': w1.full, 'SC After Takeout': w1.takeout },
    { name: getWeekLabel(0), 'CSAT Official': w0.asli, 'SC Full': w0.full, 'SC After Takeout': w0.takeout },
  ].filter(d => d.name !== 'WNaN Invalid Date');
  const visibleChartData = comparisonMode === 'mom' ? chartData.slice(1) : chartData;

  const dailyData = React.useMemo(() => {
    const dates = new Map<string, { sum: number, count: number }>();
    (data || []).forEach(a => {
      a.dailyHistory?.csat?.forEach(h => {
        if (!dates.has(h.date)) dates.set(h.date, { sum: 0, count: 0 });
        if (h.value !== null) {
           const respondentCount = h.count || 1;
           dates.get(h.date)!.sum += h.sum ?? h.value * respondentCount;
           dates.get(h.date)!.count += respondentCount;
        }
      });
    });
    
    return Array.from(dates.entries())
      .map(([date, stats]) => {
        const d = new Date(date);
        const validDate = isNaN(d.getTime()) ? date : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
        return {
          date: validDate,
          CSAT: stats.count > 0 ? Number((stats.sum / stats.count).toFixed(2)) : 0,
          count: stats.count,
          rawDate: date
        };
      })
      .sort((a, b) => parseDateForSort(a.rawDate) - parseDateForSort(b.rawDate));
  }, [data]);

  const weeklyData = React.useMemo(() => {
    const weeks = new Map<string, { label: string, startDate: string, sum: number, count: number }>();
    const getWeekBucket = (date: string) => {
      const parsedTimestamp = parseDateForSort(date);
      if (!parsedTimestamp) return { key: date, label: date, startDate: date };

      const start = new Date(parsedTimestamp);
      const day = start.getDay();
      start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const toDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      const formatDate = (value: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(value);
      const label = start.getMonth() === end.getMonth()
        ? `${start.getDate()}-${end.getDate()} ${new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(start)}`
        : `${formatDate(start)}-${formatDate(end)}`;

      return { key: toDateKey(start), label, startDate: toDateKey(start) };
    };

    dailyData.forEach(day => {
      const bucket = getWeekBucket(day.rawDate);
      if (!weeks.has(bucket.key)) {
        weeks.set(bucket.key, { label: bucket.label, startDate: bucket.startDate, sum: 0, count: 0 });
      }
      const week = weeks.get(bucket.key)!;
      week.sum += day.CSAT * day.count;
      week.count += day.count;
    });

    return Array.from(weeks.values())
      .map(week => ({
        date: week.label,
        CSAT: week.count > 0 ? Number((week.sum / week.count).toFixed(2)) : 0,
        rawDate: week.startDate,
      }))
      .sort((a, b) => parseDateForSort(a.rawDate) - parseDateForSort(b.rawDate));
  }, [dailyData]);

  const trendData = trendMode === 'weekly' ? weeklyData : dailyData;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Weekly Trend Panel */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-sm font-bold text-text-primary text-center">{comparisonMode === 'mom' ? '3-Month Comparison Trend' : '4-Week Comparison Trend'}</h3>
          </div>
          <div className="h-80 w-full border border-border/50 rounded-xl p-6 bg-surface/20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="CSAT Official" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="CSAT Official" position="top" style={{fontSize: '11px', fontWeight: 'bold', fill: '#3b82f6'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly/Daily Trend Panel */}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-text-primary">
              {trendMode === 'weekly' ? 'Weekly Average Trend' : 'Daily Trend'} ({comparisonMode === 'mom' ? 'Current Month' : 'Current Week'})
            </h3>
            <div className="inline-flex items-center rounded-lg border border-border bg-surface-muted p-0.5">
              {(['weekly', 'daily'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTrendMode(mode)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    trendMode === mode ? 'bg-card text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {mode === 'weekly' ? 'Weekly' : 'Daily'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80 w-full border border-border/50 rounded-xl p-6 bg-surface/20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="CSAT" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="CSAT" position="top" style={{fontSize: '11px', fontWeight: 'bold', fill: '#f59e0b'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
