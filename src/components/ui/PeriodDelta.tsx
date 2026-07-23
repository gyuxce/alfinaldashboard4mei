import React from 'react';
import { formatNum, cn } from '../../lib/utils';

/** Compact WoW/MoM delta badge for atasan headers/cards. */
export const PeriodDelta: React.FC<{
  current: number;
  previous?: number | null;
  digits?: number;
  suffix?: string;
  /** When true, lower delta is "good" (e.g. defects, RCA cases). */
  lowerIsBetter?: boolean;
  className?: string;
  label?: string;
}> = ({
  current,
  previous,
  digits = 1,
  suffix = '',
  lowerIsBetter = false,
  className,
  label = 'vs prev',
}) => {
  if (previous === null || previous === undefined || Number.isNaN(previous)) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 1e-9) {
    return (
      <span className={cn('text-[10px] font-semibold text-text-muted', className)}>
        ▬ 0{suffix} {label}
      </span>
    );
  }
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <span
      className={cn(
        'text-[10px] font-bold',
        isGood ? 'text-success' : 'text-danger',
        className,
      )}
    >
      {delta > 0 ? '▲' : '▼'} {formatNum(Math.abs(delta), digits)}
      {suffix} {label}
    </span>
  );
};
