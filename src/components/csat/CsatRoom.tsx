import React, { useMemo, useState } from 'react';
import { AgentKPI, CSATEntry, isCsatTakeoutCategory } from '../../lib/dataProcessor';
import { formatNum, getKpiColor, parseDateForSort, cn } from '../../lib/utils';
import { Search, Star, Eye, X, AlertCircle, ChevronDown, ChevronUp, BarChart2, ArrowUpDown, CheckCircle, Filter, Layers, TrendingUp } from 'lucide-react';
import { useStore } from '../../store';

import { SortableHeader } from '../ui/SortableHeader';
import { EmptyState } from '../ui/EmptyState';
import { CsatDetailModal } from "./CsatDetailModal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, AreaChart, Area } from 'recharts';

export const CsatRoom: React.FC<{ data: AgentKPI[], previousData?: AgentKPI[], previousData2?: AgentKPI[], previousData3?: AgentKPI[] }> = ({ data, previousData = [], previousData2 = [], previousData3 = [] }) => {
  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
  const comparisonMode = useStore(state => state.comparisonMode);
  const selectedBpo = useStore(state => state.selectedBpo);
  const [search, setSearch] = useState('');
  const [filterTL, setFilterTL] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'fair'>('full');
  const [analysisMode, setAnalysisMode] = useState<'category' | 'score' | 'agent' | 'defect'>('agent');
  const [selectedScoreCase, setSelectedScoreCase] = useState<string>('All');
  const [scoreCasePage, setScoreCasePage] = useState<number>(1);
  const [selectedAgent, setSelectedAgent] = useState<{agent: AgentKPI, date?: string, type?: 'csat' | 'defects'} | null>(null);
  const [wowModalData, setWowModalData] = useState<{ title: React.ReactNode, subtitle?: React.ReactNode, surveys: CSATEntry[] } | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  
  const handleCategoryClick = (categoryName: string, weekLabel: string, dataset: AgentKPI[]) => {
    const surveys: CSATEntry[] = [];
    dataset.forEach(a => {
      const filtered = a.csatHistory.filter(h => h.category.toLowerCase() === categoryName.toLowerCase() && (viewMode === 'full' || !h.isTakeout) && h.score > 0);
      surveys.push(...filtered);
    });
    if (surveys.length > 0) {
      setWowModalData({
        title: `Category Analysis: ${categoryName}`,
        subtitle: `Data filter: ${weekLabel} (${viewMode === 'full' ? 'Full Data' : 'After Take Out'})`,
        surveys
      });
    }
  };

  const handleAgentClick = (agentId: string, agentName: string, weekLabel: string, dataset: AgentKPI[]) => {
    const agent = dataset.find(a => a.csId === agentId);
    if (agent && agent.csatHistory.length > 0) {
      setWowModalData({
        title: `Historical Audit Trail: ${agentName || agent.csId}`,
        subtitle: `CS ID: ${agent.csId} • Team Leader: ${agent.teamLeader || '-'} • Data filter: ${weekLabel} (${viewMode === 'full' ? 'Full Data' : 'After Take Out'})`,
        surveys: agent.csatHistory.filter(h => (viewMode === 'full' || !h.isTakeout) && h.score > 0)
      });
    }
  };
  
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

  const scoreDistribution = useMemo(() => {
    const dist = {
      'All': 0, 'No Survey': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
      'Bad': 0, 'Good': 0,
    };
    tableData.forEach(a => {
      if (a.csatScScoreDistribution) {
        ['No Survey', '1', '2', '3', '4', '5'].forEach(scoreKey => {
           if (a.csatScScoreDistribution[scoreKey]) {
              const cases = a.csatScScoreDistribution[scoreKey];
              for (const c in cases) {
                 if (viewMode === 'fair' && isCsatTakeoutCategory(c)) continue;
                 const n = cases[c] || 0;
                 dist[scoreKey as keyof typeof dist] += n;
                 dist['All'] += n;
                 if (scoreKey === '1' || scoreKey === '2') dist['Bad'] += n;
                 if (scoreKey === '4' || scoreKey === '5') dist['Good'] += n;
              }
           }
        });
      }
    });
    return dist;
  }, [tableData, viewMode]);

  const getScoresForSelectedCase = (selected: string): string[] => {
    if (selected === 'All') return ['No Survey', '1', '2', '3', '4', '5'];
    if (selected === 'Bad') return ['1', '2'];
    if (selected === 'Good') return ['4', '5'];
    return [selected];
  };

  const scoreAnalysisLabel = useMemo(() => {
    switch (selectedScoreCase) {
      case 'No Survey': return 'No Survey';
      case 'All': return 'All Surveys';
      case 'Bad': return 'Bad Survey (Score 1 + 2)';
      case 'Good': return 'Good Survey (Score 4 + 5)';
      default: return `Score ${selectedScoreCase}`;
    }
  }, [selectedScoreCase]);

  const isAccumulatedScoreCase = selectedScoreCase === 'Bad' || selectedScoreCase === 'Good';
  const accumulatedScoreKeys = selectedScoreCase === 'Bad'
    ? (['1', '2'] as const)
    : selectedScoreCase === 'Good'
      ? (['4', '5'] as const)
      : null;

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
            aVal = viewMode === 'full' ? (a.csatScFull ?? -1) : (a.csatScFair ?? -1);
            bVal = viewMode === 'full' ? (b.csatScFull ?? -1) : (b.csatScFair ?? -1);
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
    const caseByScore: Record<string, Record<string, number>> = {};
    const scoresToProcess = getScoresForSelectedCase(selectedScoreCase);

    tableData.forEach(a => {
       if (a.csatScScoreDistribution) {
          scoresToProcess.forEach(scoreKey => {
            if (a.csatScScoreDistribution[scoreKey]) {
                const cases = a.csatScScoreDistribution[scoreKey];
                for (const c in cases) {
                   if (viewMode === 'fair' && isCsatTakeoutCategory(c)) continue;
                   const n = cases[c] || 0;
                   if (!caseDist[c]) caseDist[c] = 0;
                   caseDist[c] += n;
                   if (!caseByScore[c]) caseByScore[c] = {};
                   caseByScore[c][scoreKey] = (caseByScore[c][scoreKey] || 0) + n;
                }
            }
          });
       }
    });
    return Object.entries(caseDist)
      .sort((a,b) => b[1] - a[1])
      .map((e, idx) => ({
        rank: idx+1,
        name: e[0],
        count: e[1],
        byScore: caseByScore[e[0]] || {},
      }));
  }, [tableData, selectedScoreCase, viewMode]);

  const scoreAnalysisTopAgents = useMemo(() => {
    const agentDist: Record<string, number> = {};
    const agentByScore: Record<string, Record<string, number>> = {};
    const scoresToProcess = getScoresForSelectedCase(selectedScoreCase);

    tableData.forEach(a => {
       if (a.csatScScoreDistribution) {
          const displayName = a.name || a.csId;
          scoresToProcess.forEach(scoreKey => {
            if (a.csatScScoreDistribution[scoreKey]) {
                const cases = a.csatScScoreDistribution[scoreKey];
                let totalForScore = 0;
                for (const c in cases) {
                    if (viewMode === 'fair' && isCsatTakeoutCategory(c)) continue;
                    totalForScore += cases[c] || 0;
                }
                if (totalForScore > 0) {
                    if (!agentDist[displayName]) agentDist[displayName] = 0;
                    agentDist[displayName] += totalForScore;
                    if (!agentByScore[displayName]) agentByScore[displayName] = {};
                    agentByScore[displayName][scoreKey] = (agentByScore[displayName][scoreKey] || 0) + totalForScore;
                }
            }
          });
       }
    });
    return Object.entries(agentDist)
      .sort((a,b) => b[1] - a[1])
      .map((e, idx) => ({
        rank: idx+1,
        name: e[0],
        count: e[1],
        byScore: agentByScore[e[0]] || {},
      }));
  }, [tableData, selectedScoreCase, viewMode]);

  const getAgentTakeoutPct = (agent: AgentKPI) => {
    const total = agent.csatHistory?.length || 0;
    const takeout = agent.csatHistory?.filter((h) => h.isTakeout).length || 0;
    return {
      total,
      takeout,
      pct: total > 0 ? (takeout / total) * 100 : 0,
    };
  };

  const takeoutFairness = useMemo(() => {
    const agentRows = tableData
      .map((a) => {
        const stats = getAgentTakeoutPct(a);
        return {
          csId: a.csId,
          name: a.name || a.csId,
          tl: a.teamLeader || '-',
          bpo: a.bpo || '-',
          ...stats,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.pct - a.pct);

    const tlMap: Record<string, { takeout: number; total: number }> = {};
    agentRows.forEach((r) => {
      if (!tlMap[r.tl]) tlMap[r.tl] = { takeout: 0, total: 0 };
      tlMap[r.tl].takeout += r.takeout;
      tlMap[r.tl].total += r.total;
    });
    const tlRows = Object.entries(tlMap)
      .map(([tl, s]) => ({
        tl,
        takeout: s.takeout,
        total: s.total,
        pct: s.total > 0 ? (s.takeout / s.total) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const teamTotal = agentRows.reduce((s, r) => s + r.total, 0);
    const teamTakeout = agentRows.reduce((s, r) => s + r.takeout, 0);
    return {
      agentRows,
      tlRows,
      teamPct: teamTotal > 0 ? (teamTakeout / teamTotal) * 100 : 0,
      teamTakeout,
      teamTotal,
    };
  }, [tableData]);

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
            viewMode={viewMode}
          />
        </>
      )}

      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Takeout Fairness (% Takeout)</h2>
            <p className="text-xs text-text-muted mt-0.5">
              % tiket takeout dari total tiket CSAT SC per agent / TL — untuk cek apakah takeout merata
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Team Takeout %</div>
            <div className="text-lg font-black text-text-primary">
              {formatNum(takeoutFairness.teamPct, 1)}%
              <span className="text-[11px] font-medium text-text-muted ml-2">
                ({formatNum(takeoutFairness.teamTakeout, 0)} / {formatNum(takeoutFairness.teamTotal, 0)})
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="max-h-[280px] overflow-auto">
            <div className="sticky top-0 px-3 py-2 bg-surface text-[10px] font-bold uppercase tracking-widest text-text-secondary border-b border-border">
              Highest Takeout % — Agent
            </div>
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface-muted text-text-muted">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2">Agent</th>
                  <th className="p-2">TL</th>
                  <th className="p-2 text-center">Takeout</th>
                  <th className="p-2 text-center">Total</th>
                  <th className="p-2 text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {takeoutFairness.agentRows.slice(0, 15).map((r, idx) => (
                  <tr key={r.csId} className="border-b border-border hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted">{idx + 1}</td>
                    <td className="p-2 font-semibold text-text-primary truncate max-w-[160px]" title={r.name}>{r.name}</td>
                    <td className="p-2 text-text-secondary truncate max-w-[100px]" title={r.tl}>{r.tl}</td>
                    <td className="p-2 text-center">{formatNum(r.takeout, 0)}</td>
                    <td className="p-2 text-center">{formatNum(r.total, 0)}</td>
                    <td className={`p-2 text-center font-bold ${r.pct >= takeoutFairness.teamPct + 10 ? 'text-danger' : 'text-text-primary'}`}>
                      {formatNum(r.pct, 1)}%
                    </td>
                  </tr>
                ))}
                {takeoutFairness.agentRows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-text-muted">No ticket data</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="max-h-[280px] overflow-auto">
            <div className="sticky top-0 px-3 py-2 bg-surface text-[10px] font-bold uppercase tracking-widest text-text-secondary border-b border-border">
              Highest Takeout % — Team Leader
            </div>
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface-muted text-text-muted">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2">Team Leader</th>
                  <th className="p-2 text-center">Takeout</th>
                  <th className="p-2 text-center">Total</th>
                  <th className="p-2 text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {takeoutFairness.tlRows.slice(0, 15).map((r, idx) => (
                  <tr key={r.tl} className="border-b border-border hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted">{idx + 1}</td>
                    <td className="p-2 font-semibold text-text-primary truncate max-w-[180px]" title={r.tl}>{r.tl}</td>
                    <td className="p-2 text-center">{formatNum(r.takeout, 0)}</td>
                    <td className="p-2 text-center">{formatNum(r.total, 0)}</td>
                    <td className={`p-2 text-center font-bold ${r.pct >= takeoutFairness.teamPct + 10 ? 'text-danger' : 'text-text-primary'}`}>
                      {formatNum(r.pct, 1)}%
                    </td>
                  </tr>
                ))}
                {takeoutFairness.tlRows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-text-muted">No TL data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9 gap-3">
               {([
                 { key: 'All', label: 'All Surveys', tone: 'neutral' },
                 { key: 'No Survey', label: 'No Survey', tone: 'neutral' },
                 { key: 'Bad', label: 'Bad Survey', sub: 'Score 1 + 2', tone: 'bad' },
                 { key: '1', label: 'Score 1', tone: 'bad' },
                 { key: '2', label: 'Score 2', tone: 'bad' },
                 { key: '3', label: 'Score 3', tone: 'mid' },
                 { key: '4', label: 'Score 4', tone: 'good' },
                 { key: '5', label: 'Score 5', tone: 'good' },
                 { key: 'Good', label: 'Good Survey', sub: 'Score 4 + 5', tone: 'good' },
               ] as const).map(card => {
                 const count = scoreDistribution[card.key];
                 const pct = totalScoreRows > 0 ? (count / totalScoreRows) * 100 : 0;
                 const isSelected = selectedScoreCase === card.key;
                 const countClass =
                   card.tone === 'good' ? 'text-success' :
                   card.tone === 'bad' ? 'text-danger' :
                   card.tone === 'mid' ? 'text-warning' :
                   'text-text-primary';
                 const selectedBorder =
                   card.tone === 'bad' ? 'border-danger ring-2 ring-danger/20 bg-danger/5' :
                   card.tone === 'good' ? 'border-success ring-2 ring-success/20 bg-success/5' :
                   'border-primary ring-2 ring-primary/20 bg-primary-soft/10';

                 return (
                   <button
                     key={card.key}
                     onClick={() => { setSelectedScoreCase(card.key); setScoreCasePage(1); }}
                     className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? `${selectedBorder} shadow-[0_1px_3px_rgba(0,0,0,0.04)]` : 'border-border hover:border-text-muted/30 bg-card hover:bg-surface-muted'}`}
                   >
                     <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1 text-center">
                        {card.label}
                     </div>
                     {'sub' in card && card.sub ? (
                       <div className="text-[10px] font-medium text-text-muted mb-1">{card.sub}</div>
                     ) : (
                       <div className="h-[15px] mb-1" />
                     )}
                     <div className={`text-2xl font-black mb-1 ${countClass}`}>{formatNum(count, 0)}</div>
                     <div className="text-xs font-medium text-text-muted">{formatNum(pct, 1)}%</div>
                     {card.key === 'Bad' && (
                       <div className="mt-2 text-[10px] font-semibold text-danger/80">
                         1: {formatNum(scoreDistribution['1'], 0)} · 2: {formatNum(scoreDistribution['2'], 0)}
                       </div>
                     )}
                     {card.key === 'Good' && (
                       <div className="mt-2 text-[10px] font-semibold text-success/80">
                         4: {formatNum(scoreDistribution['4'], 0)} · 5: {formatNum(scoreDistribution['5'], 0)}
                       </div>
                     )}
                   </button>
                 );
               })}
            </div>
            <p className="mt-3 text-[11px] text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">Catatan Score 3: </span>
              Score 3 ditampilkan di distribusi sebagai mid/netral. Tidak masuk kartu Bad (1+2) maupun Good (4+5),
              dan tidak dihitung dalam CSAT % (hanya score 1, 2, 4, 5 yang valid).
            </p>
          </div>

          <div className="border-t border-border mt-2 bg-surface">
             <div className="p-4 border-b border-border bg-surface-muted">
               <h2 className="text-sm font-bold text-text-primary">Detailed Analysis: {scoreAnalysisLabel}</h2>
               <p className="text-xs text-text-muted mt-1">
                 {isAccumulatedScoreCase
                   ? `Akumulasi top category & agent dari ${scoreAnalysisLabel}. Breakdown per score tetap ditampilkan.`
                   : 'Select a score card above to view cases and agents associated with that score'}
               </p>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                 <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                   <div className="p-3 bg-surface-muted border-b border-border font-bold text-xs text-text-secondary">Top Cases</div>
                    <table className="w-full text-left text-[10px]">
                     <thead className="bg-surface text-text-secondary border-b border-border">
                       <tr>
                         <th className="p-2 font-bold w-12 text-center  min-w-[60px] max-w-[60px]">Rank</th>
                         <th className="p-2 font-bold ">Case / Category Name</th>
                         {accumulatedScoreKeys?.map((sk) => (
                           <th key={sk} className="p-2 font-bold w-16 text-center">Score {sk}</th>
                         ))}
                         <th className="p-2 font-bold w-24 text-center">{isAccumulatedScoreCase ? 'Total' : 'Freq'}</th>
                       </tr>
                     </thead>
                     <tbody className="">
                       {scoreAnalysisTopCases.slice((scoreCasePage - 1) * 20, scoreCasePage * 20).map((cat) => {
                         const isTakeoutCategory = isCsatTakeoutCategory(cat.name);
                         return (
                         <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                           <td className="p-2 text-center text-text-muted font-medium">{cat.rank}</td>
                           <td className={`p-2 font-medium max-w-[200px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                           {accumulatedScoreKeys?.map((sk) => (
                             <td key={sk} className="p-2 text-center font-medium text-[11px] text-text-secondary">
                               {formatNum(cat.byScore[sk] || 0, 0)}
                             </td>
                           ))}
                           <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(cat.count, 0)}</td>
                         </tr>
                       )})}
                       {scoreAnalysisTopCases.length === 0 && (
                         <tr>
                           <td colSpan={3 + (accumulatedScoreKeys?.length || 0)} className="p-8 text-center text-text-muted text-sm border-b border-border">
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
                         {accumulatedScoreKeys?.map((sk) => (
                           <th key={sk} className="p-2 font-bold w-16 text-center">Score {sk}</th>
                         ))}
                         <th className="p-2 font-bold w-24 text-center">{isAccumulatedScoreCase ? 'Total' : 'Freq'}</th>
                       </tr>
                     </thead>
                     <tbody className="">
                       {scoreAnalysisTopAgents.slice((scoreCasePage - 1) * 20, scoreCasePage * 20).map((agt) => (
                         <tr key={agt.name} className="border-b border-border hover:bg-surface-muted transition-colors group">
                           <td className="p-2 text-center text-text-muted font-medium">{agt.rank}</td>
                           <td className="p-2 font-medium text-text-primary max-w-[200px] truncate" title={agt.name}>{agt.name}</td>
                           {accumulatedScoreKeys?.map((sk) => (
                             <td key={sk} className="p-2 text-center font-medium text-[11px] text-text-secondary">
                               {formatNum(agt.byScore[sk] || 0, 0)}
                             </td>
                           ))}
                           <td className="p-2 text-center font-bold text-[11px] text-text-secondary">{formatNum(agt.count, 0)}</td>
                         </tr>
                       ))}
                       {scoreAnalysisTopAgents.length === 0 && (
                         <tr>
                           <td colSpan={3 + (accumulatedScoreKeys?.length || 0)} className="p-8 text-center text-text-muted text-sm border-b border-border">
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
            <div className="px-4 py-3 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-3">
               <div>
                 <h2 className="text-base font-bold text-text-primary">Top Categories (Score 1 & 2)</h2>
                 <p className="text-xs text-text-muted mt-1 ">Identifies categories and top contributors for bad scores</p>
               </div>
               <span className="text-[11px] text-text-secondary font-bold px-3 py-1.5 bg-card border border-border rounded-lg uppercase tracking-wider">
                 {viewMode === 'full' ? 'From Full Data' : 'After Take Out'}
               </span>
            </div>

            <div className={isComparisonEnabled ? "p-3" : "p-3"}>
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
                  onCategoryClick={handleCategoryClick}
                  onAgentClick={handleAgentClick}
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
                     {isComparisonEnabled && <th className="p-2 font-bold w-16 text-center">{comparisonMode === 'mom' ? 'MoM' : 'WoW'}</th>}
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
                        <tr key={cat.name} className="border-b border-border hover:bg-surface-muted transition-colors group cursor-pointer" onClick={() => handleCategoryClick(cat.name, viewMode === 'full' ? 'From Full Data' : 'After Take Out', data)}>
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
            <div className="px-4 py-3 border-b border-border bg-surface-muted flex flex-col md:flex-row md:items-center justify-between gap-3">
               <div>
                 <h2 className="text-base font-bold text-text-primary">Agent Bottom Score 1-2</h2>
                 <p className="text-xs text-text-muted mt-1 ">Identifies agents with the highest bad scores</p>
               </div>
               <span className="text-[11px] text-text-secondary font-bold px-3 py-1.5 bg-card border border-border rounded-lg uppercase tracking-wider">
                 {viewMode === 'full' ? 'From Full Data' : 'After Take Out'}
               </span>
            </div>

            <div className={isComparisonEnabled ? "p-2" : "p-3"}>
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
                  onCategoryClick={handleCategoryClick}
                  onAgentClick={handleAgentClick}
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
                <th className="p-2 font-bold text-center text-text-muted bg-surface">Tickets</th>
                <th className="p-2 font-bold text-center text-text-muted bg-surface">Takeout</th>
                <th className="p-2 font-bold text-center text-text-primary bg-surface">Takeout %</th>
                <th className="p-2 font-bold text-center text-text-primary bg-surface md:sticky md:right-0 z-40 border-l border-border/50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="">
              {sortedAgentData.map((agent, index) => {
                const totalCount = viewMode === 'full' ? agent.csatScFullCount : agent.csatScFairCount;
                const takeoutStats = getAgentTakeoutPct(agent);
                
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
                          <span className={`text-[9px] font-medium ${isPullout ? 'text-text-muted/70 italic' : 'text-text-muted'}`}>({daily.count} valid ratings)</span>
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
                        <span className="text-[9px] text-text-muted font-medium">({totalCount} valid ratings)</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-2 text-center text-text-secondary z-10">{formatNum(takeoutStats.total, 0)}</td>
                  <td className="p-2 text-center text-text-secondary z-10">{formatNum(takeoutStats.takeout, 0)}</td>
                  <td className={`p-2 text-center font-bold z-10 ${takeoutStats.pct >= takeoutFairness.teamPct + 10 ? 'text-danger' : 'text-text-primary'}`}>
                    {takeoutStats.total > 0 ? `${formatNum(takeoutStats.pct, 1)}%` : '-'}
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
                  <td colSpan={6 + uniqueDates.length} className="p-4 z-10">
                    <EmptyState
                      title="Tidak ada data CSAT survey"
                      description="Jika belum sync, buka File Center lalu klik Sync Now. Jika sudah sync, coba ubah search, filter Team Leader, view mode, atau range tanggal."
                      variant="filter"
                      className="border-0 bg-transparent py-6"
                    />
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
                  <td colSpan={11} className="p-4 z-10">
                    <EmptyState
                      title="Tidak ada defect CSAT"
                      description="Tidak ada score buruk pada filter dan view mode saat ini."
                      variant="data"
                      className="border-0 bg-transparent py-6"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      
      {selectedAgent && (
        <CsatDetailModal
          title={<>Historical Audit Trail: {selectedAgent.agent.name || selectedAgent.agent.csId}</>}
          subtitle={<>CS ID: <span className="font-semibold text-text-primary">{selectedAgent.agent.csId}</span> &nbsp;&bull;&nbsp; Team Leader: <span className="font-semibold text-text-primary">{selectedAgent.agent.teamLeader || '-'}</span></>}
          surveys={selectedAgent.date ? selectedAgent.agent.csatHistory.filter((h: any) => h.date === selectedAgent.date) : selectedAgent.agent.csatHistory}
          agentType={selectedAgent.type}
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
      
      {wowModalData && (
        <CsatDetailModal
          title={wowModalData.title}
          subtitle={wowModalData.subtitle}
          surveys={wowModalData.surveys}
          modalType={typeof wowModalData.title === 'string' && wowModalData.title.includes('Category Analysis') ? 'category' : 'agent'}
          onClose={() => setWowModalData(null)}
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
  const comparisonMode = useStore(state => state.comparisonMode);

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
    { name: getWeekLabel(3), 'SC Full': w3.full, 'SC After Takeout': w3.takeout },
    { name: getWeekLabel(2), 'SC Full': w2.full, 'SC After Takeout': w2.takeout },
    { name: getWeekLabel(1), 'SC Full': w1.full, 'SC After Takeout': w1.takeout },
    { name: getWeekLabel(0), 'SC Full': w0.full, 'SC After Takeout': w0.takeout },
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
          'SC After Takeout': stats.totalTakeout > 0 ? Number(((stats.goodTakeout / stats.totalTakeout) * 100).toFixed(2)) : 0,
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
            <h3 className="text-sm font-bold text-text-primary text-center">{comparisonMode === 'mom' ? '4-Month Comparison Trend' : '4-Week Comparison Trend'}</h3>
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
                <Bar dataKey="SC After Takeout" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC After Takeout" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#10b981'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Trend Panel */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h3 className="text-sm font-bold text-text-primary text-center">Daily Trend ({comparisonMode === 'mom' ? 'Current Month' : 'Current Week'})</h3>
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
                <Bar dataKey="SC After Takeout" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="SC After Takeout" position="top" style={{fontSize: '10px', fontWeight: 'bold', fill: '#10b981'}} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

const WoWAnalysisPanel = ({ data, previousData, previousData2, previousData3, viewMode, search, filterTL, type = 'all', onCategoryClick, onAgentClick }: any) => {
  const { startDate, endDate } = useStore();
  const comparisonMode = useStore(state => state.comparisonMode);

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
                  <th className="p-1 font-bold w-6 text-center">#</th>
                  <th className="p-1 font-bold">Category</th>
                  <th className="p-1 font-bold w-8 text-center">Freq</th>
                </tr>
              </thead>
              <tbody>
                {week.cats.map((cat, i) => {
                  const isTakeoutCategory = isCsatTakeoutCategory(cat.name);
                  return (
                    <tr 
                      key={cat.name} 
                      className="border-b border-border hover:bg-surface-muted transition-colors cursor-pointer"
                      onClick={() => onCategoryClick && onCategoryClick(cat.name, week.name, wIdx === 3 ? data : wIdx === 2 ? previousData : wIdx === 1 ? previousData2 : previousData3)}
                    >
                      <td className="p-1 text-center text-text-muted font-medium">{i+1}</td>
                      <td className={`p-1 font-medium max-w-[96px] truncate ${isTakeoutCategory ? 'text-danger' : 'text-text-primary'}`} title={cat.name}>{cat.name}</td>
                      <td className="p-1 text-center font-bold text-[9px] text-text-secondary">{formatNum(cat.count, 0)}</td>
                    </tr>
                  );
                })}
                {week.cats.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-text-muted text-[9px] border-b border-border">
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
                  <th className="p-1 font-bold w-6 text-center">#</th>
                  <th className="p-1 font-bold">Agent Name</th>
                  <th className="p-1 font-bold w-8 text-center">Freq</th>
                </tr>
              </thead>
              <tbody>
                {week.agents.map((agent, i) => {
                  const isRepeat = wIdx === weeks.length - 1 && weeks[wIdx - 1].agents.some(prevAgent => prevAgent.csId === agent.csId);
                  return (
                    <tr 
                      key={agent.csId} 
                      className="border-b border-border hover:bg-surface-muted transition-colors cursor-pointer"
                      onClick={() => onAgentClick && onAgentClick(agent.csId, agent.name, week.name, wIdx === 3 ? data : wIdx === 2 ? previousData : wIdx === 1 ? previousData2 : previousData3)}
                    >
                      <td className="p-1 text-center text-text-muted font-medium">{i+1}</td>
                      <td className={`p-1 font-medium max-w-[96px] truncate ${isRepeat ? 'text-danger font-bold' : 'text-text-primary'}`} title={agent.name}>{agent.name}</td>
                      <td className="p-1 text-center font-bold text-[9px] text-text-secondary">{agent.badScoreCount}</td>
                    </tr>
                  );
                })}
                {week.agents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-text-muted text-[9px] border-b border-border">
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
const RespondentChartPanel = ({ data, previousData, previousData2, previousData3, viewMode }: any) => {
  const { startDate, endDate } = useStore();
  const comparisonMode = useStore(state => state.comparisonMode);

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

  const calcRespStats = (dataset: AgentKPI[]) => {
    let totalProcessed = 0;
    let totalRespondents = 0;
    let s5 = 0, s4 = 0, s3 = 0, s2 = 0, s1 = 0;
    (dataset || []).forEach(a => {
      const histories = a.csatHistory.filter(
        h => viewMode === 'full' || !h.isTakeout,
      );
      totalProcessed += histories.length;
      histories.forEach(h => {
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
  }, [data, previousData, previousData2, previousData3, startDate, endDate, viewMode]);

  const dailyRespData = React.useMemo(() => {
    const dates = new Map<string, { processed: number, respondents: number, s5: number, s4: number, s3: number, s2: number, s1: number }>();
    (data || []).forEach(a => {
      a.csatHistory
        .filter(h => viewMode === 'full' || !h.isTakeout)
        .forEach(h => {
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
  }, [data, viewMode]);

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
        <h3 className="text-sm font-bold text-text-primary text-center">
          Respondent Volume Trend ({viewMode === 'full' ? 'Full Data' : 'After Takeout'})
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Weekly Cards */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <h4 className="text-xs font-bold text-text-secondary text-center">{comparisonMode === 'mom' ? '4-Month Respondents' : '4-Week Respondents'}</h4>
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
            <h4 className="text-xs font-bold text-text-secondary text-center">Daily Respondents ({comparisonMode === 'mom' ? 'Current Month' : 'Current Week'})</h4>
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
