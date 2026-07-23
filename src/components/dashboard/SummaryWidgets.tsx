import React from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { KpiType, getKpiColor } from '../../lib/utils';
import { BpoPerformanceCard } from './BpoPerformanceCard';

export interface SummaryWidgetsProps {
  data: AgentKPI[];
  metricFn: (agent: AgentKPI) => { value: number; count: number } | null;
  formatFn: (val: number) => string;
  activeTlFilter: string | null;
  onTlClick: (tl: string | null) => void;
  isLowerBetter?: boolean; // Default false (higher is better). If true, Underperform = highest value
  kpiType?: KpiType;
  minAgentCount?: number;
  containerClassName?: string;
  overallLabel?: string;
}

export const SummaryWidgets: React.FC<SummaryWidgetsProps> = ({ 
  data, 
  metricFn, 
  formatFn, 
  activeTlFilter, 
  onTlClick,
  isLowerBetter = false,
  kpiType = 'qa',
  minAgentCount = 1,
  containerClassName = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4",
  overallLabel = "Overall Average",
}) => {
  let totalSum = 0;
  let totalCount = 0;

  const bpoStats: Record<string, { sum: number; count: number; agentCount: number }> = {};
  const tlStats: Record<string, { sum: number; count: number; agentCount: number }> = {};

  data.forEach(agent => {
     const m = metricFn(agent);
     if (m && m.count > 0) {
        totalSum += m.value * m.count;
        totalCount += m.count;

        const bpo = agent.bpo || 'Unknown';
        if (!bpoStats[bpo]) bpoStats[bpo] = { sum: 0, count: 0, agentCount: 0 };
        bpoStats[bpo].sum += m.value * m.count;
        bpoStats[bpo].count += m.count;
        bpoStats[bpo].agentCount += 1;

        const tl = agent.teamLeader || 'Unknown';
        if (!tlStats[tl]) tlStats[tl] = { sum: 0, count: 0, agentCount: 0 };
        tlStats[tl].sum += m.value * m.count;
        tlStats[tl].count += m.count;
        tlStats[tl].agentCount += 1;
     }
  });

  const overallAvg = totalCount > 0 ? totalSum / totalCount : 0;

  const bpoEntries = Object.entries(bpoStats).map(([bpo, st]) => {
     return { bpo, avg: st.sum / st.count };
  });
  
  // Sort BPO entries by average
  bpoEntries.sort((a, b) => isLowerBetter ? a.avg - b.avg : b.avg - a.avg);

  const tlAverages = Object.entries(tlStats).map(([tl, st]) => ({
     tl,
     avg: st.sum / st.count,
     agentCount: st.agentCount
  })).filter(x => x.tl !== 'Unknown' && x.tl !== '-' && x.agentCount >= minAgentCount);

  // Sort TLs: index 0 is Top, index length-1 is Underperform
  tlAverages.sort((a, b) => isLowerBetter ? a.avg - b.avg : b.avg - a.avg);

  // Top TLs: ambil 3 pertama
  const topTls = tlAverages.slice(0, 3);
  const topTlNames = new Set(topTls.map((t) => t.tl));
  // Underperform: 3 terbawah yang belum masuk Top (hindari overlap Fandi dkk)
  const underTls = tlAverages
    .filter((t) => !topTlNames.has(t.tl))
    .slice(-3)
    .reverse();

  const getBaseKpiTheme = (type?: string) => {
    if (type?.includes('csat')) return 'csat';
    if (type?.includes('sla')) return 'sla';
    if (type === 'whu') return 'whu';
    if (type === 'qa') return 'qa';
    if (type === 'productivity') return 'productivity';
    return 'neutral';
  };
  const theme = getBaseKpiTheme(kpiType);

  return (
    <div className={containerClassName}>
      {/* Kartu 1: Overall Average */}
      <div className="bg-surface rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-5 flex flex-col min-h-[160px] h-full">
        <div className="text-xs uppercase tracking-wider text-text-muted font-bold mb-1">{overallLabel}</div>
        <div className="text-3xl font-extrabold text-text-primary mt-auto">{totalCount > 0 ? formatFn(overallAvg) : '-'}</div>
        {overallLabel.toLowerCase().includes('gap') && (
          <p className="text-[10px] text-text-muted mt-2 leading-snug">
            Rata-rata gap agent: productivity − target quota (100/man-day). + = di atas target.
          </p>
        )}
      </div>

      {/* Kartu 2: BPO Performance */}
      <div className="flex h-full min-h-[160px]">
        <div className="w-full h-full rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border border-t-[3px] overflow-hidden flex flex-col bg-card"
             style={{ borderTopColor: `rgb(var(--kpi-${theme}))` }}>
          <BpoPerformanceCard 
            data={bpoEntries.map(b => ({ name: b.bpo, value: b.avg, type: kpiType as KpiType }))} 
            formatFn={formatFn} 
          />
        </div>
      </div>

      {/* Kartu 3: Top Team Leaders */}
      <div className="bg-surface rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border border-t-[3px] border-t-success p-5 flex flex-col min-h-[160px] h-full relative overflow-hidden group">
        <div className="text-xs uppercase tracking-wider text-text-muted font-bold flex items-center justify-between mb-4">
           TOP TEAM LEADERS
           <div className="w-2 h-2 rounded-full bg-success"></div>
        </div>
        <div className="flex flex-col gap-1.5 mt-auto">
          {topTls.map((tl, idx) => {
             const isActive = activeTlFilter === tl.tl;
             return (
             <div 
               key={tl.tl} 
               onClick={() => onTlClick(isActive ? null : tl.tl)}
               className={`flex items-center justify-between p-1.5 -mx-1.5 rounded-md cursor-pointer transition-colors ${isActive ? ' ring-1 ring-primary/20 bg-surface-muted' : 'hover:bg-surface-muted'}`}
             >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1 pr-2">
                   <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${idx === 0 ? 'text-success font-bold bg-success-soft' : 'bg-surface-muted text-text-secondary'}`}>
                      {idx + 1}
                   </div>
                   <span className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-text-primary'}`} title={tl.tl}>{tl.tl}</span>
                </div>
                <div className={`text-sm font-bold shrink-0 ${getKpiColor(tl.avg, kpiType as KpiType)}`}>
                   {formatFn(tl.avg)}
                </div>
             </div>
          )})}
          {topTls.length === 0 && <div className="text-sm text-text-muted mt-auto mb-auto text-center">No Data</div>}
        </div>
      </div>

      {/* Kartu 4: Underperform TL */}
      <div className="bg-surface rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border border-t-[3px] border-t-danger p-5 flex flex-col min-h-[160px] h-full relative overflow-hidden group">
        <div className="text-xs uppercase tracking-wider text-text-muted font-bold flex items-center justify-between mb-4">
           UNDERPERFORM TL
           <div className="w-2 h-2 rounded-full bg-danger"></div>
        </div>
        <div className="flex flex-col gap-1.5 mt-auto">
          {underTls.map((tl, idx) => {
             const isActive = activeTlFilter === tl.tl;
             return (
             <div 
               key={tl.tl} 
               onClick={() => onTlClick(isActive ? null : tl.tl)}
               className={`flex items-center justify-between p-1.5 -mx-1.5 rounded-md cursor-pointer transition-colors ${isActive ? ' ring-1 ring-primary/20 bg-surface-muted' : 'hover:bg-surface-muted'}`}
             >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1 pr-2">
                   <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${idx === 0 ? 'text-danger font-bold' : 'bg-white text-text-secondary'}`}>
                      {idx + 1}
                   </div>
                   <span className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-text-primary'}`} title={tl.tl}>{tl.tl}</span>
                </div>
                <div className={`text-sm font-bold shrink-0 ${getKpiColor(tl.avg, kpiType as KpiType)}`}>
                   {formatFn(tl.avg)}
                </div>
             </div>
          )})}
          {underTls.length === 0 && <div className="text-sm text-text-muted mt-auto mb-auto text-center">No Data</div>}
        </div>
      </div>
    </div>
  );
};
