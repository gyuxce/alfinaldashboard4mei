import React, { useMemo, useState } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort, cn } from '../../lib/utils';
import { Search, Star, Eye, X, AlertCircle, ChevronDown, ChevronUp, BarChart2, ArrowUpDown } from 'lucide-react';
import { useStore } from '../../store';
import { KpiTicker, buildRankingItems, TickerItem } from '../ui/KpiTicker';

import { SortableHeader } from '../ui/SortableHeader';
import { CsatDetailModal } from "./CsatDetailModal";


export const CsatRoom: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
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
      .slice(0, 20)
      .map((entry, idx) => ({ rank: idx+1, name: entry[0], count: entry[1] }));
  }, [tableData, viewMode]);

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
    let totalSum = 0;
    let totalCount = 0;
    const bpoStats: Record<string, { sum: number; count: number }> = {};
    const tlStats: Record<string, { sum: number; count: number }> = {};

    tableData.forEach(agent => {
       const score = viewMode === 'full' ? agent.csatScFullScore : agent.csatScFairScore;
       const count = viewMode === 'full' ? agent.csatScFullCount : agent.csatScFairCount;
       if (count > 0) {
          totalSum += score;
          totalCount += count;
          const bpo = agent.bpo || 'Unknown';
          if (!bpoStats[bpo]) bpoStats[bpo] = { sum: 0, count: 0 };
          bpoStats[bpo].sum += score;
          bpoStats[bpo].count += count;

          const tl = agent.teamLeader || 'Unknown';
          if (!tlStats[tl]) tlStats[tl] = { sum: 0, count: 0 };
          tlStats[tl].sum += score;
          tlStats[tl].count += count;
       }
    });

    const bpoArr = Object.entries(bpoStats).map(([bpo, st]) => ({ bpo, avg: (st.sum / st.count) * 100 / 5 })).sort((a,b) => b.avg - a.avg);
    const tlArr = Object.entries(tlStats).map(([tl, st]) => ({ tl, avg: (st.sum / st.count) * 100 / 5 })).filter(x => x.tl !== 'Unknown' && x.tl !== '-').sort((a,b) => b.avg - a.avg);

    const sortedTLs = tlArr.slice(0, 5);
    const sortedAgents = [...tableData].filter(a => (viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount) > 0).map(a => {
       const score = viewMode === 'full' ? a.csatScFullScore : a.csatScFairScore;
       const count = viewMode === 'full' ? a.csatScFullCount : a.csatScFairCount;
       return { ...a, avg: (score / count) * 100 / 5 };
    }).sort((a, b) => b.avg - a.avg).slice(0, 5);

    const bpoArrStr = bpoArr.map(b => `${b.bpo} ${formatNum(b.avg, 1)}%`).join(' · ');
    const overallAvg = totalCount > 0 ? formatNum((totalSum / totalCount) * 100 / 5, 1) + '%' : '-';

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
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
                 )}
               >
                 Full Score
               </button>
               <button
                 onClick={() => setViewMode('fair')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   viewMode === 'fair' 
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
                 )}
               >
                 After Takeout
               </button>
             </div>
             
             <div className="flex overflow-x-auto no-scrollbar bg-surface-muted p-1 rounded-lg w-full md:w-max gap-1">
               <button
                 onClick={() => setAnalysisMode('agent')}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'agent' 
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
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
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
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
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
                 )}
               >
                 Category Analysis
               </button>
               <button
                 onClick={() => { setAnalysisMode('score'); setSelectedScoreCase('All'); setScoreCasePage(1); }}
                 className={cn(
                   "px-4 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2",
                   analysisMode === 'score' 
                     ? "bg-card text-primary font-medium" 
                     : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50"
                 )}
               >
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
                           <td className="p-2 font-medium text-primary max-w-[200px] truncate" title={agt.name}>{agt.name}</td>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
             <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
               <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Top 20 Categories</div>
                <table className="w-full text-left text-[10px]">
                 <thead className="bg-surface text-text-secondary border-b border-border">
                   <tr>
                     <th className="p-2 font-bold w-12 text-center min-w-[60px] max-w-[60px]">Rank</th>
                     <th className="p-2 font-bold ">Category Name</th>
                     <th className="p-2 font-bold w-24 text-center">Freq</th>
                   </tr>
                 </thead>
                 <tbody className="">
                   {topCategories.map((cat) => {
                      const isTakeoutCategory = [
                          "tidak bisa transaksi namun memiliki limit",
                          "pengajuan limit kredit ditolak",
                          "pertanyaan belum bisa diidentifikasi"
                      ].includes(cat.name.toLowerCase());
                      
                      return (
                        <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                          <td className="p-2 text-center text-text-muted font-medium">{cat.rank}</td>
                          <td className={`p-2 font-medium max-w-[200px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                          <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(cat.count, 0)}</td>
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
                       <td className="p-2 font-medium text-primary max-w-[200px] truncate" title={agent.name}>{agent.name}</td>
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
                    
                    if (!daily || daily.count === 0) {
                      return (
                        <td key={date} className={`p-0 text-center text-text-disabled z-10 ${bgClass}  `}>
                           <button 
                             onClick={() => setSelectedAgent({ agent, date, type: 'csat' })} 
                             className="w-full h-full min-h-[36px] flex items-center justify-center hover:bg-surface-muted transition-colors group/btn relative cursor-pointer"
                           >
                             -
                             <Eye className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity absolute right-1 text-text-muted" />
                           </button>
                        </td>
                      );
                    }
                    const avg = (daily.score / daily.count) * 100 / 5;
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
                        <span className={`text-[11px] font-bold ${getKpiColor((totalScore / totalCount) * 100 / 5, viewMode === 'full' ? 'csatFull' : 'csatFair')}`}>
                          {formatNum((totalScore / totalCount) * 100 / 5)}%
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
