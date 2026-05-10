import React from 'react';
import { cn, KpiType, getKpiColor, formatNum } from '../../lib/utils';

interface BpoPerformanceProps {
  data: { name: string; value: number; type: KpiType }[];
  formatFn?: (val: number) => string;
}

export const BpoPerformanceCard: React.FC<BpoPerformanceProps> = ({ data, formatFn }) => {
  // Always use at least 3 columns for layout consistency
  const gridColsClass = 
    data.length === 1 ? 'grid-cols-1 md:grid-cols-3' :
    data.length === 2 ? 'grid-cols-2 md:grid-cols-3' : 
    'grid-cols-3';

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="px-3 pt-3 pb-2 border-b border-border/50 bg-surface/50">
         <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest">BPO Performance</div>
      </div>
      
      <div className={cn("grid gap-0 flex-1", gridColsClass)}>
        {data.map((item, index) => {
          const colorClass = getKpiColor(item.value, item.type);
          const isUnderperform = colorClass.includes('danger');
          const isLast = index === data.length - 1;
          
          return (
            <div 
              key={item.name} 
              className={cn(
                "flex flex-col justify-center px-3 py-2.5",
                !isLast && "/60"
              )}
            >
              <div 
                className="text-[10px] uppercase tracking-wider text-text-secondary font-medium truncate max-w-full mb-0.5"
                title={item.name}
              >
                {item.name}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-base font-bold", colorClass !== 'text-text-disabled' ? colorClass : 'text-text-primary')}>
                  {formatFn ? formatFn(item.value) : formatNum(item.value)}
                </span>
                <span 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0", 
                    colorClass === 'text-success' && "bg-success",
                    colorClass === 'text-danger' && "bg-danger",
                    colorClass === 'text-warning' && "bg-warning",
                    colorClass === 'text-text-disabled' && "bg-text-muted",
                    isUnderperform && "animate-pulse"
                  )}
                />
              </div>
            </div>
          );
        })}
        {/* Fill empty slots if less than 3 for visual grid consistency */}
        {data.length < 3 && Array.from({ length: 3 - data.length }).map((_, i) => (
          <div key={`empty-${i}`} className={cn("px-3 py-2.5 hidden md:block", i === 0 && data.length === 1 && "/60", data.length === 2 && i === 0 && "/60")} />
        ))}
      </div>
    </div>
  );
};
