import React from 'react';
import { cn } from '../../lib/utils';

export type KpiRankItem = {
  label: string;
  value: string;
  subLabel?: string;
};

export type KpiRankCardConfig = {
  title: string;
  items: KpiRankItem[];
  tone?: 'good' | 'bad' | 'neutral';
  emptyText?: string;
};

type RankCardProps = KpiRankCardConfig;

const RankCard: React.FC<RankCardProps> = ({ title, items, tone = 'neutral', emptyText = 'Belum ada data' }) => {
  const toneClass =
    tone === 'good'
      ? 'border-t-success'
      : tone === 'bad'
        ? 'border-t-danger'
        : 'border-t-border';

  return (
    <div
      className={cn(
        'rounded-lg border border-border border-t-[3px] bg-card p-4 min-w-0',
        toneClass,
      )}
    >
      <div className="text-[11px] font-medium tracking-wide text-text-muted mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li key={`${item.label}-${idx}`} className="flex items-start gap-2.5 min-w-0">
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
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="text-[13px] font-semibold leading-snug text-text-primary break-words line-clamp-2"
                    title={item.label}
                  >
                    {item.label}
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-text-primary">{item.value}</span>
                </div>
                {item.subLabel ? (
                  <div className="mt-0.5 truncate text-[10px] text-text-muted" title={item.subLabel}>
                    {item.subLabel}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export type KpiRankListsProps = {
  cards: KpiRankCardConfig[];
  className?: string;
};

/** Kartu ranking fleksibel (2–4 kolom) untuk highlight KPI */
export function KpiRankLists({ cards, className }: KpiRankListsProps) {
  const visible = cards.filter(Boolean);
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 gap-3',
        visible.length >= 4 ? 'xl:grid-cols-4' : visible.length === 3 ? 'xl:grid-cols-3' : '',
        className,
      )}
    >
      {visible.map((card) => (
        <RankCard
          key={card.title}
          title={card.title}
          items={card.items}
          tone={card.tone}
          emptyText={card.emptyText}
        />
      ))}
    </div>
  );
}
