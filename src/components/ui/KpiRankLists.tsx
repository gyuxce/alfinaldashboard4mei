import React from 'react';
import { cn } from '../../lib/utils';

export type KpiRankItem = {
  label: string;
  value: string;
  subLabel?: string;
};

type RankCardProps = {
  title: string;
  items: KpiRankItem[];
  tone?: 'good' | 'bad' | 'neutral';
  emptyText?: string;
};

function RankCard({ title, items, tone = 'neutral', emptyText = 'Belum ada data' }: RankCardProps) {
  const toneClass =
    tone === 'good'
      ? 'border-t-success'
      : tone === 'bad'
        ? 'border-t-danger'
        : 'border-t-border';

  return (
    <div
      className={cn(
        'rounded-xl border border-border border-t-[3px] bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        toneClass,
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, idx) => (
            <li key={`${item.label}-${idx}`} className="flex items-start gap-2 min-w-0">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                  tone === 'good'
                    ? 'bg-success/10 text-success'
                    : tone === 'bad'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-surface-muted text-text-secondary',
                )}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text-primary" title={item.label}>
                  {item.label}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {item.subLabel ? (
                    <span className="truncate text-[10px] text-text-muted" title={item.subLabel}>
                      {item.subLabel}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="shrink-0 text-xs font-bold tabular-nums text-text-primary">{item.value}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type KpiRankListsProps = {
  topCategories: KpiRankItem[];
  bottomCategories: KpiRankItem[];
  topAgents: KpiRankItem[];
  bottomAgents: KpiRankItem[];
  categoryLabel?: string;
  agentLabel?: string;
  className?: string;
};

/** Empat kartu list: Top/Bottom 3 kategori + Top/Bottom 3 agent */
export function KpiRankLists({
  topCategories,
  bottomCategories,
  topAgents,
  bottomAgents,
  categoryLabel = 'Kategori',
  agentLabel = 'Agent',
  className,
}: KpiRankListsProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3', className)}>
      <RankCard title={`Top 3 ${categoryLabel}`} items={topCategories} tone="good" />
      <RankCard title={`Bottom 3 ${categoryLabel}`} items={bottomCategories} tone="bad" />
      <RankCard title={`Top 3 ${agentLabel}`} items={topAgents} tone="good" />
      <RankCard title={`Bottom 3 ${agentLabel}`} items={bottomAgents} tone="bad" />
    </div>
  );
}
