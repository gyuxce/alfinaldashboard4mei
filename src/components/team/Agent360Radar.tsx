import React, { useMemo } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum } from '../../lib/utils';
import { X, User, ClipboardCheck } from 'lucide-react';
import { calculateAgentCompositeScore } from '../../lib/kpiScoring';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface Agent360RadarProps {
  agent: AgentKPI;
  onClose: () => void;
}

export const Agent360Radar: React.FC<Agent360RadarProps> = ({ agent, onClose }) => {
  const radarData = useMemo(() => {
    // Productivity
    const prodScore = agent.targetQuota > 0 ? (agent.productivityTotal / agent.targetQuota) * 100 : 0;
    
    // QA (qaScoreSum is already in 0-100 range)
    const qaScore = agent.qaScoreCount > 0 ? (agent.qaScoreSum / agent.qaScoreCount) : 0;

    // CSAT
    const csatOfficial = agent.csatAsli || 0; // max 5
    const csatSc = agent.csatScFair || 0; // max 100
    
    // Scale csatOfficial to 100 if it exists
    const csatRadar = csatOfficial > 0 ? (csatOfficial / 5) * 100 : csatSc;
    const origCsat = csatOfficial > 0 ? csatOfficial : csatSc;
    const csatSuffix = csatOfficial > 0 ? '' : '%';

    // SLA
    const sla1m = agent.sla1m || 0;
    const sla3m = agent.sla3m || 0;
    const finalSla = sla1m > 0 ? sla1m : sla3m;
    
    return [
      {
        subject: 'Productivity',
        A: Math.min(100, Math.round(prodScore)), // Cap at 100 for radar visual
        fullMark: 100,
        original: prodScore,
        suffix: '%'
      },
      {
        subject: 'Attendance',
        A: Math.round(agent.attendanceScore || 0),
        fullMark: 100,
        original: agent.attendanceScore || 0,
        suffix: '%'
      },
      {
        subject: 'CSAT',
        A: Math.round(csatRadar),
        fullMark: 100,
        original: origCsat,
        suffix: csatSuffix
      },
      {
        subject: 'QA',
        A: Math.round(qaScore),
        fullMark: 100,
        original: qaScore,
        suffix: '%'
      },
      {
        subject: 'SLA',
        A: Math.round(finalSla),
        fullMark: 100,
        original: finalSla,
        suffix: '%'
      }
    ];
  }, [agent]);

  const avgScore = useMemo(() => {
    const sum = radarData.reduce((acc, curr) => acc + curr.A, 0);
    return sum / radarData.length;
  }, [radarData]);

  const auditRows = useMemo(() => {
    const qaAvg = agent.qaScoreCount > 0 ? agent.qaScoreSum / agent.qaScoreCount : null;
    const productivityPct = agent.targetQuota > 0 ? (agent.productivityTotal / agent.targetQuota) * 100 : null;
    const composite = calculateAgentCompositeScore(agent);

    return [
      {
        label: 'Productivity',
        source: 'Productivity sheet',
        formula: 'Total chat / target quota * 100',
        raw: `${formatNum(agent.productivityTotal, 0)} chats / ${formatNum(agent.targetQuota, 0)} target`,
        result: productivityPct !== null ? `${formatNum(productivityPct, 1)}%` : '-',
        status: agent.targetQuota > 0 ? 'Ready' : 'No target quota',
      },
      {
        label: 'CSAT Official',
        source: 'Productivity, CSAT, WHU sheet',
        formula: 'Average official CSAT score',
        raw: `${agent.csatRespondents || 0} respondents`,
        result: agent.csatAsli !== null ? formatNum(agent.csatAsli, 2) : '-',
        status: agent.csatAsli !== null ? 'Ready' : 'No official CSAT',
      },
      {
        label: 'CSAT SC Full',
        source: 'CSAT SC raw data',
        formula: 'Good score 4-5 / valid score * 100',
        raw: `${formatNum(agent.csatScGoodCount, 0)} good / ${formatNum(agent.csatScTotalValid, 0)} valid`,
        result: agent.csatScFull !== null ? `${formatNum(agent.csatScFull, 1)}%` : '-',
        status: agent.csatScTotalValid > 0 ? 'Ready' : 'No valid score',
      },
      {
        label: 'CSAT SC Takeout',
        source: 'CSAT SC raw data',
        formula: 'Good score 4-5 / valid score after takeout * 100',
        raw: `${formatNum(agent.csatScFairGoodCount, 0)} good / ${formatNum(agent.csatScFairTotalValid, 0)} valid`,
        result: agent.csatScFair !== null ? `${formatNum(agent.csatScFair, 1)}%` : '-',
        status: agent.csatScFairTotalValid > 0 ? 'Ready' : 'No valid score',
      },
      {
        label: 'SLA',
        source: 'SLA responses sheet',
        formula: 'Average SLA 1m and SLA 3m',
        raw: `${formatNum(agent.sla1mCount, 0)} sample 1m / ${formatNum(agent.sla3mCount, 0)} sample 3m`,
        result: `1m ${agent.sla1m !== null ? `${formatNum(agent.sla1m, 1)}%` : '-'} | 3m ${agent.sla3m !== null ? `${formatNum(agent.sla3m, 1)}%` : '-'}`,
        status: agent.sla1mCount > 0 || agent.sla3mCount > 0 ? 'Ready' : 'No SLA sample',
      },
      {
        label: 'QA Score',
        source: 'QA score sheet',
        formula: 'Total QA score / QA count',
        raw: `${formatNum(agent.qaScoreSum, 1)} total / ${formatNum(agent.qaScoreCount, 0)} QA`,
        result: qaAvg !== null ? `${formatNum(qaAvg, 1)}%` : '-',
        status: agent.qaScoreCount > 0 ? 'Ready' : 'No QA data',
      },
      {
        label: 'Attendance',
        source: 'Agent scheduling sheet',
        formula: 'Presence / duty * 100',
        raw: `${formatNum(agent.attendancePresence, 0)} presence / ${formatNum(agent.attendanceDuty, 0)} duty`,
        result: agent.attendanceDuty > 0 ? `${formatNum(agent.attendanceScore, 1)}%` : '-',
        status: agent.attendanceDuty > 0 ? 'Ready' : 'No duty data',
      },
      {
        label: 'Composite Score',
        source: 'KPI scoring rules',
        formula: 'QA 50%, Productivity 20%, CSAT 20%, fixed 10%',
        raw: `QA ${composite.qaPct !== null ? formatNum(composite.qaPct, 1) + '%' : '-'} | Prod ${composite.productivityPct !== null ? formatNum(composite.productivityPct, 1) + '%' : '-'} | CSAT ${composite.csatPct !== null ? formatNum(composite.csatPct, 1) + '%' : '-'}`,
        result: composite.score !== null ? `${formatNum(composite.score, 1)}%` : '-',
        status: composite.score !== null ? 'Ready' : 'No composite input',
      },
    ];
  }, [agent]);

  // Prevent background scrolling when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
               <User className="w-5 h-5"/>
             </div>
             <div>
                <h3 className="font-bold text-text-primary text-base leading-tight">Ultimate Agent 360</h3>
                <p className="text-xs text-text-secondary mt-0.5">{agent.name || agent.csId}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-text-muted hover:text-text-primary hover:bg-surface-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 flex flex-col items-center overflow-y-auto">
           <div className="w-full h-[220px] sm:h-[300px] -mt-2 sm:-mt-4">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius={window.innerWidth < 640 ? "65%" : "75%"} data={radarData}>
                  <PolarGrid stroke="rgba(0,0,0,0.05)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                    itemStyle={{ color: '#0f172a', fontWeight: 600, fontSize: '13px' }}
                    labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                    formatter={(value: any, name: string, props: any) => [`${formatNum(props.payload.original, 1)}${props.payload.suffix}`, 'Score']}
                  />
                  <Radar
                    name={agent.name || agent.csId}
                    dataKey="A"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.4}
                    isAnimationActive={true}
                  />
                </RadarChart>
             </ResponsiveContainer>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-5 w-full gap-2 mt-2">
              {radarData.map(d => (
                 <div key={d.subject} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center gap-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted text-center leading-tight h-6 flex items-center">{d.subject}</span>
                    <span className="text-sm font-black text-text-primary">{formatNum(d.original, 1)}{d.suffix}</span>
                 </div>
              ))}
           </div>

           <div className="mt-4 flex items-center justify-center p-3 bg-primary/5 text-primary rounded-xl w-full border border-primary/10">
              <span className="text-sm font-medium">Overall Balance Score: <strong className="font-black ml-1">{formatNum(avgScore, 1)}%</strong></span>
           </div>

           <div className="mt-4 w-full rounded-xl border border-border bg-card overflow-hidden">
             <div className="flex items-center gap-2 border-b border-border px-4 py-3">
               <ClipboardCheck className="h-4 w-4 text-primary" />
               <div>
                 <h4 className="text-sm font-bold text-text-primary">KPI Audit</h4>
                 <p className="text-[10px] text-text-muted mt-0.5">Breakdown angka mentah, rumus, dan status data agent.</p>
               </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-[11px]">
                 <thead className="bg-surface text-text-muted">
                   <tr>
                     <th className="px-3 py-2 font-bold uppercase tracking-wide">KPI</th>
                     <th className="px-3 py-2 font-bold uppercase tracking-wide">Raw</th>
                     <th className="px-3 py-2 font-bold uppercase tracking-wide">Result</th>
                     <th className="px-3 py-2 font-bold uppercase tracking-wide">Formula</th>
                     <th className="px-3 py-2 font-bold uppercase tracking-wide">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {auditRows.map((row) => (
                     <tr key={row.label} className="border-t border-border/70">
                       <td className="px-3 py-2 align-top">
                         <div className="font-bold text-text-primary">{row.label}</div>
                         <div className="text-[10px] text-text-muted mt-0.5">{row.source}</div>
                       </td>
                       <td className="px-3 py-2 align-top font-semibold text-text-secondary">{row.raw}</td>
                       <td className="px-3 py-2 align-top font-black text-text-primary">{row.result}</td>
                       <td className="px-3 py-2 align-top text-text-muted min-w-[180px]">{row.formula}</td>
                       <td className="px-3 py-2 align-top">
                         <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-bold ${
                           row.status === 'Ready'
                             ? 'border-success/20 bg-success/5 text-success'
                             : 'border-warning/20 bg-warning/5 text-warning'
                         }`}>
                           {row.status}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
