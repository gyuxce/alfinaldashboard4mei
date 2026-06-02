import React from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { parseDateForSort, cn } from '../../lib/utils';
import { AlertCircle, X, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface CsatDetailModalProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  surveys: CSATEntry[];
  agentType?: 'csat' | 'defects';
  modalType?: 'agent' | 'category';
  onClose: () => void;
  expandedDates: Set<string>;
  toggleExpandDate: (date: string) => void;
  viewMode: 'full' | 'fair';
}

export const CsatDetailModal: React.FC<CsatDetailModalProps> = ({
  title, subtitle, surveys, agentType, modalType = 'agent', onClose, expandedDates, toggleExpandDate, viewMode
}) => {
  const filteredSurveys = surveys.filter(h => (viewMode === 'full' || !h.isTakeout) && h.score > 0);
  
  const topCategoriesAll = React.useMemo(() => {
    const agg: Record<string, { total: number, s5: number, s4: number, s3: number, s2: number, s1: number }> = {};
    filteredSurveys.forEach(h => {
      const cat = h.category || 'Uncategorized';
      if (!agg[cat]) agg[cat] = { total: 0, s5: 0, s4: 0, s3: 0, s2: 0, s1: 0 };
      agg[cat].total++;
      if (h.score === 5) agg[cat].s5++;
      if (h.score === 4) agg[cat].s4++;
      if (h.score === 3) agg[cat].s3++;
      if (h.score === 2) agg[cat].s2++;
      if (h.score === 1) agg[cat].s1++;
    });
    return Object.entries(agg)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [filteredSurveys]);

  const topCategoriesBad = React.useMemo(() => {
    const agg: Record<string, { total: number, s5: number, s4: number, s3: number, s2: number, s1: number }> = {};
    filteredSurveys.forEach(h => {
      const cat = h.category || 'Uncategorized';
      if (!agg[cat]) agg[cat] = { total: 0, s5: 0, s4: 0, s3: 0, s2: 0, s1: 0 };
      agg[cat].total++;
      if (h.score === 5) agg[cat].s5++;
      if (h.score === 4) agg[cat].s4++;
      if (h.score === 3) agg[cat].s3++;
      if (h.score === 2) agg[cat].s2++;
      if (h.score === 1) agg[cat].s1++;
    });
    return Object.entries(agg)
      .filter(([_, stats]) => (stats.s1 + stats.s2) > 0)
      .sort((a, b) => (b[1].s1 + b[1].s2) - (a[1].s1 + a[1].s2))
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [filteredSurveys]);

  const topAgentsAll = React.useMemo(() => {
    const agg: Record<string, { total: number, name: string, s5: number, s4: number, s3: number, s2: number, s1: number }> = {};
    filteredSurveys.forEach(h => {
      const csId = h.csId || 'Unknown';
      if (!agg[csId]) agg[csId] = { total: 0, name: h.agentName || csId, s5: 0, s4: 0, s3: 0, s2: 0, s1: 0 };
      agg[csId].total++;
      if (h.score === 5) agg[csId].s5++;
      if (h.score === 4) agg[csId].s4++;
      if (h.score === 3) agg[csId].s3++;
      if (h.score === 2) agg[csId].s2++;
      if (h.score === 1) agg[csId].s1++;
    });
    return Object.entries(agg)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([csId, stats]) => ({ csId, ...stats }));
  }, [filteredSurveys]);

  const topAgentsBad = React.useMemo(() => {
    const agg: Record<string, { total: number, name: string, s5: number, s4: number, s3: number, s2: number, s1: number }> = {};
    filteredSurveys.forEach(h => {
      const csId = h.csId || 'Unknown';
      if (!agg[csId]) agg[csId] = { total: 0, name: h.agentName || csId, s5: 0, s4: 0, s3: 0, s2: 0, s1: 0 };
      agg[csId].total++;
      if (h.score === 5) agg[csId].s5++;
      if (h.score === 4) agg[csId].s4++;
      if (h.score === 3) agg[csId].s3++;
      if (h.score === 2) agg[csId].s2++;
      if (h.score === 1) agg[csId].s1++;
    });
    return Object.entries(agg)
      .filter(([_, stats]) => (stats.s1 + stats.s2) > 0)
      .sort((a, b) => (b[1].s1 + b[1].s2) - (a[1].s1 + a[1].s2))
      .slice(0, 5)
      .map(([csId, stats]) => ({ csId, ...stats }));
  }, [filteredSurveys]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-[95vw] xl:max-w-7xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-border">
        <div className="flex flex-col md:flex-row md:items-start justify-between p-5 border-b border-border bg-surface-muted rounded-t-xl relative gap-4 pr-12 md:pr-5">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-lg text-text-primary flex flex-wrap items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${agentType === 'defects' ? 'text-danger' : 'text-primary'}`} />
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-text-muted mt-1 ml-7">
                  {subtitle}
                </p>
              )}
            </div>
            
            <div className="flex items-start gap-4 ml-0 md:ml-7 mt-2 flex-wrap">
              <div className="flex gap-2">
                <div className="flex flex-col px-4 py-2 bg-card rounded-lg border border-border shadow-sm min-w-[100px]">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Total Surveys</span>
                  <span className="text-lg font-black text-text-primary">
                    {filteredSurveys.length}
                  </span>
                </div>
                <div className="flex flex-col px-4 py-2 bg-danger/5 rounded-lg border border-danger/20 shadow-sm min-w-[100px]">
                  <span className="text-[10px] text-danger uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> 1 Total
                  </span>
                  <span className="text-lg font-black text-danger">
                    {filteredSurveys.filter(s => s.score === 1).length}
                  </span>
                </div>
                <div className="flex flex-col px-4 py-2 bg-orange-500/5 rounded-lg border border-orange-500/20 shadow-sm min-w-[100px]">
                  <span className="text-[10px] text-orange-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> 2 Total
                  </span>
                  <span className="text-lg font-black text-orange-500">
                    {filteredSurveys.filter(s => s.score === 2).length}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 flex-1">
                {/* Menu 1: All Scores */}
                {(modalType === 'category' ? topAgentsAll.length > 0 : topCategoriesAll.length > 0) && (
                  <div className="flex flex-col px-4 py-2 bg-card rounded-lg border border-border shadow-sm flex-1 min-w-[300px]">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">
                      Top {modalType === 'category' ? topAgentsAll.length : topCategoriesAll.length} {modalType === 'category' ? 'Agents' : 'Categories'} (All Scores 1-5)
                    </span>
                    <div className="flex flex-col gap-2">
                      {modalType === 'category' ? topAgentsAll.map((agent, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-bold text-text-muted w-4">{idx + 1}.</span>
                            <span className="font-semibold text-text-primary truncate max-w-[200px]" title={agent.name}>{agent.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-text-secondary w-6 text-right mr-2">{agent.total}</span>
                            {[
                              { score: 5, count: agent.s5, color: 'bg-success' },
                              { score: 4, count: agent.s4, color: 'bg-success/80' },
                              { score: 3, count: agent.s3, color: 'bg-warning' },
                              { score: 2, count: agent.s2, color: 'bg-orange-500' },
                              { score: 1, count: agent.s1, color: 'bg-danger' },
                            ].map(s => s.count > 0 ? (
                              <span key={s.score} className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5 ${s.color}`}>
                                <Star className="w-2.5 h-2.5 fill-current" /> {s.score} ({s.count})
                              </span>
                            ) : null)}
                          </div>
                        </div>
                      )) : topCategoriesAll.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-bold text-text-muted w-4">{idx + 1}.</span>
                            <span className="font-semibold text-text-primary truncate max-w-[200px]" title={cat.name}>{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-text-secondary w-6 text-right mr-2">{cat.total}</span>
                            {[
                              { score: 5, count: cat.s5, color: 'bg-success' },
                              { score: 4, count: cat.s4, color: 'bg-success/80' },
                              { score: 3, count: cat.s3, color: 'bg-warning' },
                              { score: 2, count: cat.s2, color: 'bg-orange-500' },
                              { score: 1, count: cat.s1, color: 'bg-danger' },
                            ].map(s => s.count > 0 ? (
                              <span key={s.score} className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5 ${s.color}`}>
                                <Star className="w-2.5 h-2.5 fill-current" /> {s.score} ({s.count})
                              </span>
                            ) : null)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menu 2: Bad Scores */}
                {(modalType === 'category' ? topAgentsBad.length > 0 : topCategoriesBad.length > 0) && (
                  <div className="flex flex-col px-4 py-2 bg-card rounded-lg border border-danger/30 shadow-sm flex-1 min-w-[300px]">
                    <span className="text-[10px] text-danger uppercase tracking-wider font-bold mb-2">
                      Top {modalType === 'category' ? topAgentsBad.length : topCategoriesBad.length} {modalType === 'category' ? 'Agents' : 'Categories'} (Score 1 & 2 Only)
                    </span>
                    <div className="flex flex-col gap-2">
                      {modalType === 'category' ? topAgentsBad.map((agent, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-bold text-text-muted w-4">{idx + 1}.</span>
                            <span className="font-semibold text-text-primary truncate max-w-[200px]" title={agent.name}>{agent.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-text-secondary w-6 text-right mr-2">{agent.s1 + agent.s2}</span>
                            {[
                              { score: 2, count: agent.s2, color: 'bg-orange-500' },
                              { score: 1, count: agent.s1, color: 'bg-danger' },
                            ].map(s => s.count > 0 ? (
                              <span key={s.score} className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5 ${s.color}`}>
                                <Star className="w-2.5 h-2.5 fill-current" /> {s.score} ({s.count})
                              </span>
                            ) : null)}
                          </div>
                        </div>
                      )) : topCategoriesBad.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-bold text-text-muted w-4">{idx + 1}.</span>
                            <span className="font-semibold text-text-primary truncate max-w-[200px]" title={cat.name}>{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-text-secondary w-6 text-right mr-2">{cat.s1 + cat.s2}</span>
                            {[
                              { score: 2, count: cat.s2, color: 'bg-orange-500' },
                              { score: 1, count: cat.s1, color: 'bg-danger' },
                            ].map(s => s.count > 0 ? (
                              <span key={s.score} className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5 ${s.color}`}>
                                <Star className="w-2.5 h-2.5 fill-current" /> {s.score} ({s.count})
                              </span>
                            ) : null)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 md:relative md:top-auto md:right-auto p-2 text-text-muted hover:text-text-primary hover:bg-surface-muted rounded-full transition-colors self-start shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 bg-card space-y-4">
          {Array.from(new Set<string>(
             filteredSurveys.map(h => h.date)
          )).sort((a,b) => parseDateForSort(a) - parseDateForSort(b)).map(date => {
            const dateSurveys = filteredSurveys.filter(h => h.date === date);
            if (dateSurveys.length === 0) return null;
            const isExpanded = expandedDates.has(date);
            
            return (
              <div key={date} className="border border-border rounded-lg overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleExpandDate(date)}
                  className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-muted transition-colors text-left"
                >
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <span className="font-bold text-text-primary text-sm md:text-base">{date}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                      {dateSurveys.length} survey{dateSurveys.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                      {[5, 4, 3, 2, 1].map(score => {
                        const count = dateSurveys.filter(s => s.score === score).length;
                        if (count === 0) return null;
                        return (
                          <span key={score} className={cn("px-1.5 py-0.5 rounded text-[10px] md:text-[9px] font-bold text-white flex items-center gap-0.5", score === 5 ? 'bg-success' : score === 4 ? 'bg-success/80' : score === 3 ? 'bg-warning' : score === 2 ? 'bg-orange-500' : 'bg-danger')}>
                            <Star className="w-2.5 h-2.5 fill-current" /> {score} <span className="ml-0.5">({count})</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0 ml-2" />}
                </button>
                
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto bg-card">
                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                      <thead className="bg-surface-muted text-text-secondary border-b border-border">
                        <tr>
                          <th className="p-3 font-bold">Score</th>
                          <th className="p-3 font-bold min-w-[180px] max-w-[300px]">Category Case</th>
                          <th className="p-3 font-bold">Ticket & Chat ID</th>
                          <th className="p-3 font-bold">UID</th>
                          <th className="p-3 font-bold min-w-[180px]">Agent / CS ID</th>
                          <th className="p-3 font-bold min-w-[250px] max-w-[350px]">Response / Komentar</th>
                          <th className="p-3 font-bold min-w-[150px]">Analisa TL (RCA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateSurveys.map((s, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                            <td className="p-3 align-top">
                              <span className={cn("px-2 py-1 rounded text-white font-bold inline-flex items-center gap-1", s.score === 5 ? 'bg-success' : s.score === 4 ? 'bg-success/80' : s.score === 3 ? 'bg-warning' : s.score === 2 ? 'bg-orange-500' : 'bg-danger')}>
                                {s.score} <Star className="w-3 h-3 fill-current" />
                              </span>
                            </td>
                            <td className="p-3 align-top font-medium text-text-primary min-w-[180px] max-w-[300px] whitespace-normal leading-relaxed">
                              {s.category}
                              {s.isTakeout && <div className="mt-1"><span className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded text-text-muted">Takeout</span></div>}
                            </td>
                            <td className="p-3 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="text-text-primary font-medium tracking-tight">T: <span className="font-mono">{s.ticketId || '-'}</span></span>
                                <span className="text-text-muted">C: <span className="font-mono">{s.chatId || '-'}</span></span>
                              </div>
                            </td>
                            <td className="p-3 align-top font-mono text-text-muted">
                              {s.uid || '-'}
                            </td>
                            <td className="p-3 align-top font-medium text-text-primary min-w-[180px] whitespace-normal">
                              {s.agentName || s.csId}
                              <div className="text-[10px] text-text-muted font-normal mt-0.5">{s.csId}</div>
                            </td>
                            <td className="p-3 align-top whitespace-normal min-w-[200px] max-w-[300px] text-text-secondary leading-relaxed">
                              {s.response || '-'}
                            </td>
                            <td className="p-3 align-top whitespace-normal min-w-[150px] max-w-[250px] text-text-secondary leading-relaxed text-[10px]">
                              {s.rcaAgent && <div className="mb-1"><span className="font-semibold text-danger">Agent:</span> {s.rcaAgent}</div>}
                              {s.rcaCustomer && <div className="mb-1"><span className="font-semibold text-primary">Customer:</span> {s.rcaCustomer}</div>}
                              {s.rcaAkulaku && <div><span className="font-semibold text-warning">Process:</span> {s.rcaAkulaku}</div>}
                              {(!s.rcaAgent && !s.rcaCustomer && !s.rcaAkulaku) && '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {filteredSurveys.length === 0 && (
             <div className="text-center p-8 text-text-muted mt-4 bg-surface rounded-lg border border-dashed border-border text-sm">
               Tidak ada data detail.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
