import React, { useMemo } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum } from '../../lib/utils';
import { X, User } from 'lucide-react';
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
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
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
        
        <div className="p-4 sm:p-6 flex flex-col items-center">
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
        </div>
      </div>
    </div>
  );
};
