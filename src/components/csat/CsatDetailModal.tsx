import React from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { parseDateForSort, cn } from '../../lib/utils';
import { AlertCircle, X, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface CsatDetailModalProps {
  selectedAgent: { agent: AgentKPI, date?: string, type?: 'csat' | 'defects' };
  onClose: () => void;
  expandedDates: Set<string>;
  toggleExpandDate: (date: string) => void;
  viewMode: 'full' | 'fair';
}

export const CsatDetailModal: React.FC<CsatDetailModalProps> = ({
  selectedAgent, onClose, expandedDates, toggleExpandDate, viewMode
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-border">
        <div className="flex flex-col md:flex-row md:items-start justify-between p-5 border-b border-border bg-surface-muted rounded-t-xl relative gap-4 pr-12 md:pr-5">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-lg text-text-primary flex flex-wrap items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${selectedAgent.type === 'defects' ? 'text-danger' : 'text-primary'}`} />
                Historical Audit Trail: {selectedAgent.agent.name || selectedAgent.agent.csId} 
                {selectedAgent.date && <span className="text-text-muted font-normal text-sm ml-2">({selectedAgent.date})</span>}
              </h3>
              <p className="text-xs text-text-muted mt-1 ml-7">
                CS ID: <span className="font-semibold text-text-primary">{selectedAgent.agent.csId}</span> &nbsp;&bull;&nbsp; 
                Team Leader: <span className="font-semibold text-text-primary">{selectedAgent.agent.teamLeader || '-'}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-4 ml-0 md:ml-7 mt-2">
              <div className="flex flex-col px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Total Surveys</span>
                <span className="text-lg font-black text-text-primary">
                  {selectedAgent.agent.csatHistory.filter(h => 
                      (viewMode === 'full' || !h.isTakeout) &&
                      (!selectedAgent.date || h.date === selectedAgent.date) &&
                      h.score > 0
                  ).length}
                </span>
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
             selectedAgent.agent.csatHistory
                 .filter(h => (viewMode === 'full' || !h.isTakeout) && (!selectedAgent.date || h.date === selectedAgent.date) && h.score > 0)
                 .map(h => h.date)
          )).sort((a,b) => parseDateForSort(a) - parseDateForSort(b)).map(date => {
            const surveys = selectedAgent.agent.csatHistory.filter(h => h.date === date && (viewMode === 'full' || !h.isTakeout) && h.score > 0);
            if (surveys.length === 0) return null;
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
                      {surveys.length} survey{surveys.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                      {[5, 4, 3, 2, 1].map(score => {
                        const count = surveys.filter(s => s.score === score).length;
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
                          <th className="p-3 font-bold">Category Case</th>
                          <th className="p-3 font-bold">Ticket & Chat ID</th>
                          <th className="p-3 font-bold">UID</th>
                          <th className="p-3 font-bold">Agent / CS ID</th>
                          <th className="p-3 font-bold min-w-[200px] max-w-[300px]">Response / Komentar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveys.map((s, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                            <td className="p-3 align-top">
                              <span className={cn("px-2 py-1 rounded text-white font-bold inline-flex items-center gap-1", s.score === 5 ? 'bg-success' : s.score === 4 ? 'bg-success/80' : s.score === 3 ? 'bg-warning' : s.score === 2 ? 'bg-orange-500' : 'bg-danger')}>
                                {s.score} <Star className="w-3 h-3 fill-current" />
                              </span>
                            </td>
                            <td className="p-3 align-top font-medium text-text-primary max-w-[150px] whitespace-normal">
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
                            <td className="p-3 align-top font-medium text-text-primary">
                              {selectedAgent.agent.name || selectedAgent.agent.csId}
                              <div className="text-[10px] text-text-muted font-normal mt-0.5">{selectedAgent.agent.csId}</div>
                            </td>
                            <td className="p-3 align-top whitespace-normal min-w-[200px] max-w-[300px] text-text-secondary leading-relaxed">
                              {s.response || '-'}
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
          {selectedAgent.agent.csatHistory.filter(h => (viewMode === 'full' || !h.isTakeout) && (!selectedAgent.date || h.date === selectedAgent.date) && h.score > 0).length === 0 && (
             <div className="text-center p-8 text-text-muted mt-4 bg-surface rounded-lg border border-dashed border-border text-sm">
               Tidak ada data detail.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
