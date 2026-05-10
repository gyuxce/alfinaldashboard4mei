import React from 'react';

export interface TickerItem {
  label?: string;
  value: string;
  colorType?: 'success' | 'danger' | 'primary' | 'warning' | 'info' | 'neutral';
  isSeparator?: boolean;
  hasDotRight?: boolean;
}

export interface KpiTickerProps {
  items: TickerItem[];
}

export const buildRankingItems = (
  items: { name: string; value: string | number }[],
  groupLabel: string,
  topCount = 3
): TickerItem[] => {
  const result: TickerItem[] = [
    { label: groupLabel, value: '', colorType: 'neutral' }
  ];
  
  items.forEach((item, idx) => {
    result.push({
      value: `${item.name} ${item.value}`,
      colorType: (idx < topCount ? 'success' : 'danger') as 'success' | 'danger',
      hasDotRight: idx < items.length - 1
    });
  });

  return result;
};

export const KpiTicker: React.FC<KpiTickerProps> = ({ items }) => {
  const loopingItems = [...items, ...items];
  const tickerRef = React.useRef<HTMLDivElement>(null);
  const [tickerDuration, setTickerDuration] = React.useState(30);

  React.useEffect(() => {
    let observer: ResizeObserver;
    if (tickerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
           const distance = entry.target.scrollWidth / 2;
           setTickerDuration(Math.max(distance / 50, 1));
        }
      });
      observer.observe(tickerRef.current);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [items]);

  const getColorClass = (type?: string) => {
    switch (type) {
      case 'success': return 'text-success-text';
      case 'danger': return 'text-danger-text';
      case 'primary': return 'text-[#E31E24]';
      case 'warning': return 'text-warning-text';
      case 'info': return 'text-info-text';
      case 'neutral': 
      default: return 'text-text-primary';
    }
  };

  return (
    <div className="relative flex overflow-hidden bg-surface-muted/50 rounded-xl border border-border mb-4 py-3 group">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none rounded-l-xl" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none rounded-r-xl" />
      
      <div 
        ref={tickerRef} 
        className="flex whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${tickerDuration}s` }}
      >
        {loopingItems.map((item, idx) => (
          <div key={idx} className="flex items-center shrink-0">
            {item.isSeparator ? (
              <div className="h-4 w-px bg-border mx-3" />
            ) : (
              <div className="flex items-baseline md:items-center">
                {item.label && (
                  <span className="text-[11px] text-text-muted mr-1 tracking-wide font-medium">{item.label}</span>
                )}
                <span className={`text-[13px] font-semibold ${getColorClass(item.colorType)}`}>
                  {item.value}
                </span>
                {item.hasDotRight && <span className="text-border mx-2 font-normal">·</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
