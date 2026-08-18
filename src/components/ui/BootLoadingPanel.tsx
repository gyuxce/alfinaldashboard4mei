import React from 'react';
import { BrandLoading } from './BrandLoading';
import { cn } from '../../lib/utils';

export type SyncStep = {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'error';
};

type Props = {
  title?: string;
  subtitle?: string;
  steps?: SyncStep[];
  className?: string;
};

/** In-content boot/sync panel — keeps shell visible, avoids fullscreen flash. */
export function BootLoadingPanel({
  title = 'Mohon menunggu...',
  subtitle = 'Sedang menyiapkan dashboard',
  steps,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[min(70vh,560px)] w-full flex-col items-center justify-center px-4 py-10',
        className,
      )}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card px-8 py-8 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <BrandLoading title={title} subtitle={subtitle} />
        {steps && steps.length > 0 ? (
          <ul className="mt-6 space-y-2 border-t border-border pt-5" aria-label="Progres sync">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex items-center gap-2.5 text-[12px]"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    step.state === 'done' && 'bg-success',
                    step.state === 'active' && 'bg-primary animate-pulse',
                    step.state === 'error' && 'bg-danger',
                    step.state === 'pending' && 'bg-border',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    step.state === 'active' && 'font-semibold text-text-primary',
                    step.state === 'done' && 'text-text-muted',
                    step.state === 'pending' && 'text-text-disabled',
                    step.state === 'error' && 'font-medium text-danger',
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
