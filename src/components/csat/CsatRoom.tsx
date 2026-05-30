import React, { useMemo, useState } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort, cn } from '../../lib/utils';
import { Search, Star, Eye, X, AlertCircle, ChevronDown, ChevronUp, BarChart2, ArrowUpDown, CheckCircle, Filter, Layers, TrendingUp } from 'lucide-react';
import { useStore } from '../../store';
import { KpiTicker, buildRankingItems, TickerItem } from '../ui/KpiTicker';

import { SortableHeader } from '../ui/SortableHeader';
import { CsatDetailModal } from "./CsatDetailModal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, AreaChart, Area } from 'recharts';

export const CsatRoom: React.FC<{ data: AgentKPI[], previousData?: AgentKPI[], previousData2?: AgentKPI[], previousData3?: AgentKPI[] }> = ({ data, previousData = [], previousData2 = [], previousData3 = [] }) => {
  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
  const selectedBpo = useStore(state => state.selectedBpo);
  const [search, setSearch] = useState('');
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'fair'>('full');
  const [analysisMode, setAnalysisMode] = useState<'category' | 'score' | 'agent' | 'defect'>('agent');
  const [selectedScoreCase, setSelectedScoreCase] = useState<string>('All');
  const [scoreCasePage, setScoreCasePage] = useState<number>(1);
  const [selectedAgent, setSelectedAgent] = useState<{agent: AgentKPI, date?: string, type?: 'csat' | 'defects'} | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  
  const [agentSortConfig, setAgentSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [defectSortConfig, setDefectSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleAgentSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (agentSortConfig && agentSortConfig.key === key && agentSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setAgentSortConfig({ key, direction });
  };

  const handleDefectSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (defectSortConfig && defectSortConfig.key === key && defectSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setDefectSortConfig({ key, direction });
  };

  const dict = useStore(state => state.agentDictionary);
  const { startDate, endDate, setDateRange } = useStore();

  const tableData = useMemo(() => {
    return data.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      const count = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
      return matchSearch && matchTL && count > 0;
    });
  }, [data, search, filterTL, viewMode]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    tableData.forEach(a => {
      a.dailyHistory?.csatScFull?.forEach(h => dates.add(h.date));
      a.dailyHistory?.csatScFair?.forEach(h => dates.add(h.date));
    });
    return Array.from(dates).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, [tableData]);

  const topCategories = useMemo(() => {
    const agg: Record<string, number> = {};
    tableData.forEach(a => {
       const cats = viewMode === 'full' ? (a.csatScCategoriesFull || {}) : (a.csatScCategoriesFair || {});
       for (const cat in cats) {
          if (!agg[cat]) agg[cat] = 0;
          agg[cat] += cats[cat];
       }
    });
    return Object.entries(agg)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 10)
      .map((entry, idx) => ({ rank: idx+1, name: entry[0], count: entry[1] }));
  }, [tableData, viewMode]);

  const prevTopCategories = useMemo(() => {
    const prevTableData = previousData.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      const count = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
      return matchSearch && matchTL && count > 0;
    });

    const agg: Record<string, number> = {};
    prevTableData.forEach(a => {
       const cats = viewMode === 'full' ? (a.csatScCategoriesFull || {}) : (a.csatScCategoriesFair || {});
       for (const cat in cats) {
          if (!agg[cat]) agg[cat] = 0;
          agg[cat] += cats[cat];
       }
    });
    return agg;
  }, [previousData, search, filterTL, viewMode]);

  const agentRankings = useMemo(() => {
    const agents = tableData.map(a => {
       const count = viewMode === 'full' ? (a.csatScBadScoreFullCount || 0) : (a.csatScBadScoreFairCount || 0);
       return { name: a.name || a.csId, csId: a.csId, bpo: a.bpo, tl: a.teamLeader, badScoreCount: count };
    });
    
    const critical = [...agents].sort((a, b) => b.badScoreCount - a.badScoreCount).filter(a => a.badScoreCount > 0).slice(0, 10);
    const stable = [...agents].sort((a, b) => {
       if (a.badScoreCount === b.badScoreCount) return a.name.localeCompare(b.name);
       return a.badScoreCount - b.badScoreCount;
    }).slice(0, 10);
    
    return { critical, stable };
  }, [tableData, viewMode]);

  const TAKEOUT_CATEGORIES = [
    "Tidak Bisa Transaksi Namun Memiliki Limit",
    "Pengajuan Limit Kredit Ditolak",
    "Pertanyaan Belum Bisa Diidentifikasi"
  ];

  const scoreDistribution = useMemo(() => {
    const dist = {
      'All': 0, 'No Survey': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
    };
    tableData.forEach(a => {
      if (a.csatScScoreDistribution) {
        ['No Survey', '1', '2', '3', '4', '5'].forEach(scoreKey => {
           if (a.csatScScoreDistribution[scoreKey]) {
              const cases = a.csatScScoreDistribution[scoreKey];
              for (const c in cases) {
                 if (viewMode === 'fair' && TAKEOUT_CATEGORIES.includes(c)) continue;
                 dist[scoreKey as keyof typeof dist] += cases[c] || 0;
                 dist['All'] += cases[c] || 0;
              }
           }
        });
      }
    });
    return dist;
  }, [tableData, viewMode]);

  const totalScoreRows = useMemo(() => {
    return scoreDistribution['All'];
  }, [scoreDistribution]);

  const answeredScoreRows = useMemo(() => {
    return scoreDistribution['1'] + scoreDistribution['2'] + scoreDistribution['3'] + scoreDistribution['4'] + scoreDistribution['5'];
  }, [scoreDistribution]);

  const surveyResponseRate = useMemo(() => {
    if (totalScoreRows === 0) return 0;
    return (answeredScoreRows / totalScoreRows) * 100;
  }, [answeredScoreRows, totalScoreRows]);

  const sortedAgentData = useMemo(() => {
    let sortable = [...tableData];
    if (agentSortConfig) {
      sortable.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;
        
        switch (agentSortConfig.key) {
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
            const aCount = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
            const bCount = viewMode === 'full' ? b.csatScFullCount : b.csatScFairCount;
            aVal = aCount > 0 ? ((viewMode === 'full' ? a.csatScFullScore : a.csatScFairScore) / aCount) * 100 / 5 : -1;
            bVal = bCount > 0 ? ((viewMode === 'full' ? b.csatScFullScore : b.csatScFairScore) / bCount) * 100 / 5 : -1;
            break;
        }

        if (aVal < bVal) return agentSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return agentSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [tableData, agentSortConfig, viewMode]);

  const sortedDefectData = useMemo(() => {
    let sortable = tableData.filter(agent => {
      const count = viewMode === 'full' ? agent.csatScBadScoreFullCount : agent.csatScBadScoreFairCount;
      return count > 0;
    });

    if (defectSortConfig) {
      sortable.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;

        const getScoreCount = (agent: AgentKPI, score: number) => {
          return agent.csatHistory.filter(h => h.score === score && (viewMode === 'full' || !h.isTakeout)).length;
        };

        const getTopCat = (agent: AgentKPI) => {
          const cats = viewMode === 'full' ? agent.csatScCategoriesFull : agent.csatScCategoriesFair;
          if (Object.keys(cats).length > 0) {
            return Object.entries(cats).sort((x, y) => y[1] - x[1])[0][0];
          }
          return '';
        };
        
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
          case 'score1':
            aVal = getScoreCount(a, 1);
            bVal = getScoreCount(b, 1);
            break;
          case 'score2':
            aVal = getScoreCount(a, 2);
            bVal = getScoreCount(b, 2);
            break;
          case 'score3':
            aVal = getScoreCount(a, 3);
            bVal = getScoreCount(b, 3);
            break;
          case 'score4':
            aVal = getScoreCount(a, 4);
            bVal = getScoreCount(b, 4);
            break;
          case 'score5':
            aVal = getScoreCount(a, 5);
            bVal = getScoreCount(b, 5);
            break;
          case 'category':
            aVal = getTopCat(a);
            bVal = getTopCat(b);
            break;
          default:
            aVal = viewMode === 'full' ? a.csatScBadScoreFullCount : a.csatScBadScoreFairCount;
            bVal = viewMode === 'full' ? b.csatScBadScoreFullCount : b.csatScBadScoreFairCount;
            break;
        }

        if (aVal < bVal) return defectSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return defectSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort
      sortable.sort((a,b) => {
         const acount = viewMode === 'full' ? a.csatScBadScoreFullCount : a.csatScBadScoreFairCount;
         const bcount = viewMode === 'full' ? b.csatScBadScoreFullCount : b.csatScBadScoreFairCount;
         return bcount - acount;
      });
    }
    return sortable;
  }, [tableData, defectSortConfig, viewMode]);

  const scoreAnalysisTopCases = useMemo(() => {
    const caseDist: Record<string, number> = {};
    tableData.forEach(a => {
       if (a.csatScScoreDistribution) {
          const scoresToProcess = selectedScoreCase === 'All' ? ['No Survey', '1', '2', '3', '4', '5'] : [selectedScoreCase];
          scoresToProcess.forEach(scoreKey => {
            if (a.csatScScoreDistribution[scoreKey]) {
                const cases = a.csatScScoreDistribution[scoreKey];
                for (const c in cases) {
                   if (viewMode === 'fair' && TAKEOUT_CATEGORIES.includes(c)) continue;
                   if (!caseDist[c]) caseDist[c] = 0;
                   caseDist[c] += cases[c];
                }
            }
          });
       }
    });
    return Object.entries(caseDist).sort((a,b) => b[1] - a[1]).map((e, idx) => ({ rank: idx+1, name: e[0], count: e[1] }));
  }, [tableData, selectedScoreCase, viewMode]);

  const scoreAnalysisTopAgents = useMemo(() => {
    const agentDist: Record<string, number> = {};
    tableData.forEach(a => {
       if (a.csatScScoreDistribution) {
          const scoresToProcess = selectedScoreCase === 'All' ? ['No Survey', '1', '2', '3', '4', '5'] : [selectedScoreCase];
          scoresToProcess.forEach(scoreKey => {
            if (a.csatScScoreDistribution[scoreKey]) {
                const cases = a.csatScScoreDistribution[scoreKey];
                let totalForAgent = 0;
                for (const c in cases) {
                    if (viewMode === 'fair' && TAKEOUT_CATEGORIES.includes(c)) continue;
                    totalForAgent += cases[c] || 0;
                }
                if (totalForAgent > 0) {
                    const displayName = a.name || a.csId;
                    if (!agentDist[displayName]) agentDist[displayName] = 0;
                    agentDist[displayName] += totalForAgent;
                }
            }
          });
       }
    });
    return Object.entries(agentDist).sort((a,b) => b[1] - a[1]).map((e, idx) => ({ rank: idx+1, name: e[0], count: e[1] }));
  }, [tableData, selectedScoreCase, viewMode]);

  
  const tickerItems: TickerItem[] = useMemo(() => {
    const bpoStats: Record<string, { good: number; total: number }> = {};
    const tlStats: Record<string, { good: number; total: number }> = {};

    tableData.forEach(agent => {
       const goodCount = viewMode === 'full' ? agent.csatScGoodCount : agent.csatScFairGoodCount;
       const totalValid = viewMode === 'full' ? agent.csatScTotalValid : agent.csatScFairTotalValid;
       if (totalValid > 0) {
          const bpo = agent.bpo || 'Unknown';
          if (!bpoStats[bpo]) bpoStats[bpo] = { good: 0, total: 0 };
          bpoStats[bpo].good += goodCount;
          bpoStats[bpo].total += totalValid;

          const tl = agent.teamLeader || 'Unknown';
          if (!tlStats[tl]) tlStats[tl] = { good: 0, total: 0 };
          tlStats[tl].good += goodCount;
          tlStats[tl].total += totalValid;
       }
    });

    const bpoArr = Object.entries(bpoStats).map(([bpo, st]) => ({
      bpo,
      avg: st.total > 0 ? (st.good / st.total) * 100 : 0
    })).sort((a,b) => b.avg - a.avg);
    const tlArr = Object.entries(tlStats).map(([tl, st]) => ({
      tl,
      avg: st.total > 0 ? (st.good / st.total) * 100 : 0
    })).filter(x => x.tl !== 'Unknown' && x.tl !== '-').sort((a,b) => b.avg - a.avg);

    const sortedTLs = tlArr.slice(0, 5);
    const sortedAgents = [...tableData].filter(a => (viewMode === 'full' ? a.csatScTotalValid : a.csatScFairTotalValid) > 0).map(a => {
       const goodCount = viewMode === 'full' ? a.csatScGoodCount : a.csatScFairGoodCount;
       const totalValid = viewMode === 'full' ? a.csatScTotalValid : a.csatScFairTotalValid;
       return { ...a, avg: totalValid > 0 ? (goodCount / totalValid) * 100 : 0 };
    }).sort((a, b) => b.avg - a.avg).slice(0, 5);

    const bpoArrStr = bpoArr.map(b => `${b.bpo} ${formatNum(b.avg, 1)}%`).join(' · ');
    const overallGood = tableData.reduce((s, a) => s + (viewMode === 'full' ? a.csatScGoodCount : a.csatScFairGoodCount), 0);
    const overallValid = tableData.reduce((s, a) => s + (viewMode === 'full' ? a.csatScTotalValid : a.csatScFairTotalValid), 0);
    const overallAvg = overallValid > 0 ? formatNum((overallGood / overallValid) * 100, 1) + '%' : '-';

    return [
      
      { label: 'BPO:', value: bpoArrStr, colorType: 'neutral' },
      { isSeparator: true },
      ...buildRankingItems(sortedTLs.map(t => ({ name: t.tl, value: formatNum(t.avg, 1) + '%' })), 'TL:', 3),
      { isSeparator: true },
      ...buildRankingItems(sortedAgents.map(a => {
           return { name: (a.name || a.csId).split(' ')[0], value: formatNum(a.avg, 1) + '%' };
      }), 'Agent:', 5), { isSeparator: true } ];
  }, [tableData, viewMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between xl:gap-8 gap-4 mb-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 w-full overflow-hidden">
          <h1 className="text-lg font-bold text-text-primary whitespace-nowrap shrink-0">CSAT Room (Surveys)</h1>
          <div className="flex flex-col md:flex-row gap-2 xl:gap-4 w-full overflow-hidden">
             <div className="flex overflow-x-auto no-scrollbar bg-surface-muted p-1 rounded-lg w-full md:w-max gap-1">
               <button
                 onClick={() => setViewMode('full')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   viewMode === 'full' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <CheckCircle className="w-3.5 h-3.5" />
                 Full Score
               </button>
               <button
                 onClick={() => setViewMode('fair')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   viewMode === 'fair' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <Filter className="w-3.5 h-3.5" />
                 After Takeout
               </button>
             </div>
             
             <div className="flex overflow-x-auto no-scrollbar bg-surface-muted p-1 rounded-lg w-full md:w-max gap-1">
               <button
                 onClick={() => setAnalysisMode('agent')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'agent' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <BarChart2 className="w-3.5 h-3.5" />
                 Agent Analysis
               </button>
               <button
                 onClick={() => setAnalysisMode('defect')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'defect' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <AlertCircle className="w-3.5 h-3.5" />
                 Defect Analysis
               </button>
               <button
                 onClick={() => setAnalysisMode('category')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'category' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <Layers className="w-3.5 h-3.5" />
                 Category Analysis
               </button>
               <button
                 onClick={() => { setAnalysisMode('score'); setSelectedScoreCase('All'); setScoreCasePage(1); }}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'score' 
                     ? "bg-blue-600 text-white font-medium shadow-sm" 
                     : "bg-transparent text-text-secondary font-semibold hover:text-text-primary hover:bg-surface"
                 )}
               >
                 <TrendingUp className="w-3.5 h-3.5" />
                 Score Analysis
               </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search CS ID..." 
              className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:border-primary focus:outline-none w-full md:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isComparisonEnabled && (
        <>
          <WoWChartPanel 
            data={data} 
            previousData={previousData} 
            previousData2={previousData2} 
            previousData3={previousData3} 
            viewMode={viewMode}
          />
          <RespondentChartPanel
            data={data} 
            previousData={previousData} 
            previousData2={previousData2} 
            previousData3={previousData3} 
          />
        </>
      )}

      <KpiTicker items={tickerItems} />

      {analysisMode === 'score' ? (
        <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <h2 className="text-sm font-bold text-text-primary">Global Score Distribution</h2>
               <p className="text-xs text-text-muted mt-1 ">{totalScoreRows} total tickets processed</p>
             </div>
             
             <div className="flex flex-col md:flex-row bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden w-full md:w-auto">
                <div className="flex flex-col justify-center px-4 md:px-6 py-3 border-b md:border-b-0 md:border-r border-border"
                     style={{ borderLeftWidth: '4px', borderLeftColor: 'rgb(var(--kpi-csat))' }}>
                   <div className="flex items-center justify-between md:justify-start gap-4 mb-2">
                     <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">TOTAL RATING RESPONDENTS</span>
                     <span className="text-xl font-bold ml-auto" style={{ color: 'rgb(var(--kpi-csat))' }}>{formatNum(answeredScoreRows, 0)}</span>
                   </div>
                   <div className="flex flex-wrap gap-2 md:gap-4 text-[11px] font-bold items-center">
                     <span className="text-success flex items-center gap-1">5<Star className="w-3 h-3 fill-current"/>: {formatNum(scoreDistribution['5'] || 0, 0)}</span>
                     <span className="text-success flex items-center gap-1">4<Star className="w-3 h-3 fill-current"/>: {formatNum(scoreDistribution['4'] || 0, 0)}</span>
                     <span className="text-text-muted flex items-center gap-1">3<Star className="w-3 h-3 fill-current"/>: {formatNum(scoreDistribution['3'] || 0, 0)}</span>
                     <span className="text-warning flex items-center gap-1">2<Star className="w-3 h-3 fill-current"/>: {formatNum(scoreDistribution['2'] || 0, 0)}</span>
                     <span className="text-danger flex items-center gap-1">1<Star className="w-3 h-3 fill-current"/>: {formatNum(scoreDistribution['1'] || 0, 0)}</span>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center px-6 py-3 bg-surface-muted/30">
                   <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase mb-1">Response Rate</span>
                   <span className="text-lg font-black text-primary">{formatNum(surveyResponseRate, 1)}%</span>
                   <span className="text-[10px] text-text-muted font-medium mt-0.5">({formatNum(answeredScoreRows, 0)} / {formatNum(totalScoreRows, 0)} Ratings)</span>
                </div>
             </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
               {['All', 'No Survey', '1', '2', '3', '4', '5'].map(score => {
                 const count = scoreDistribution[score as keyof typeof scoreDistribution];
                 const pct = totalScoreRows > 0 ? (count / totalScoreRows) * 100 : 0;
                 const isSelected = selectedScoreCase === score;

                 return (
                   <button
                     key={score}
                     onClick={() => { setSelectedScoreCase(score); setScoreCasePage(1); }}
                     className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary-soft/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-border hover:border-text-muted/30 bg-card hover:bg-surface-muted'}`}
                   >
                     <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 text-center">
                        {score === 'No Survey' ? 'No Survey' : score === 'All' ? 'All Surveys' : `Score ${score}`}
                     </div>
                     <div className={`text-2xl font-black mb-1 ${score === 'No Survey' || score === 'All' ? 'text-text-primary' : score === '4' || score === '5' ? 'text-success' : score === '3' ? 'text-warning' : 'text-danger'}`}>{formatNum(count, 0)}</div>
                     <div className="text-xs font-medium text-text-muted">{formatNum(pct, 1)}%</div>
                   </button>
                 );
               })}
            </div>
          </div>

          <div className="border-t border-border mt-2 bg-surface">
             <div className="p-4 border-b border-border bg-surface-muted">
               <h2 className="text-sm font-bold text-text-primary">Detailed Analysis: {selectedScoreCase === 'No Survey' ? 'No Survey' : selectedScoreCase === 'All' ? 'All Surveys' : `Score ${selectedScoreCase}`}</h2>
               <p className="text-xs text-text-muted mt-1">Select a score card above to view cases and agents associated with that score</p>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                 <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                   <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Top Cases</div>
                    <table className="w-full text-left text-[10px]">
                     <thead className="bg-surface text-text-secondary border-b border-border">
                       <tr>
                         <th className="p-2 font-bold w-12 text-center  min-w-[60px] max-w-[60px]">Rank</th>
                         <th className="p-2 font-bold ">Case / Category Name</th>
                         <th className="p-2 font-bold w-24 text-center">Freq</th>
                       </tr>
                     </thead>
                     <tbody className="">
                       {scoreAnalysisTopCases.slice((scoreCasePage - 1) * 20, scoreCasePage * 20).map((cat) => {
                         const isTakeoutCategory = TAKEOUT_CATEGORIES.includes(cat.name);
                         return (
                         <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                           <td className="p-2 text-center text-text-muted font-medium">{cat.rank}</td>
                           <td className={`p-2 font-medium max-w-[200px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                           <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(cat.count, 0)}</td>
                         </tr>
                       )})}
                       {scoreAnalysisTopCases.length === 0 && (
                         <tr>
                           <td colSpan={3} className="p-8 text-center text-text-muted text-sm border-b border-border">
                             No cases found.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>

                 <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                   <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Top Agents</div>
                   <table className="w-full text-left text-[10px]">
                     <thead className="bg-surface text-text-secondary border-b border-border">
                       <tr>
                         <th className="p-2 font-bold w-12 text-center  min-w-[60px] max-w-[60px]">Rank</th>
                         <th className="p-2 font-bold ">Agent Name</th>
                         <th className="p-2 font-bold w-24 text-center">Freq</th>
                       </tr>
                     </thead>
                     <tbody className="">
                       {scoreAnalysisTopAgents.slice((scoreCasePage - 1) * 20, scoreCasePage * 20).map((agt) => (
                         <tr key={agt.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                           <td className="p-2 text-center text-text-muted font-medium">{agt.rank}</td>
                           <td className="p-2 font-medium text-text-primary max-w-[200px] truncate" title={agt.name}>{agt.name}</td>
                           <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(agt.count, 0)}</td>
                         </tr>
                       ))}
                       {scoreAnalysisTopAgents.length === 0 && (
                         <tr>
                           <td colSpan={3} className="p-8 text-center text-text-muted text-sm border-b border-border">
                             No agents found.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>
             </div>
             
             {/* Pagination */}
             {(scoreAnalysisTopCases.length > 20 || scoreAnalysisTopAgents.length > 20) && (
               <div className="px-4 py-3 border-t border-border bg-surface flex items-center justify-between">
                 <span className="text-xs text-text-muted">
                   Showing Page {scoreCasePage} of {Math.max(Math.ceil(scoreAnalysisTopCases.length / 20), Math.ceil(scoreAnalysisTopAgents.length / 20))}
                 </span>
                 <div className="flex gap-2">
                   <button 
                     onClick={() => setScoreCasePage(p => Math.max(1, p - 1))}
                     disabled={scoreCasePage === 1}
                     className="px-3 py-1 bg-card border border-border rounded-xl text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
                   >
                     Previous
                   </button>
                   <button 
                     onClick={() => setScoreCasePage(p => p + 1)}
                     disabled={scoreCasePage >= Math.max(Math.ceil(scoreAnalysisTopCases.length / 20), Math.ceil(scoreAnalysisTopAgents.length / 20))}
                     className="px-3 py-1 bg-card border border-border rounded-xl text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
                   >
                     Next
                   </button>
                 </div>
               </div>
             )}
          </div>
        </div>
      ) : analysisMode === 'category' ? (
        <div className="flex flex-col gap-6">
          {/* Categories Panel */}
          <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-sm font-bold text-text-primary">Top Categories (Score 1 & 2)</h2>
                 <p className="text-xs text-text-muted mt-1 ">Identifies categories and top contributors for bad scores</p>
               </div>
               <span className="text-[11px] text-text-secondary font-bold px-3 py-1.5 bg-card border border-border rounded-lg uppercase tracking-wider">
                 {viewMode === 'full' ? 'From Full Data' : 'After Take Out'}
               </span>
            </div>

            <div className="p-4">
              {isComparisonEnabled ? (
                <WoWAnalysisPanel 
                  type="category"
                  data={data} 
                  previousData={previousData} 
                  previousData2={previousData2} 
                  previousData3={previousData3} 
                  viewMode={viewMode}
                  search={search}
                  filterTL={filterTL}
                />
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                 <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Top 10 Categories</div>
                <table className="w-full text-left text-[10px]">
                 <thead className="bg-surface text-text-secondary border-b border-border">
                   <tr>
                     <th className="p-2 font-bold w-12 text-center min-w-[60px] max-w-[60px]">Rank</th>
                     <th className="p-2 font-bold ">Category Name</th>
                     <th className="p-2 font-bold w-16 text-center">Freq</th>
                     {isComparisonEnabled && <th className="p-2 font-bold w-16 text-center">WoW</th>}
                   </tr>
                 </thead>
                 <tbody className="">
                   {topCategories.map((cat) => {
                      const isTakeoutCategory = [
                          "tidak bisa transaksi namun memiliki limit",
                          "pengajuan limit kredit ditolak",
                          "pertanyaan belum bisa diidentifikasi"
                      ].includes(cat.name.toLowerCase());
                      
                      const prevCount = prevTopCategories[cat.name] || 0;
                      const diff = cat.count - prevCount;
                      const isUp = diff > 0;
                      const isDown = diff < 0;
                      
                      return (
                        <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                          <td className="p-2 text-center text-text-muted font-medium">{cat.rank}</td>
                          <td className={`p-2 font-medium max-w-[200px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                          <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(cat.count, 0)}</td>
                          {isComparisonEnabled && (
                            <td className="p-2 text-center font-bold text-[10px]">
                              {diff !== 0 ? (
                                <span className={isUp ? 'text-red-500' : 'text-green-500'}>
                                  {isUp ? '▲' : '▼'} {Math.abs(diff)}
                                </span>
                              ) : (
                                <span className="text-text-tertiary">▬ 0</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                   })}
                   {topCategories.length === 0 && (
                     <tr>
                       <td colSpan={3} className="p-8 text-center text-text-muted text-sm border-b border-border">
                         No categories found for the selected criteria.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
              </div>
              )}
            </div>
          </div>

          {/* Agents Panel */}
          <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-sm font-bold text-text-primary">Agent Bottom Score 1-2</h2>
                 <p className="text-xs text-text-muted mt-1 ">Identifies agents with the highest bad scores</p>
               </div>
               <span className="text-[11px] text-text-secondary font-bold px-3 py-1.5 bg-card border border-border rounded-lg uppercase tracking-wider">
                 {viewMode === 'full' ? 'From Full Data' : 'After Take Out'}
               </span>
            </div>

            <div className="p-4">
              {isComparisonEnabled ? (
                <WoWAnalysisPanel 
                  type="agent"
                  data={data} 
                  previousData={previousData} 
                  previousData2={previousData2} 
                  previousData3={previousData3} 
                  viewMode={viewMode}
                  search={search}
                  filterTL={filterTL}
                />
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
               <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Critical Agents</div>
               <table className="w-full text-left text-[10px]">
                 <thead className="bg-surface text-text-secondary border-b border-border">
                   <tr>
                     <th className="p-2 font-bold w-12 text-center min-w-[60px] max-w-[60px]">Rank</th>
                     <th className="p-2 font-bold ">Agent Name</th>
                     <th className="p-2 font-bold w-24 text-center">Freq</th>
                   </tr>
                 </thead>
                 <tbody className="">
                   {agentRankings.critical.map((agent, i) => (
                     <tr key={agent.csId} className="border-b border-border hover:bg-surface-muted transition-colors group">
                       <td className="p-2 text-center text-text-muted font-medium">{i+1}</td>
                       <td className="p-2 font-medium text-text-primary max-w-[200px] truncate" title={agent.name}>{agent.name}</td>
                       <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{agent.badScoreCount}</td>
                     </tr>
                   ))}
                   {agentRankings.critical.length === 0 && (
                     <tr>
                       <td colSpan={3} className="p-8 text-center text-text-muted text-sm border-b border-border">
                         No critical agents found.
                       </td>
                     </tr>
                   )}
                 </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        </div>
      ) : analysisMode === 'agent' ? (
        <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
            <thead className="bg-surface text-text-secondary sticky top-0 z-30">
              <tr>
                <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                <SortableHeader label="Name / CS ID" sortKey="name" config={agentSortConfig} onSort={handleAgentSort} className="md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
                <SortableHeader label="BPO" sortKey="bpo" config={agentSortConfig} onSort={handleAgentSort} className="md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
                <SortableHeader label="Team Leader" sortKey="teamLeader" config={agentSortConfig} onSort={handleAgentSort} className="md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
                {uniqueDates.map(date => (
                  <th key={date} className={`p-2 font-bold text-center text-text-muted bg-surface `}>
                    {date}
                  </th>
                ))}
                <SortableHeader label="Average" sortKey="average" config={agentSortConfig} onSort={handleAgentSort} className="text-center text-text-primary bg-surface shrink-0 z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]" />
                <th className="p-2 font-bold text-center text-text-primary bg-surface md:sticky md:right-0 z-40 border-l border-border/50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="">
              {sortedAgentData.map((agent, index) => {
                const totalScore = viewMode === 'full' ? agent.csatScFullScore : agent.csatScFairScore;
                const totalCount = viewMode === 'full' ? agent.csatScFullCount : agent.csatScFairCount;
                
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
                    const dailyArr = viewMode === 'full' ? agent.dailyHistory.csatScFull : agent.dailyHistory.csatScFair;
                    const daily = dailyArr?.find(h => h.date === date);
                    const sched = agent.dailyHistory?.schedule?.find(h => h.date === date);
                    const status = sched?.status?.toUpperCase() || '';
                      
                    const isOff = status === 'OFF' || status === 'C';
                    const isPullout = status === 'PULLOUT';
                    const bgClass = isOff ? 'text-text-muted' : '';
                    
                    if (!daily || daily.count === 0 || isOff) {
                      return (
                        <td key={date} className={`p-0 text-center text-text-disabled z-10 ${bgClass}`}>
                           <button 
                             onClick={() => isOff ? null : setSelectedAgent({ agent, date, type: 'csat' })} 
                             className={`w-full h-full min-h-[36px] flex flex-col items-center justify-center transition-colors group/btn relative ${isOff ? 'cursor-default' : 'hover:bg-surface-muted cursor-pointer'}`}
                             title={isOff && daily && daily.count > 0 ? `Agent OFF — ${daily.count} survey(s) tetap dihitung di total` : ''}
                           >
                             <span className="text-[11px]">
                               {isOff ? <span className="text-text-muted/40 italic text-[9px]">off</span> : '-'}
                             </span>
                             {!isOff && <Eye className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity absolute right-1 text-text-muted" />}
                           </button>
                        </td>
                      );
                    }
                    // Official formula: good_count / total_valid × 100 (score 3 excluded, stored in daily.score=good, daily.count=total_valid)
                    const avg = daily.count > 0 ? (daily.score / daily.count) * 100 : 0;
                    const baseColor = getKpiColor(avg, viewMode === 'full' ? 'csatFull' : 'csatFair');
                    const textColor = isPullout ? `text-text-muted italic` : baseColor;

                    return (
                      <td key={date} className={`p-0 text-center z-10 ${bgClass}`}>
                        <button 
                          onClick={() => setSelectedAgent({ agent, date, type: 'csat' })} 
                          className="w-full h-full min-h-[36px] flex flex-col items-center justify-center hover:bg-surface-muted transition-colors group/btn relative cursor-pointer"
                        >
                          <span className={`text-[11px] font-bold ${textColor}`}>
                            {formatNum(avg)}%
                          </span>
                          <span className={`text-[9px] font-medium ${isPullout ? 'text-text-muted/70 italic' : 'text-text-muted'}`}>({daily.count} surveys)</span>
                          <Eye className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 text-text-muted transition-opacity absolute right-1" />
                        </button>
                      </td>
                    );
                  })}
                  
                  <td className={`p-2 text-center font-bold  z-10  relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]`}>
                    {totalCount > 0 ? (
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold ${getKpiColor(
                          viewMode === 'full'
                            ? (agent.csatScTotalValid > 0 ? (agent.csatScGoodCount / agent.csatScTotalValid) * 100 : 0)
                            : (agent.csatScFairTotalValid > 0 ? (agent.csatScFairGoodCount / agent.csatScFairTotalValid) * 100 : 0),
                          viewMode === 'full' ? 'csatFull' : 'csatFair'
                        )}`}>
                          {formatNum(
                            viewMode === 'full'
                              ? (agent.csatScTotalValid > 0 ? (agent.csatScGoodCount / agent.csatScTotalValid) * 100 : 0)
                              : (agent.csatScFairTotalValid > 0 ? (agent.csatScFairGoodCount / agent.csatScFairTotalValid) * 100 : 0)
                          )}%
                        </span>
                        <span className="text-[9px] text-text-muted font-medium">({totalCount} surveys)</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-2 text-center flex items-center justify-center z-10 md:sticky md:right-0 bg-card group-hover:bg-surface-muted border-l border-border/50">
                    <button 
                      onClick={() => setSelectedAgent({ agent, type: 'csat' })}
                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-muted relative cursor-pointer"
                      title="View All Detail"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="font-bold">Detail</span>
                    </button>
                  </td>
                </tr>
              )})}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={6 + uniqueDates.length} className="p-4 text-center text-text-muted text-sm z-10">
                    Tidak ada data yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : analysisMode === 'defect' ? (
        <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
            <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
            <thead className="bg-surface text-text-secondary sticky top-0 z-30">
              <tr>
                <th className="p-2 font-bold text-center border-b border-border md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                <SortableHeader label="Name / CS ID" sortKey="name" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]" />
                <SortableHeader label="BPO" sortKey="bpo" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]" />
                <SortableHeader label="Team Leader" sortKey="teamLeader" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]" />
                <SortableHeader label="Score 1" sortKey="score1" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface" />
                <SortableHeader label="Score 2" sortKey="score2" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface" />
                <SortableHeader label="Score 3" sortKey="score3" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface" />
                <SortableHeader label="Score 4" sortKey="score4" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface" />
                <SortableHeader label="Score 5" sortKey="score5" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border text-center bg-surface" />
                <SortableHeader label="Most Frequent Category" sortKey="category" config={defectSortConfig} onSort={handleDefectSort} className="border-b border-border bg-surface w-full" />
                <th className="p-2 font-bold text-center text-text-primary bg-surface md:sticky md:right-0 z-40 border-b border-border border-l border-border/50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="">
              {sortedDefectData.map((agent, index) => {
                const displayName = agent.name || agent.csId;
                
                const score1Count = agent.csatHistory.filter(h => h.score === 1 && (viewMode === 'full' || !h.isTakeout)).length;
                const score2Count = agent.csatHistory.filter(h => h.score === 2 && (viewMode === 'full' || !h.isTakeout)).length;
                const score3Count = agent.csatHistory.filter(h => h.score === 3 && (viewMode === 'full' || !h.isTakeout)).length;
                const score4Count = agent.csatHistory.filter(h => h.score === 4 && (viewMode === 'full' || !h.isTakeout)).length;
                const score5Count = agent.csatHistory.filter(h => h.score === 5 && (viewMode === 'full' || !h.isTakeout)).length;
                
                const cats = viewMode === 'full' ? agent.csatScCategoriesFull : agent.csatScCategoriesFair;
                let topCat = '-';
                if (Object.keys(cats).length > 0) {
                    topCat = Object.entries(cats).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
                }

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
                  
                  <td className="p-2 text-center z-10">
                     <span className={`px-2 py-1 rounded font-bold text-[11px] ${score1Count > 0 ? 'bg-danger/10 text-danger' : 'text-text-disabled'}`}>
                       {score1Count}
                     </span>
                  </td>
                  <td className="p-2 text-center z-10">
                     <span className={`px-2 py-1 rounded font-bold text-[11px] ${score2Count > 0 ? 'bg-warning/10 text-warning-[.8]' : 'text-text-disabled'}`}>
                       {score2Count}
                     </span>
                  </td>
                  <td className="p-2 text-center z-10">
                     <span className={`px-2 py-1 rounded font-bold text-[11px] ${score3Count > 0 ? 'bg-warning/10 text-warning' : 'text-text-disabled'}`}>
                       {score3Count}
                     </span>
                  </td>
                  <td className="p-2 text-center z-10">
                     <span className={`px-2 py-1 rounded font-bold text-[11px] ${score4Count > 0 ? 'bg-success/10 text-success' : 'text-text-disabled'}`}>
                       {score4Count}
                     </span>
                  </td>
                  <td className="p-2 text-center z-10">
                     <span className={`px-2 py-1 rounded font-bold text-[11px] ${score5Count > 0 ? 'bg-success/10 text-success' : 'text-text-disabled'}`}>
                       {score5Count}
                     </span>
                  </td>
                  <td className="p-2 font-medium text-text-primary z-10 truncate max-w-[300px]">
                    {topCat}
                  </td>
                  
                  <td className="p-2 text-center flex items-center justify-center z-10 md:sticky md:right-0 bg-card group-hover:bg-surface-muted border-l border-border/50">
                    <button 
                      onClick={() => setSelectedAgent({ agent, type: 'defects' })}
                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-muted relative cursor-pointer"
                      title="View Defect Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="font-bold">Detail</span>
                    </button>
                  </td>
                </tr>
              )})}
              {tableData.filter(agent => (viewMode === 'full' ? agent.csatScBadScoreFullCount : agent.csatScBadScoreFairCount) > 0).length === 0 && (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-text-muted text-sm z-10">
                    Tidak ada defect csat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      
      {selectedAgent && (
        <CsatDetailModal
          selectedAgent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          expandedDates={expandedDates}
          toggleExpandDate={(date) => {
            const newExpanded = new Set(expandedDates);
            if (newExpanded.has(date)) newExpanded.delete(date);
            else newExpanded.add(date);
            setExpandedDates(newExpanded);
          }}
          viewMode={viewMode}
        />
      )}
    </div>
  );
};

const WoWChartPanel = ({ data, previousData, previousData2, previousData3, viewMode }: any) => {
  const { startDate, endDate } = useStore();

  const getWeekLabel = (offset: number) => {
    if (!startDate || !endDate) return `Week -${offset}`;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const end = new Date(endDate);
    end.setDate(end.getDate() - (offset * diff));
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(end);
    const weekNum = Math.ceil(end.getDate() / 7);
    return `W${weekNum} ${month}`;
  };

  const calcStats = (dataset: AgentKPI[]) => {
    let sumFull = 0, countFull = 0;
    let sumTakeout = 0, countTakeout = 0;
    
    (dataset || []).forEach(d => {
      sumFull += d.csatScGoodCount || 0;
      countFull += d.csatScTotalValid || 0;
      sumTakeout += d.csatScFairGoodCount || 0;
      countTakeout += d.csatScFairTotalValid || 0;
    });

    return {
      full: countFull > 0 ? Number(((sumFull / countFull) * 100).toFixed(2)) : 0,
      takeout: countTakeout > 0 ? Number(((sumTakeout / countTakeout) * 100).toFixed(2)) : 0,
    };
  };

  const w0 = calcStats(data);
  const w1 = calcStats(previousData);
  const w2 = calcStats(previousData2);
  const w3 = calcStats(previousData3);

  const chartData = [
    { name: getWeekLabel(3), 'SC Full': w3.full, 'SC Takeout': w3.takeout },
    { name: getWeekLabel(2), 'SC Full': w2.full, 'SC Takeout': w2.takeout },
    { name: getWeekLabel(1), 'SC Full': w1.full, 'SC Takeout': w1.takeout },
    { name: getWeekLabel(0), 'SC Full': w0.full, 'SC Takeout': w0.takeout },
  ].filter(d => d.name !== 'WNaN Invalid Date');

  const dailyData = React.useMemo(() => {
    const dates = new Map<string, { goodFull: number, totalFull: number, goodTakeout: number, totalTakeout: number }>();
    (data || []).forEach(a => {
      a.dailyHistory?.csatScFull?.forEach(h => {
        if (!dates.has(h.date)) dates.set(h.date, { goodFull: 0, totalFull: 0, goodTakeout: 0, totalTakeout: 0 });
        if (h.count > 0) {
           dates.get(h.date)!.goodFull += h.score;
           dates.get(h.date)!.totalFull += h.count;
        }
      });
      a.dailyHistory?.csatScFair?.forEach(h => {
        if (!dates.has(h.date)) dates.set(h.date, { goodFull: 0, totalFull: 0, goodTakeout: 0, totalTakeout: 0 });
        if (h.count > 0) {
           dates.get(h.date)!.goodTakeout += h.score;
           dates.get(h.date)!.totalTakeout += h.count;
        }
      });
    });
    
    return Array.from(dates.entries())
      .map(([date, stats]) => {
        const d = new Date(date);
        const validDate = isNaN(d.getTime()) ? date : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
        return {
          date: validDate,
          'SC Full': stats.totalFull > 0 ? Number(((stats.goodFull / stats.totalFull) * 100).toFixed(2)) : 0,
          'SC Takeout': stats.totalTakeout > 0 ? Number(((stats.goodTakeout / stats.totalTakeout) * 100).toFixed(2)) : 0,
          rawDate: date
        };
      })
      .sort((a, b) => parseDateForSort(a.rawDate) - parseDateForSort(b.rawDate));
  }, [data]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Weekly Trend Panel */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-sm font-bold text-text-primary text-center">4-Week Comparison Trend</h3>
          </div>
          <div className="h-80 w-full border border-border/50 rounded-xl p-6 bg-surface/20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="SC Full" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC Full" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#8b5cf6'}} />
                </Bar>
                <Bar dataKey="SC Takeout" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC Takeout" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#10b981'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Trend Panel */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-sm font-bold text-text-primary text-center">Daily Trend (Current Week)</h3>
          </div>
          <div className="h-80 w-full border border-border/50 rounded-xl p-6 bg-surface/20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="SC Full" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC Full" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#8b5cf6'}} />
                </Bar>
                <Bar dataKey="SC Takeout" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC Takeout" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#10b981'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

const WoWAnalysisPanel = ({ data, previousData, previousData2, previousData3, viewMode, search, filterTL, type = 'all' }: any) => {
  const { startDate, endDate } = useStore();

  const getWeekLabel = (offset: number) => {
    if (!startDate || !endDate) return `Week -${offset}`;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const end = new Date(endDate);
    end.setDate(end.getDate() - (offset * diff));
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(end);
    const weekNum = Math.ceil(end.getDate() / 7);
    return `W${weekNum} ${month}`;
  };

  const TAKEOUT_CATEGORIES = [
    "tidak bisa transaksi namun memiliki limit",
    "pengajuan limit kredit ditolak",
    "pertanyaan belum bisa diidentifikasi"
  ];

  const selectedBpo = useStore(state => state.selectedBpo);
  const upperBpo = (selectedBpo || '').toUpperCase();
  const isSmallBpo = upperBpo === 'TCID' || upperBpo === 'TCID X TIN' || upperBpo === 'TIN X TCID';
  const topCatsLimit = isSmallBpo ? 5 : 10;
  const topAgentsLimit = isSmallBpo ? 2 : 5;

  const calcTopCats = (dataset: AgentKPI[]) => {
    const agg: Record<string, number> = {};
    dataset.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      const count = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
      return matchSearch && matchTL && count > 0;
    }).forEach(a => {
       const cats = viewMode === 'full' ? (a.csatScCategoriesFull || {}) : (a.csatScCategoriesFair || {});
       for (const cat in cats) {
          if (!agg[cat]) agg[cat] = 0;
          agg[cat] += cats[cat];
       }
    });
    return Object.entries(agg)
      .sort((a,b) => b[1] - a[1])
      .slice(0, topCatsLimit)
      .map((entry, idx) => ({ rank: idx+1, name: entry[0], count: entry[1] }));
  };

  const calcTopAgents = (dataset: AgentKPI[]) => {
    return dataset.filter(a => {
      const matchSearch = a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase());
      const matchTL = filterTL ? a.teamLeader === filterTL : true;
      const count = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
      return matchSearch && matchTL && count > 0;
    }).map(a => {
       const count = viewMode === 'full' ? (a.csatScBadScoreFullCount || 0) : (a.csatScBadScoreFairCount || 0);
       return { name: a.name || a.csId, csId: a.csId, badScoreCount: count };
    }).sort((a, b) => b.badScoreCount - a.badScoreCount).filter(a => a.badScoreCount > 0).slice(0, topAgentsLimit);
  };

  const weeks = [
    { 
      name: getWeekLabel(3), 
      cats: type === 'all' || type === 'category' ? calcTopCats(previousData3) : [], 
      agents: type === 'all' || type === 'agent' ? calcTopAgents(previousData3) : [] 
    },
    { 
      name: getWeekLabel(2), 
      cats: type === 'all' || type === 'category' ? calcTopCats(previousData2) : [], 
      agents: type === 'all' || type === 'agent' ? calcTopAgents(previousData2) : [] 
    },
    { 
      name: getWeekLabel(1), 
      cats: type === 'all' || type === 'category' ? calcTopCats(previousData) : [], 
      agents: type === 'all' || type === 'agent' ? calcTopAgents(previousData) : [] 
    },
    { 
      name: getWeekLabel(0), 
      cats: type === 'all' || type === 'category' ? calcTopCats(data) : [], 
      agents: type === 'all' || type === 'agent' ? calcTopAgents(data) : [] 
    },
  ].filter(d => d.name !== 'WNaN Invalid Date');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {weeks.map((week, wIdx) => (
        <div key={wIdx} className="flex flex-col gap-4">
          <div className="p-2 bg-primary/10 text-primary font-bold text-center rounded-xl border border-primary/20 text-[11px] uppercase tracking-wider">
            {week.name}
          </div>
          
          {(type === 'all' || type === 'category') && (
            <div className="overflow-hidden border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col">
              <div className="p-2 bg-surface-muted border-b border-border font-bold text-[10px] text-text-secondary text-center uppercase">
                Top {topCatsLimit} Categories
              </div>
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface text-text-secondary border-b border-border">
                <tr>
                  <th className="p-1.5 font-bold w-6 text-center">#</th>
                  <th className="p-1.5 font-bold">Category</th>
                  <th className="p-1.5 font-bold w-8 text-center">Freq</th>
                </tr>
              </thead>
              <tbody>
                {week.cats.map((cat, i) => {
                  const isTakeoutCategory = TAKEOUT_CATEGORIES.includes(cat.name.toLowerCase());
                  return (
                    <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors">
                      <td className="p-1.5 text-center text-text-muted font-medium">{i+1}</td>
                      <td className={`p-1.5 font-medium max-w-[120px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                      <td className="p-1.5 text-center font-bold text-[10px] text-text-secondary">{formatNum(cat.count, 0)}</td>
                    </tr>
                  );
                })}
                {week.cats.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-text-muted text-[10px] border-b border-border">
                      No categories
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {(type === 'all' || type === 'agent') && (
            <div className="overflow-hidden border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col">
              <div className="p-2 bg-surface-muted border-b border-border font-bold text-[10px] text-text-secondary text-center uppercase">
                Top {topAgentsLimit} Agents
              </div>
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface text-text-secondary border-b border-border">
                <tr>
                  <th className="p-1.5 font-bold w-6 text-center">#</th>
                  <th className="p-1.5 font-bold">Agent Name</th>
                  <th className="p-1.5 font-bold w-8 text-center">Freq</th>
                </tr>
              </thead>
              <tbody>
                {week.agents.map((agent, i) => {
                  const isRepeat = wIdx === weeks.length - 1 && weeks[wIdx - 1].agents.some(prevAgent => prevAgent.csId === agent.csId);
                  return (
                    <tr key={agent.csId} className="border-b border-border hover:bg-surface-muted transition-colors">
                      <td className="p-1.5 text-center text-text-muted font-medium">{i+1}</td>
                      <td className={`p-1.5 font-medium max-w-[120px] truncate ${isRepeat ? 'text-danger font-bold' : 'text-text-primary'}`} title={agent.name}>{agent.name}</td>
                      <td className="p-1.5 text-center font-bold text-[10px] text-text-secondary">{agent.badScoreCount}</td>
                    </tr>
                  );
                })}
                {week.agents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-text-muted text-[10px] border-b border-border">
                      No critical agents
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

        </div>
      ))}
    </div>
  );
};
const RespondentChartPanel = ({ data, previousData, previousData2, previousData3 }: any) => {
  const { startDate, endDate } = useStore();

  const getWeekLabel = (offset: number) => {
    if (!startDate || !endDate) return `Week -${offset}`;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const end = new Date(endDate);
    end.setDate(end.getDate() - (offset * diff));
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(end);
    const weekNum = Math.ceil(end.getDate() / 7);
    return `W${weekNum} ${month}`;
  };

  const calcRespStats = (dataset: AgentKPI[]) => {
    let totalProcessed = 0;
    let totalRespondents = 0;
    let s5 = 0, s4 = 0, s3 = 0, s2 = 0, s1 = 0;
    (dataset || []).forEach(a => {
      totalProcessed += a.csatHistory.length;
      a.csatHistory.forEach(h => {
        if (h.score >= 1 && h.score <= 5) {
          totalRespondents += 1;
          if (h.score === 5) s5++;
          if (h.score === 4) s4++;
          if (h.score === 3) s3++;
          if (h.score === 2) s2++;
          if (h.score === 1) s1++;
        }
      });
    });
    let rate = totalProcessed > 0 ? Number(((totalRespondents / totalProcessed) * 100).toFixed(1)) : 0;
    return { processed: totalProcessed, respondents: totalRespondents, rate, s5, s4, s3, s2, s1 };
  };

  const weeksData = React.useMemo(() => {
    const w0 = calcRespStats(data);
    const w1 = calcRespStats(previousData);
    const w2 = calcRespStats(previousData2);
    const w3 = calcRespStats(previousData3);

    return [
      { name: getWeekLabel(3), ...w3 },
      { name: getWeekLabel(2), ...w2 },
      { name: getWeekLabel(1), ...w1 },
      { name: getWeekLabel(0), ...w0 },
    ].filter(d => d.name !== 'WNaN Invalid Date');
  }, [data, previousData, previousData2, previousData3, startDate, endDate]);

  const dailyRespData = React.useMemo(() => {
    const dates = new Map<string, { processed: number, respondents: number, s5: number, s4: number, s3: number, s2: number, s1: number }>();
    (data || []).forEach(a => {
      a.csatHistory.forEach(h => {
        if (!dates.has(h.date)) dates.set(h.date, { processed: 0, respondents: 0, s5:0, s4:0, s3:0, s2:0, s1:0 });
        const dInfo = dates.get(h.date)!;
        dInfo.processed += 1;
        if (h.score >= 1 && h.score <= 5) {
          dInfo.respondents += 1;
          if (h.score === 5) dInfo.s5++;
          if (h.score === 4) dInfo.s4++;
          if (h.score === 3) dInfo.s3++;
          if (h.score === 2) dInfo.s2++;
          if (h.score === 1) dInfo.s1++;
        }
      });
    });
    
    return Array.from(dates.entries())
      .map(([date, stats]) => {
        const d = new Date(date);
        let validDate = date;
        if (!isNaN(d.getTime())) {
          validDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
        } else {
          const parts = date.split(' ');
          if (parts.length === 3) validDate = `${parts[0]} ${parts[1]}`;
        }
        return {
          date: validDate,
          Respondents: stats.respondents,
          s5: stats.s5, s4: stats.s4, s3: stats.s3, s2: stats.s2, s1: stats.s1,
          rawDate: date
        };
      })
      .sort((a, b) => parseDateForSort(a.rawDate) - parseDateForSort(b.rawDate));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs">
          <p className="font-bold text-text-primary mb-2 border-b border-border pb-1">{label}</p>
          <p className="text-text-secondary font-semibold mb-2">Total Respondents: <span className="text-text-primary">{d.Respondents}</span></p>
          <div className="flex gap-3 font-medium">
            <span className="text-green-500">5★ {d.s5}</span>
            <span className="text-green-400">4★ {d.s4}</span>
            <span className="text-yellow-500">3★ {d.s3}</span>
            <span className="text-orange-500">2★ {d.s2}</span>
            <span className="text-red-500">1★ {d.s1}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-4 shadow-sm">
      <div className="flex items-center justify-center mb-4">
        <h3 className="text-sm font-bold text-text-primary text-center">Respondent Volume Trend</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Weekly Cards */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h4 className="text-xs font-bold text-text-secondary text-center">4-Week Respondents</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 h-full">
            {weeksData.map((w, idx) => {
              const prevW = idx > 0 ? weeksData[idx - 1] : null;
              let diff = 0;
              if (prevW && prevW.respondents > 0) {
                diff = Number((((w.respondents - prevW.respondents) / prevW.respondents) * 100).toFixed(1));
              }
              const isUp = diff > 0;
              const isDown = diff < 0;

              return (
                <div key={idx} className="bg-surface/30 rounded-xl p-4 pb-3 border border-border/50 flex flex-col justify-between items-center relative overflow-hidden group hover:border-primary/30 transition-colors">
                  <div className="absolute top-0 w-full h-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                  <span className="text-sm text-text-secondary font-bold mb-1 mt-1">{w.name}</span>
                  <span className="text-3xl xl:text-4xl font-bold text-text-primary mb-1">{formatNum(w.respondents, 0)}</span>
                  
                  {idx > 0 ? (
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${isUp ? 'text-green-500' : isDown ? 'text-red-500' : 'text-text-tertiary'}`}>
                      {isUp ? '▲' : isDown ? '▼' : '▬'} {Math.abs(diff)}%
                    </div>
                  ) : (
                    <div className="text-[11px] text-text-tertiary font-bold">&nbsp;</div>
                  )}
                  
                  <div className="mt-auto pt-2 border-t border-border/50 w-full text-center flex flex-col gap-1">
                    <span className="text-[11px] text-text-secondary">Rate: <strong className="text-text-primary">{w.rate}%</strong></span>
                    <div 
                      className="flex items-end justify-center gap-2 mt-2 h-16 w-full px-2"
                      title={`5★: ${w.s5} | 4★: ${w.s4} | 3★: ${w.s3} | 2★: ${w.s2} | 1★: ${w.s1}`}
                    >
                      {[
                        { label: '1★', value: w.s1, color: 'bg-danger' },
                        { label: '2★', value: w.s2, color: 'bg-orange-500' },
                        { label: '3★', value: w.s3, color: 'bg-warning' },
                        { label: '4★', value: w.s4, color: 'bg-[#84cc16]' },
                        { label: '5★', value: w.s5, color: 'bg-success' }
                      ].map(bar => {
                        const maxVal = Math.max(w.s1, w.s2, w.s3, w.s4, w.s5) || 1;
                        const heightPct = (bar.value / maxVal) * 100;
                        return (
                          <div key={bar.label} className="flex flex-col items-center gap-0.5 group/bar flex-1 max-w-[28px] h-full relative">
                            <span className="text-[9px] font-bold text-text-primary leading-none">{bar.value}</span>
                            <span className="text-[8px] font-bold text-text-muted leading-none mt-0.5">{bar.label}</span>
                            <div className="w-full bg-surface-muted/50 rounded flex-1 flex items-end overflow-hidden border border-border/30 mt-0.5">
                              <div className={`w-full rounded-sm ${bar.color} transition-all duration-700`} style={{ height: `${heightPct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Daily Area Chart */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h4 className="text-xs font-bold text-text-secondary text-center">Daily Respondents (Current Week)</h4>
          </div>
          <div className="h-full min-h-[380px] w-full border border-border/50 rounded-xl p-6 bg-surface/20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRespData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 11}} axisLine={false} tickLine={false} minTickGap={10} />
                <YAxis tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2}} />
                <Area type="monotone" dataKey="Respondents" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorResp)">
                  <LabelList dataKey="Respondents" position="top" style={{fontSize: '11px', fontWeight: 'bold', fill: '#f59e0b'}} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
export default CsatRoom;
