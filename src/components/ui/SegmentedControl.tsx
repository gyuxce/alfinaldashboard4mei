import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export function segmentTabClass(active: boolean, className?: string) {
  return cn(
    'px-3.5 py-2 rounded-md text-[13px] transition-colors duration-150 flex items-center gap-2 whitespace-nowrap',
    active
      ? 'bg-card text-text-primary font-medium shadow-sm ring-1 ring-border'
      : 'bg-transparent text-text-secondary font-medium hover:text-text-primary hover:bg-surface',
    className,
  );
}

export function segmentTrackClass(className?: string) {
  return cn(
    'flex overflow-x-auto no-scrollbar bg-surface-muted p-1 rounded-lg w-full md:w-max gap-0.5',
    className,
  );
}

type SegmentOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  trackClassName?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  trackClassName,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn(segmentTrackClass(trackClassName), className)}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={segmentTabClass(active)}
          >
            {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
