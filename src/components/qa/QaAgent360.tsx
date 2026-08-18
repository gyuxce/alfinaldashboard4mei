import React, { useState, useMemo } from 'react';
import { AgentKPI, QAEntry } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort, cn } from '../../lib/utils';
import { Search, Eye, X, BarChart2, AlertCircle, ChevronDown, ChevronUp, ChevronRight, Copy, Check } from 'lucide-react';
import { useStore } from '../../store';

import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from '../ui/EmptyState';
import { MobileScrollHint } from '../ui/ChartScrollArea';
import { KpiRankLists } from '../ui/KpiRankLists';
import { SegmentedControl } from '../ui/SegmentedControl';

const isQaDefect = (entry: QAEntry) => {
  const level = (entry.mistakeLevel || '').toUpperCase();
  return level.includes('LOW') || level.includes('MEDIUM') || level.includes('HIGH') || level.includes('VERY HIGH');
};

export const QaAgent360: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
  const [search, setSearch] = useState('');
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<{agent: AgentKPI, date?: string, type?: 'all' | 'defects' | 'no_mistake'} | null>(null);
  const [viewMode, setViewMode] = useState<'performance' | 'defect'>('performance');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [perfSortConfig, setPerfSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [defectSortConfig, setDefectSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handlePerfSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (perfSortConfig && perfSortConfig.key === key && perfSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setPerfSortConfig({ key, direction });
  };

  const handleDefectSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (defectSortConfig && defectSortConfig.key === key && defectSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setDefectSortConfig({ key, direction });
  };

  const dict = useStore(state => state.agentDictionary);

  React.useEffect(() => {
    if (selectedAgent) {
      setExpandedDates(new Set());
    }
  }, [selectedAgent]);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { startDate, endDate, setDateRange } = useStore();

  const tableData = useMemo(() => {
    return data.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      return matchSearch && matchTL && a.qaScoreCount > 0;
    });
  }, [data, search, filterTL]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    tableData.forEach(a => {
      a.qaHistory?.forEach(h => dates.add(h.date));
    });
    return Array.from(dates).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, [tableData]);

  const defectData = useMemo(() => {
    return tableData.map(agent => {
      const defects = agent.qaHistory
        .filter(isQaDefect)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let lowCount = 0;
      let mediumCount = 0;
      let highCount = 0;
      let veryHighCount = 0;
      
      const mistakeCounts: Record<string, number> = {};

      defects.forEach(d => {
        const level = (d.mistakeLevel || '').toUpperCase();
        if (level.includes('VERY HIGH')) veryHighCount++;
        else if (level.includes('HIGH')) highCount++;
        else if (level.includes('MEDIUM')) mediumCount++;
        else if (level.includes('LOW')) lowCount++;

        const category = d.category || '-';
        mistakeCounts[category] = (mistakeCounts[category] || 0) + 1;
      });

      const totalDefect = lowCount + mediumCount + highCount + veryHighCount;
      
      let mostFrequentMistake = '-';
      let maxCount = 0;
      for (const cat in mistakeCounts) {
         if (mistakeCounts[cat] > maxCount) {
             maxCount = mistakeCounts[cat];
             mostFrequentMistake = cat;
         }
      }

      return {
        ...agent,
        defects,
        lowCount,
        mediumCount,
        highCount,
        veryHighCount,
        totalDefect,
        mostFrequentMistake
      };
    }).sort((a, b) => b.totalDefect - a.totalDefect);
  }, [tableData]);

  const sortedPerformanceData = useMemo(() => {
    let sortable = [...defectData];
    if (perfSortConfig) {
      sortable.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        switch (perfSortConfig.key) {
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
          default:
            aVal = a.qaScoreCount > 0 ? (a.qaScoreSum / a.qaScoreCount) * 100 : -1;
            bVal = b.qaScoreCount > 0 ? (b.qaScoreSum / b.qaScoreCount) * 100 : -1;
            break;
        }

        if (aVal < bVal) return perfSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return perfSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [defectData, perfSortConfig]);

  const sortedDefectData = useMemo(() => {
    let sortable = defectData.filter(agent => agent.totalDefect > 0);
    if (defectSortConfig) {
      sortable.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        switch (defectSortConfig.key) {
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
          case 'low':
            aVal = a.lowCount || 0;
            bVal = b.lowCount || 0;
            break;
          case 'medium':
            aVal = a.mediumCount || 0;
            bVal = b.mediumCount || 0;
            break;
          case 'high':
            aVal = a.highCount || 0;
            bVal = b.highCount || 0;
            break;
          case 'veryHigh':
            aVal = a.veryHighCount || 0;
            bVal = b.veryHighCount || 0;
            break;
          case 'category':
            aVal = a.mostFrequentMistake || '';
            bVal = b.mostFrequentMistake || '';
            break;
          default:
            aVal = a.totalDefect;
            bVal = b.totalDefect;
            break;
        }

        if (aVal < bVal) return defectSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return defectSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sortable.sort((a, b) => b.totalDefect - a.totalDefect);
    }
    return sortable;
  }, [defectData, defectSortConfig]);

  const highlightStats = useMemo(() => {
    const totalEvaluations = tableData.reduce((sum, agent) => sum + agent.qaScoreCount, 0);
    const totalMistakes = defectData.reduce((sum, agent) => sum + agent.totalDefect, 0);
    const categoryCounts: Record<string, number> = {};

    defectData.forEach(agent => {
      agent.defects.forEach(defect => {
        const category = defect.category || 'Tidak ada kategori';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    });

    const categoriesByCount = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const agentsByQa = [...tableData]
      .filter(agent => agent.qaScoreCount > 0)
      .map(agent => ({
        agent,
        avg: agent.qaScoreSum / agent.qaScoreCount,
      }))
      .sort((a, b) => b.avg - a.avg);

    const dailyMap = new Map<string, { scoreSum: number; scoreCount: number; mistakes: number }>();
    tableData.forEach(agent => {
      agent.qaHistory?.forEach(entry => {
        const date = entry.normDate || entry.date;
        if (!date) return;
        const current = dailyMap.get(date) || { scoreSum: 0, scoreCount: 0, mistakes: 0 };
        if (entry.hasScore && entry.score !== undefined) {
          current.scoreSum += entry.score;
          current.scoreCount += 1;
        }
        if (isQaDefect(entry)) current.mistakes += 1;
        dailyMap.set(date, current);
      });
    });

    const daysByQa = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        avg: stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null,
        mistakes: stats.mistakes,
        scoreCount: stats.scoreCount,
      }))
      .filter(d => d.avg !== null && d.scoreCount > 0)
      .sort((a, b) => (a.avg || 0) - (b.avg || 0));

    return {
      totalEvaluations,
      totalMistakes,
      mistakeRate: totalEvaluations > 0 ? (totalMistakes / totalEvaluations) * 100 : 0,
      topCategories: categoriesByCount.slice(0, 3).map(c => ({
        label: c.category,
        value: `${formatNum(c.count, 0)} temuan`,
      })),
      bottomDays: daysByQa.slice(0, 3).map(d => ({
        label: d.date,
        subLabel: `${formatNum(d.mistakes, 0)} temuan · ${formatNum(d.scoreCount, 0)} evaluasi`,
        value: `${formatNum(d.avg, 1)}%`,
      })),
      topAgents: agentsByQa.slice(0, 3).map(a => ({
        label: a.agent.name || a.agent.csId,
        subLabel: a.agent.teamLeader || a.agent.csId,
        value: `${formatNum(a.avg, 1)}%`,
      })),
      bottomAgents:
        agentsByQa.length > 3
          ? agentsByQa.slice(Math.max(3, agentsByQa.length - 3)).reverse().map(a => ({
              label: a.agent.name || a.agent.csId,
              subLabel: a.agent.teamLeader || a.agent.csId,
              value: `${formatNum(a.avg, 1)}%`,
            }))
          : [],
    };
  }, [tableData, defectData]);

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between xl:gap-8 gap-4 mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-text-primary">QA Agent 360</h1>
          
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'performance', label: 'Ringkasan', icon: BarChart2 },
              { value: 'defect', label: 'Analisis Defect', icon: AlertCircle },
            ]}
          />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium tracking-wide text-text-muted">Total Evaluasi</span>
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{formatNum(highlightStats.totalEvaluations, 0)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium tracking-wide text-text-muted">Total Temuan</span>
            <AlertCircle className="h-4 w-4 text-danger" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-danger">{formatNum(highlightStats.totalMistakes, 0)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium tracking-wide text-text-muted">% Temuan</span>
            <AlertCircle className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{formatNum(highlightStats.mistakeRate, 1)}%</div>
        </div>
      </div>

      <KpiRankLists
        summaryLabel="Highlight KPI"
        cards={[
          { title: 'Top 3 Temuan', items: highlightStats.topCategories, tone: 'bad' },
          { title: 'Bottom 3 Hari', items: highlightStats.bottomDays, tone: 'bad' },
          { title: 'Top 3 Agent (QA)', items: highlightStats.topAgents, tone: 'good' },
          { title: 'Bottom 3 Agent (QA)', items: highlightStats.bottomAgents, tone: 'bad' },
        ]}
      />

      {viewMode === 'performance' ? (
        <>
        <MobileScrollHint label="Geser → untuk lihat semua kolom" />
      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="kpi-data-table w-full text-left whitespace-nowrap border-collapse">
              <thead className="bg-surface text-text-secondary sticky top-0 z-30">
                <tr>
                  <th className="p-2 font-bold text-center border-b border-border md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                  <SortableHeader label="Nama / CS ID" sortKey="name" config={perfSortConfig} onSort={handlePerfSort} className="border-b border-border md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
                  <SortableHeader label="BPO" sortKey="bpo" config={perfSortConfig} onSort={handlePerfSort} className="border-b border-border md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
                  <SortableHeader label="TL" sortKey="teamLeader" config={perfSortConfig} onSort={handlePerfSort} className="border-b border-border md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
                  {uniqueDates.map(date => (
                    <th key={date} className="p-2 font-bold text-center text-text-muted bg-surface border-b border-border">
                      {date}
                    </th>
                  ))}
                  <SortableHeader label="Rata-rata QA" sortKey="average" config={perfSortConfig} onSort={handlePerfSort} className="text-center text-text-primary border-b border-border bg-surface shrink-0 z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]" />
                  <th className="p-2 font-bold text-center text-text-muted border-b border-border bg-surface w-24">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="">
                {sortedPerformanceData.map((agent, index) => {
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
                        const dailyQA = agent.qaHistory?.filter(h => h.date === date);
                        const sched = agent.dailyHistory?.schedule?.find(h => h.date === date);
                        const status = sched?.status?.toUpperCase() || '';
                        
                        const isOff = status === 'OFF' || status === 'C';
                        const isPullout = status === 'PULLOUT';
                        const bgClass = isOff ? 'text-text-muted' : '';
                        
                        const validQA = dailyQA.filter(h => h.hasScore);
                        if (!dailyQA || dailyQA.length === 0) {
                          return <td key={date} className={`p-2 text-center text-text-disabled z-10 ${bgClass} `}>-</td>;
                        }
                        
                        let displayValue = '-';
                        let avg = 0;
                        if (validQA.length > 0) {
                          const sum = validQA.reduce((acc, curr) => acc + curr.score, 0);
                          avg = sum / validQA.length;
                          displayValue = formatNum(avg, 1);
                        }
                        
                        const baseColor = validQA.length > 0 ? getKpiColor(avg, 'qa') : 'text-text-disabled';
                        const textColor = isPullout ? 'text-text-muted italic' : baseColor;
                        return (
                          <td key={date} className={`p-0 text-center font-semibold z-10   ${bgClass}`}>
                            <button 
                              onClick={() => setSelectedAgent({ agent, date, type: 'defects' })}
                              className={`w-full h-full p-2 font-bold text-[11px] hover:bg-surface-muted transition-colors flex items-center justify-center gap-1 group/btn relative cursor-pointer ${textColor}`}
                            >
                              {displayValue}
                              <Eye className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity absolute right-1" />
                            </button>
                          </td>
                        );
                      })}

                      <td className="p-2 text-center font-bold z-10 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                        <span className={`font-bold text-[11px] ${agent.qaScoreCount > 0 ? getKpiColor(agent.qaScoreSum / agent.qaScoreCount, 'qa') : 'text-text-disabled'}`}>
                          {agent.qaScoreCount > 0 ? formatNum(agent.qaScoreSum / agent.qaScoreCount, 1) : '-'}
                        </span>
                      </td>
                      <td className="p-2 text-center flex items-center justify-center gap-2 z-10">
                        <button 
                          onClick={() => setSelectedAgent({ agent, type: 'defects' })}
                          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-muted relative cursor-pointer"
                          title="Lihat detail defect"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {agent.totalDefect > 0 && (
                            <span className="text-danger text-[9px] font-bold px-1.5 py-0.5 rounded-full absolute -top-1 -right-2 leading-none shadow-[0_1px_3px_rgba(0,0,0,0.04)]">{agent.totalDefect}</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedPerformanceData.length === 0 && (
                  <tr>
                    <td colSpan={6 + uniqueDates.length} className="p-4 z-10">
                      <EmptyState
                        title="Tidak ada data QA performance"
                        description="Coba ubah pencarian, filter TL, view mode, atau rentang tanggal."
                        variant="filter"
                        className="border-0 bg-transparent py-6"
                        showDataActions
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
        </>
      ) : (
        <>
        <MobileScrollHint label="Geser → untuk lihat semua kolom" />
      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="kpi-data-table w-full text-left whitespace-nowrap border-collapse">
              <thead className="bg-surface text-text-secondary sticky top-0 z-30">
                <tr>
                  <th className="p-2 font-bold text-center border-b border-border md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                  <SortableHeader label="Nama / CS ID" sortKey="name" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
                  <SortableHeader label="BPO" sortKey="bpo" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
                  <SortableHeader label="TL" sortKey="teamLeader" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
                  <SortableHeader label="Low" sortKey="low" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface text-text-primary" />
                  <SortableHeader label="Medium" sortKey="medium" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface text-text-primary" />
                  <SortableHeader label="High" sortKey="high" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface text-text-primary" />
                  <SortableHeader label="Very High" sortKey="veryHigh" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface text-text-primary" />
                  <SortableHeader label="Temuan tersering" sortKey="category" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border bg-surface text-text-secondary" />
                  <th className="p-2 font-bold text-center border-b border-border bg-surface w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="">
                {sortedDefectData.map((agent, index) => {
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
                      
                      <td className={`p-2 text-center z-10 `}><span className={`inline-flex font-bold ${agent.lowCount > 0 ? 'text-text-primary' : 'text-text-disabled'}`}>{agent.lowCount || '-'}</span></td>
                      <td className={`p-2 text-center z-10 `}><span className={`inline-flex font-bold ${agent.mediumCount > 0 ? 'text-text-primary' : 'text-text-disabled'}`}>{agent.mediumCount || '-'}</span></td>
                      <td className={`p-2 text-center z-10 `}><span className={`inline-flex font-bold ${agent.highCount > 0 ? 'text-text-primary' : 'text-text-disabled'}`}>{agent.highCount || '-'}</span></td>
                      <td className={`p-2 text-center z-10 `}><span className={`inline-flex font-bold ${agent.veryHighCount > 0 ? 'text-text-primary' : 'text-text-disabled'}`}>{agent.veryHighCount || '-'}</span></td>
                      
                      <td className="p-2 font-medium text-text-primary z-10 truncate max-w-[200px]">
                        {agent.mostFrequentMistake === '-' ? <span className="text-text-muted ml-4">-</span> : agent.mostFrequentMistake}
                      </td>
                      <td className="p-2 text-center flex items-center justify-center z-10">
                        <button 
                          onClick={() => setSelectedAgent({ agent, type: 'defects' })}
                          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-muted relative cursor-pointer"
                          title="View Defect Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="font-bold">Detail</span>
                          {agent.totalDefect > 0 && (
                            <span className="text-danger text-[9px] font-bold px-1.5 py-0.5 rounded-full absolute -top-1 -right-2 leading-none shadow-[0_1px_3px_rgba(0,0,0,0.04)]">{agent.totalDefect}</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedDefectData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 z-10">
                      <EmptyState
                        title="Tidak ada defect QA"
                        description="Tidak ada defect pada filter dan view mode saat ini."
                        variant="data"
                        className="border-0 bg-transparent py-6"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
        </>
      )}

      {selectedAgent && (() => {
        const currentAgentData = defectData.find(a => a.csId === selectedAgent.agent.csId);
        
        let filteredDefectsList = currentAgentData?.qaHistory || [];
        if (selectedAgent.type === 'defects') {
           filteredDefectsList = filteredDefectsList.filter(isQaDefect);
        } else if (selectedAgent.type === 'no_mistake') {
           filteredDefectsList = filteredDefectsList.filter(q => {
              const level = (q.mistakeLevel || '').toUpperCase();
              return level.includes('NO MISTAKE');
           });
        }
        
        const filteredDefects = selectedAgent.date ? filteredDefectsList.filter(q => q.date === selectedAgent.date) : filteredDefectsList;

        const categoryCounts: Record<string, number> = {};
        filteredDefects.forEach(d => {
           const cat = d.category || '-';
           categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        
        let topCategories = Object.entries(categoryCounts)
           .filter(([cat]) => cat !== '-')
           .sort((a, b) => b[1] - a[1])
           .slice(0, 3)
           .map(entry => entry[0]);
           
        if (topCategories.length === 0) topCategories = ['-'];

        const groupedDefects = filteredDefects.reduce((acc, curr) => {
           if(!acc[curr.date]) acc[curr.date] = [];
           acc[curr.date].push(curr);
           return acc;
        }, {} as Record<string, typeof filteredDefects>);
        
        const sortedDates = Object.keys(groupedDefects).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        return (
          <div className="fixed inset-0 bg-text-primary/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between p-4 md:p-5 border-b border-border bg-surface-muted relative gap-3 md:gap-4 pr-10 md:pr-5">
                <div className="flex flex-col gap-2 md:gap-3">
                  <div>
                    <h3 className="font-bold text-base md:text-lg text-text-primary flex flex-wrap items-center gap-1.5 md:gap-2">
                      <AlertCircle className={`w-4 h-4 md:w-5 md:h-5 ${selectedAgent.type === 'defects' ? 'text-danger' : selectedAgent.type === 'no_mistake' ? 'text-success' : 'text-primary'}`} />
                      {selectedAgent.type === 'all' ? 'Riwayat evaluasi QA:' : selectedAgent.type === 'no_mistake' ? 'Evaluasi tanpa temuan:' : 'Riwayat audit:'} {selectedAgent.agent.name || selectedAgent.agent.csId} 
                      {selectedAgent.date && <span className="text-text-muted font-normal text-xs md:text-sm ml-1 md:ml-2">({selectedAgent.date})</span>}
                    </h3>
                    <p className="text-[10px] md:text-xs text-text-muted mt-0.5 md:mt-1 ml-6 md:ml-7 flex flex-wrap items-center gap-1">
                      <span>CS ID: <span className="font-semibold text-text-primary">{selectedAgent.agent.csId}</span></span>
                      <span className="text-border">&bull;</span> 
                      <span>TL: <span className="font-semibold text-text-primary">{selectedAgent.agent.teamLeader || '-'}</span></span>
                    </p>
                    
                    {!selectedAgent.date && (
                      <div className="mt-4 flex gap-6 border-b border-border w-full ml-6 md:ml-7">
                        <button onClick={() => setSelectedAgent({...selectedAgent, type: 'defects'})} className={`pb-2 px-1 font-semibold text-sm border-b-2 transition-colors ${selectedAgent.type === 'defects' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>Defect</button>
                        <button onClick={() => setSelectedAgent({...selectedAgent, type: 'no_mistake'})} className={`pb-2 px-1 font-semibold text-sm border-b-2 transition-colors ${selectedAgent.type === 'no_mistake' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>Tanpa temuan</button>
                        <button onClick={() => setSelectedAgent({...selectedAgent, type: 'all'})} className={`pb-2 px-1 font-semibold text-sm border-b-2 transition-colors ${selectedAgent.type === 'all' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>Semua evaluasi</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 md:gap-8 ml-0 md:ml-7 mt-1 md:mt-0 pl-0 md:pl-4">
                     <div className="flex flex-col bg-card md:bg-transparent border border-border md:border-transparent px-3 py-1.5 md:px-0 md:py-0 rounded-lg shrink-0 shadow-sm md:shadow-none">
                        <span className="text-[9px] md:text-[10px] font-bold text-text-muted tracking-wide mb-0.5">
                          {selectedAgent.type === 'defects' ? 'Total defect' : selectedAgent.type === 'no_mistake' ? 'Tanpa temuan' : 'Total evaluasi'}
                        </span>
                        <span className={`text-base md:text-lg font-semibold leading-none ${selectedAgent.type === 'defects' ? 'text-danger' : selectedAgent.type === 'no_mistake' ? 'text-success' : 'text-primary'}`}>{filteredDefects.length}</span>
                     </div>
                     
                     <div className="flex md:hidden flex-col flex-1 min-w-[120px]">
                        <span className="text-[9px] font-bold text-text-muted tracking-wide mb-1">Top kategori</span>
                        <div className="flex flex-wrap gap-1">
                          {topCategories.map((cat, i) => (
                             <span key={i} className="text-[9px] font-medium bg-card border border-border px-1.5 py-0.5 rounded text-text-secondary truncate max-w-full" title={cat}>{cat}</span>
                          ))}
                        </div>
                     </div>
                  </div>
                </div>
                
                <div className="hidden md:flex gap-8 items-start mt-4">
                  <div className="flex flex-col mr-4 mt-0.5">
                      <span className="text-[10px] font-bold text-text-muted tracking-wide mb-2">Top kategori (maks. 3)</span>
                      <ul className="flex flex-col gap-1.5 text-xs">
                        {topCategories.map((cat, i) => (
                          <li key={i} className="font-semibold text-text-primary leading-tight max-w-[280px] truncate" title={cat}>
                            {topCategories.length > 1 && topCategories[0] !== '-' && <span className="text-text-muted mr-1.5">{i + 1}.</span>}
                            {cat}
                          </li>
                        ))}
                      </ul>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="absolute top-2 right-2 md:relative md:top-auto md:right-auto p-2 text-text-muted hover:text-text-primary hover:bg-surface-muted rounded-full transition-colors self-start shrink-0"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
              
              <div className="p-0 overflow-y-auto flex-1 bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)] z-20 border-b border-border">
                    <tr className="text-text-secondary">
                      <th className="p-3.5 font-semibold w-24">Tanggal</th>
                      <th className="p-3.5 font-semibold w-32">Level temuan</th>
                      <th className="p-3.5 font-semibold min-w-[200px]">Kategori (indikator)</th>
                      <th className="p-3.5 font-semibold min-w-[120px]">CRM KODE</th>
                      <th className="p-3.5 font-semibold min-w-[250px]">Catatan & feedback</th>
                      <th className="p-3.5 font-semibold w-40">Ticket & Chat ID</th>
                      <th className="p-3.5 font-semibold w-32">UID</th>
                      <th className="p-3.5 font-semibold w-32">Nama QC</th>
                      <th className="p-3.5 font-semibold text-right w-24 pr-6">Tanggal kasus</th>
                    </tr>
                  </thead>
                  
                  {sortedDates.length > 0 ? (
                    sortedDates.map(date => {
                       const defects = groupedDefects[date];
                       const isExpanded = expandedDates.has(date) || sortedDates.length === 1; // Auto-expand if only 1 date
                       
                       return (
                         <tbody key={date} className="group">
                            <tr 
                              onClick={() => {
                                setExpandedDates(prev => {
                                   const next = new Set(prev);
                                   if (next.has(date)) next.delete(date);
                                   else next.add(date);
                                   return next;
                                });
                              }}
                              className="cursor-pointer bg-surface-muted hover:bg-surface border-b border-border transition-colors"
                            >
                               <td colSpan={9} className="p-3.5">
                                  <div className="flex items-center gap-2">
                                     {isExpanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                                     <span className="font-bold text-text-primary">{date}</span>
                                     <span className={`${selectedAgent.type === 'no_mistake' ? 'text-success' : 'text-danger'} text-[10px] font-bold px-2 py-0.5 rounded-full ml-2`}>
                                        {defects.length} Record{defects.length > 1 ? 's' : ''} Found
                                     </span>
                                  </div>
                               </td>
                            </tr>
                            
                            {isExpanded && defects.map((q, i) => {
                                const levelStr = (q.mistakeLevel || '').toUpperCase();
                                let badgeClass = 'bg-surface-muted text-text-secondary';
                                if (levelStr.includes('VERY HIGH')) badgeClass = 'text-danger border border-danger';
                                else if (levelStr.includes('HIGH') || levelStr.includes('MAJOR')) badgeClass = 'bg-danger-soft text-danger border border-danger';
                                else if (levelStr.includes('MEDIUM') || levelStr.includes('MINOR')) badgeClass = 'bg-warning-soft text-warning border border-warning';
                                else if (levelStr.includes('LOW')) badgeClass = 'bg-primary-soft text-primary border border-primary';
                                else if (levelStr.includes('NO MISTAKE')) badgeClass = 'bg-success-soft text-success border border-success';
                                
                                return (
                                  <tr key={`${date}-${i}`} className="border-b border-border hover:bg-surface-muted/50 transition-colors last:border-b-0 text-text-primary group">
                                    <td className="p-3.5 whitespace-nowrap font-medium pl-8">
                                       <div className="flex items-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-text-disabled mr-3"></div>
                                          {q.date}
                                       </div>
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`whitespace-nowrap px-2 py-0.5 rounded text-[10px] uppercase shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${badgeClass}`}>
                                        {q.mistakeLevel || 'N/A'}
                                      </span>
                                    </td>
                                    <td className="p-3.5 leading-relaxed font-medium">
                                      {q.category || '-'}
                                    </td>
                                    <td className="p-3.5 text-text-primary font-bold text-xs">
                                      {q.crmKode || '-'}
                                    </td>
                                    <td className="p-3.5 text-text-secondary leading-relaxed max-w-sm whitespace-pre-wrap">
                                      <div className="flex flex-col gap-1">
                                        {q.remarks && <div>{q.remarks}</div>}
                                        {q.feedback && <div className="italic text-text-muted mt-1">{q.feedback}</div>}
                                        {(!q.remarks && !q.feedback) && <span>-</span>}
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-text-primary text-xs font-mono">
                                      <div className="flex flex-col gap-1">
                                        {q.ticketId && 
                                          <div className="flex items-center gap-1.5 group/copy">
                                            <span className="text-text-muted select-none">T:</span>
                                            <span title="Ticket ID" className="truncate max-w-[120px]">{q.ticketId}</span>
                                            <button onClick={(e) => handleCopy(e, q.ticketId!)} className="p-1 hover:bg-surface-muted rounded text-text-muted opacity-0 group-hover/copy:opacity-100 transition-opacity focus:opacity-100">
                                              {copiedId === q.ticketId ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                          </div>
                                        }
                                        {q.chatId && 
                                          <div className="flex items-center gap-1.5 group/copy">
                                            <span className="text-text-muted select-none">C:</span>
                                            <span title="Chat ID" className="truncate max-w-[120px]">{q.chatId}</span>
                                            <button onClick={(e) => handleCopy(e, q.chatId!)} className="p-1 hover:bg-surface-muted rounded text-text-muted opacity-0 group-hover/copy:opacity-100 transition-opacity focus:opacity-100">
                                              {copiedId === q.chatId ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                          </div>
                                        }
                                        {(!q.ticketId && !q.chatId) && <span>-</span>}
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-text-primary font-mono text-xs">
                                      <div className="flex items-center gap-1.5 group/copy w-max">
                                        <span title="UID" className="truncate">{q.uid || '-'}</span>
                                        {q.uid && (
                                          <button onClick={(e) => handleCopy(e, q.uid!)} className="p-1 hover:bg-surface-muted rounded text-text-muted opacity-0 group-hover/copy:opacity-100 transition-opacity focus:opacity-100">
                                            {copiedId === q.uid ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-text-primary text-xs">
                                      {q.qcName || '-'}
                                    </td>
                                    <td className="p-3.5 text-right text-text-primary text-xs pr-6 whitespace-nowrap">
                                      {q.caseDate || '-'}
                                    </td>
                                  </tr>
                                );
                            })}
                         </tbody>
                       );
                    })
                  ) : (
                    <tbody>
                      <tr>
                        <td colSpan={9} className="p-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-surface-muted border border-border rounded-full flex items-center justify-center mb-4">
                               <BarChart2 className="w-8 h-8 text-text-disabled" />
                            </div>
                            <div className="text-text-secondary font-bold text-base">{selectedAgent.type === 'defects' ? 'No defects found for this agent.' : 'No evaluations found.'}</div>
                            <div className="text-text-muted mt-1 max-w-sm">{selectedAgent.type === 'defects' ? 'Excellent performance with zero recorded defects in the selected period.' : 'No QA evaluation data to display.'}</div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

