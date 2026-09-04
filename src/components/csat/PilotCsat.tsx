import React, { useMemo, useState } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum, cn } from '../../lib/utils';
import { Sparkline } from '../ui/Sparkline';
import { EmptyState } from '../ui/EmptyState';
import { IncompleteDataNotice } from '../ui/IncompleteDataNotice';
import { downloadCsv } from '../../lib/exportCsv';
import { Rocket, X, Download, ChevronDown, Loader2 } from 'lucide-react';
import {
  buildPilotAgentRow,
  getPilotBatches,
  PILOT_LULUS_MIN,
  type PilotEntry,
  type PilotAgentRow,
  type PilotStatus,
  type PilotCase,
} from '../../lib/pilot';

const STATUS: Record<PilotStatus, { label: string; cls: string }> = {
  lulus: { label: 'LULUS', cls: 'bg-success-soft text-success-text' },
  berproses: { label: 'Berproses', cls: 'bg-warning-soft text-warning-text' },
  'next-batch': { label: 'Next Batch', cls: 'bg-danger-soft text-danger-text' },
  'no-data': { label: 'Belum ada data', cls: 'bg-surface-muted text-text-muted' },
};

const pct = (v: number | null, d = 1) => (v === null ? '–' : `${formatNum(v, d)}%`);
const signed = (v: number | null, d = 1) => (v === null ? '–' : `${v >= 0 ? '+' : ''}${formatNum(v, d)}`);

const gridCols = 'grid-cols-[30px_minmax(0,1fr)_64px_100px_72px_60px_86px_24px]';

/** Weekly bars with a Δ-vs-previous-point badge — used in the drawer and the inline row expand. */
const WeekBars: React.FC<{ weeks: PilotAgentRow['weeks']; baseline: number | null; compact?: boolean }> = ({ weeks, baseline, compact }) => {
  const max = Math.max(100, baseline ?? 0, ...weeks.map((w) => w.pct ?? 0));
  const Row: React.FC<{ label: string; value: number | null; prev?: number | null; muted?: boolean }> = ({ label, value, prev, muted }) => {
    const delta = value !== null && prev !== undefined && prev !== null ? value - prev : null;
    return (
      <div className={cn('grid items-center gap-2', compact ? 'grid-cols-[70px_1fr_40px_44px]' : 'grid-cols-[92px_1fr_46px_48px]')}>
        <span className="truncate text-[10px] text-text-muted">{label}</span>
        <div className="h-2 rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full ${muted ? 'bg-border-strong' : 'bg-text-muted'}`}
            style={{ width: `${value === null ? 0 : Math.min((value / max) * 100, 100)}%` }}
          />
        </div>
        <span className="text-right text-[11px] tabular-nums text-text-secondary">{pct(value, 0)}</span>
        <span className={cn('text-right text-[10px] font-medium tabular-nums', delta === null ? 'text-text-disabled' : delta >= 0 ? 'text-success' : 'text-danger')}>
          {delta === null ? '' : signed(delta, 0)}
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-1.5">
      {baseline !== null && <Row label="Baseline" value={baseline} muted />}
      {weeks.map((w, i) => (
        <Row key={i} label={w.label} value={w.pct} />
      ))}
    </div>
  );
};

const CaseCard: React.FC<{ c: PilotCase; tone: 'bad' | 'good' }> = ({ c, tone }) => (
  <div
    className={cn(
      'rounded-lg border p-2.5',
      tone === 'bad' ? 'border-danger/30 bg-danger/[0.04]' : 'border-success/30 bg-success/[0.04]',
    )}
  >
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="font-semibold tabular-nums text-text-primary">{c.date}</span>
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-bold',
          tone === 'bad' ? 'bg-danger-soft text-danger-text' : 'bg-success-soft text-success-text',
        )}
      >
        {c.score}★
      </span>
    </div>
    <div className="mt-1 text-[11px] font-medium text-text-secondary">{c.category}</div>
    {c.response && (
      <p className="mt-1 text-[11px] italic leading-relaxed text-text-muted">&ldquo;{c.response}&rdquo;</p>
    )}
  </div>
);

const PilotDetail: React.FC<{ row: PilotAgentRow; onClose?: () => void }> = ({ row, onClose }) => {
  const st = STATUS[row.status];
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-text-primary">{row.name}</h3>
          <p className="mt-0.5 truncate text-xs text-text-secondary">{row.csId} · TL {row.teamLeader}</p>
          <span className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', st.cls)}>{st.label}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border bg-surface p-2">
          <div className="text-[9px] uppercase tracking-wide text-text-muted">Baseline</div>
          <div className="mt-1 text-sm font-bold tabular-nums text-text-secondary">{pct(row.baseline)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2">
          <div className="text-[9px] uppercase tracking-wide text-text-muted">Terkini</div>
          <div className="mt-1 text-sm font-bold tabular-nums text-text-primary">{pct(row.current)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2">
          <div className="text-[9px] uppercase tracking-wide text-text-muted">Δ vs baseline</div>
          <div
            className={cn(
              'mt-1 text-sm font-bold tabular-nums',
              row.delta === null ? 'text-text-disabled' : row.delta >= 0 ? 'text-success-text' : 'text-danger',
            )}
          >
            {signed(row.delta)}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Tren mingguan</div>
        <WeekBars weeks={row.weeks} baseline={row.baseline} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">DSAT (rating 1–2)</span>
          <span className="text-[11px] tabular-nums text-text-secondary">
            {row.dsatCount}
            {row.dsatPct !== null ? ` · ${formatNum(row.dsatPct, 1)}%` : ''}
          </span>
        </div>
        {row.dsatByCategory.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {row.dsatByCategory.slice(0, 6).map((c) => {
              const repeat = row.repeatIndicators.includes(c.category);
              return (
                <li key={c.category} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={cn('min-w-0 truncate', repeat ? 'font-semibold text-warning-text' : 'text-text-secondary')}>
                    {c.category}
                    {repeat ? ' ↻' : ''}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-primary">{c.count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-text-muted">Tidak ada rating buruk pada periode ini.</p>
        )}
        {row.repeatIndicators.length > 0 && (
          <p className="mt-2 text-[10px] text-text-muted">↻ = indikator berulang (muncul di ≥ 2 minggu)</p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-danger-text">Bad handling (rating 1–2)</div>
        {row.badCases.length ? (
          <div className="flex flex-col gap-2">
            {row.badCases.map((c, i) => (
              <CaseCard key={i} c={c} tone="bad" />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">Tidak ada pada periode ini.</p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-success-text">Good handling (rating 4–5)</div>
        {row.goodCases.length ? (
          <div className="flex flex-col gap-2">
            {row.goodCases.map((c, i) => (
              <CaseCard key={i} c={c} tone="good" />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">Tidak ada pada periode ini.</p>
        )}
      </div>

      {row.note && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">Catatan coaching</div>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-secondary">{row.note}</p>
        </div>
      )}
    </>
  );
};

export const PilotCsat: React.FC<{
  data: AgentKPI[];
  pilotEntries: PilotEntry[];
  periodEnd: string;
  /** True while the shared KPI worker is (re)computing — e.g. right after
   *  landing on this tab, its wide baseline+batch window is still in
   *  flight. Participant rows must not flash "tidak ketemu" while that's
   *  still catching up — only once it settles is a mismatch real. */
  isProcessing?: boolean;
}> = ({ data, pilotEntries, periodEnd, isProcessing = false }) => {
  const batches = useMemo(() => getPilotBatches(pilotEntries), [pilotEntries]);
  const [batchName, setBatchName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The mobile slide-in drawer only opens on an explicit tap — auto-selecting
  // the top participant (below) must not pop it open on page load.
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileDrawerOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const activeBatch = batches.find((b) => b.name === batchName) ?? batches[0];

  const byCsId = useMemo(() => new Map<string, AgentKPI>(data.map((a) => [a.csId, a] as const)), [data]);

  const rows = useMemo<PilotAgentRow[]>(() => {
    if (!activeBatch) return [];
    return activeBatch.entries
      .map((e) => buildPilotAgentRow(e, byCsId.get(e.csId), activeBatch.endDate || periodEnd))
      .sort((a, b) => (b.current ?? -1) - (a.current ?? -1));
  }, [activeBatch, byCsId, periodEnd]);

  /** CS IDs listed in this batch's sheet rows that don't exist at all in the loaded period data — likely typos. */
  const mismatchedIds = useMemo(() => {
    if (!activeBatch) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of activeBatch.entries) {
      if (byCsId.has(e.csId) || seen.has(e.csId)) continue;
      seen.add(e.csId);
      out.push(e.csId);
    }
    return out;
  }, [activeBatch, byCsId]);

  /** One row per batch (not just the active one) so batches can be compared side by side. */
  const batchSummaries = useMemo(() => {
    return batches.map((b) => {
      const batchRows = b.entries.map((e) => buildPilotAgentRow(e, byCsId.get(e.csId), b.endDate || periodEnd));
      const batchDeltas = batchRows.map((r) => r.delta).filter((d): d is number => d !== null);
      return {
        name: b.name,
        startDate: b.startDate,
        endDate: b.endDate,
        participants: b.entries.length,
        lulus: batchRows.filter((r) => r.status === 'lulus').length,
        avgDelta: batchDeltas.length ? batchDeltas.reduce((s, d) => s + d, 0) / batchDeltas.length : null,
      };
    });
  }, [batches, byCsId, periodEnd]);

  const selected = rows.find((r) => r.csId === selectedId) ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Default to the top-ranked participant so the detail panel is never a
  // blank "pilih peserta" placeholder — it only stays empty when the batch
  // truly has no one in it. Re-resolves after a batch switch too.
  React.useEffect(() => {
    if (rows.length === 0) { setSelectedId(null); return; }
    if (selectedId && rows.some((r) => r.csId === selectedId)) return;
    setSelectedId(rows[0].csId);
  }, [rows, selectedId]);

  if (pilotEntries.length === 0) {
    return (
      <div className="p-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Rocket className="h-5 w-5 text-primary" /> Pilot CSAT
        </h2>
        <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Rocket className="mx-auto h-10 w-10 text-text-muted stroke-1" />
          <p className="mt-3 text-sm font-semibold text-text-primary">Belum ada roster pilot</p>
          <p className="mt-1 text-xs text-text-muted">
            Buat tab <code className="rounded bg-surface px-1">PILOT</code> di spreadsheet dengan kolom:
            Batch · CS ID · Tanggal Mulai · Tanggal Selesai · Catatan Coaching. Lalu Sync.
          </p>
        </div>
      </div>
    );
  }

  const lulus = rows.filter((r) => r.status === 'lulus').length;
  const deltas = rows.map((r) => r.delta).filter((d): d is number => d !== null);
  const avgDelta = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null;

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Rocket className="h-5 w-5 text-primary" /> Pilot CSAT
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={activeBatch?.name ?? ''}
            onChange={(e) => {
              setBatchName(e.target.value);
              setSelectedId(null);
              setExpandedId(null);
              setMobileDrawerOpen(false);
            }}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
          >
            {batches.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
          <button
            onClick={() =>
              downloadCsv(
                `pilot_${(activeBatch?.name || 'batch').replace(/\s+/g, '_')}.csv`,
                rows.map((r, i) => ({
                  rank: i + 1,
                  name: r.name,
                  csId: r.csId,
                  tl: r.teamLeader,
                  baseline: r.baseline,
                  current: r.current,
                  delta: r.delta,
                  status: STATUS[r.status].label,
                  dsat: r.dsatCount,
                  repeatIndicators: r.repeatIndicators.join('; '),
                  note: r.note,
                })),
                [
                  { key: 'rank', label: 'No' },
                  { key: 'name', label: 'Nama' },
                  { key: 'csId', label: 'CS ID' },
                  { key: 'tl', label: 'Team Leader' },
                  { key: 'baseline', label: 'Baseline %' },
                  { key: 'current', label: 'CSAT Terkini %' },
                  { key: 'delta', label: 'Δ vs Baseline' },
                  { key: 'status', label: 'Status' },
                  { key: 'dsat', label: 'DSAT (1-2)' },
                  { key: 'repeatIndicators', label: 'Repeat Indicator' },
                  { key: 'note', label: 'Catatan Coaching' },
                ],
              )
            }
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-muted"
          >
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {activeBatch && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] tabular-nums text-text-muted">
          <span>{activeBatch.startDate} &ndash; {activeBatch.endDate || 'berjalan'}</span>
          <span>{rows.length} peserta</span>
          <span>{lulus} LULUS</span>
          {avgDelta !== null && <span>rata-rata Δ {signed(avgDelta)} poin vs baseline</span>}
          <span className="normal-case">ambang LULUS ≥ {PILOT_LULUS_MIN}% + tren naik</span>
        </div>
      )}

      {/* Mismatches only mean anything once the wide pilot window has actually
          finished computing — while isProcessing is true, "not found" could
          just be an empty in-flight result, not a real typo. */}
      {!isProcessing && mismatchedIds.length > 0 && (
        <IncompleteDataNotice
          title="Ada CS ID di batch ini yang tidak ketemu di periode yang ter-load"
          issues={[
            `${mismatchedIds.length} CS ID tidak ditemukan: ${mismatchedIds.join(', ')}. Cek typo di tab PILOT, atau perlebar periode / Sync ulang.`,
          ]}
        />
      )}

      {batchSummaries.length > 1 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Riwayat Batch
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 font-medium">Periode</th>
                  <th className="px-3 py-2 text-right font-medium">Peserta</th>
                  <th className="px-3 py-2 text-right font-medium">LULUS</th>
                  <th className="px-3 py-2 text-right font-medium">Rata-rata Δ</th>
                </tr>
              </thead>
              <tbody>
                {batchSummaries.map((b) => {
                  const isActive = b.name === (activeBatch?.name ?? '');
                  return (
                    <tr
                      key={b.name}
                      onClick={() => {
                        setBatchName(b.name);
                        setSelectedId(null);
                        setExpandedId(null);
                        setMobileDrawerOpen(false);
                      }}
                      className={cn(
                        'cursor-pointer border-t border-border/60 transition-colors',
                        isActive ? 'bg-surface-muted' : 'hover:bg-surface-muted/60',
                      )}
                    >
                      <td className="px-3 py-2 font-semibold text-text-primary">{b.name}</td>
                      <td className="px-3 py-2 tabular-nums text-text-secondary">{b.startDate} &ndash; {b.endDate || 'berjalan'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.participants}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.lulus}</td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-semibold tabular-nums',
                          b.avgDelta === null ? 'text-text-disabled' : b.avgDelta >= 0 ? 'text-success' : 'text-danger',
                        )}
                      >
                        {signed(b.avgDelta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className={cn('grid gap-3 border-b border-border bg-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted', gridCols)}>
            <span className="text-center">#</span>
            <span>Peserta</span>
            <span className="text-right">Baseline</span>
            <span>Tren mingguan</span>
            <span className="text-right">Terkini</span>
            <span className="text-right">Δ</span>
            <span className="text-right">Status</span>
            <span />
          </div>

          {isProcessing ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs">Menghitung data pilot…</p>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Agent batch ini belum ada di data"
              description="CS ID di batch ini tidak ketemu pada periode yang ter-load. Perlebar periode / Sync ulang."
              variant="filter"
              className="border-0 bg-transparent py-8"
              showDataActions
            />
          ) : (
            rows.map((r, i) => {
              const st = STATUS[r.status];
              const isSel = selectedId === r.csId;
              const isExpanded = expandedId === r.csId;
              const noMatch = mismatchedIds.includes(r.csId);
              return (
                <div key={r.csId} className="border-b border-border/60">
                  <button
                    onClick={() => {
                      setSelectedId(r.csId);
                      setMobileDrawerOpen(true);
                    }}
                    className={cn(
                      'grid w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      gridCols,
                      isSel ? 'bg-surface-muted' : 'hover:bg-surface-muted/60',
                    )}
                  >
                    <span className="text-center text-[12px] font-bold tabular-nums text-text-muted">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-text-primary" title={r.csId}>{r.name}</span>
                      <span className="block truncate text-[10px] text-text-muted">
                        {r.csId}
                        {noMatch && <span className="ml-1 text-danger">· tidak ketemu</span>}
                      </span>
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-text-secondary">{pct(r.baseline)}</span>
                    <span className={cn('block', r.trendUp ? 'text-success' : 'text-text-muted')}>
                      <Sparkline values={r.weeks.map((w) => w.pct)} height={22} />
                    </span>
                    <span className="text-right text-[13px] font-bold tabular-nums text-text-primary">{pct(r.current)}</span>
                    <span
                      className={cn(
                        'text-right text-[11px] font-semibold tabular-nums',
                        r.delta === null ? 'text-text-disabled' : r.delta >= 0 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {signed(r.delta)}
                    </span>
                    <span className="text-right">
                      <span className={cn('inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold', st.cls)}>{st.label}</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={isExpanded ? 'Tutup tren mingguan' : 'Lihat tren mingguan'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : r.csId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : r.csId);
                        }
                      }}
                      className="flex items-center justify-center rounded p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-surface/60 px-3 py-2.5 pl-11">
                      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">Tren mingguan · {r.name}</div>
                      <WeekBars weeks={r.weeks} baseline={r.baseline} compact />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl border border-border bg-card p-4">
            {selected ? (
              <PilotDetail row={selected} />
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted">
                <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Menghitung data pilot…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted">
                <Rocket className="mb-3 h-8 w-8 stroke-1" />
                <p className="text-xs">
                  {rows.length === 0 ? 'Belum ada peserta di batch ini.' : 'Pilih peserta untuk lihat before/after, DSAT, & contoh case.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="h-full w-full max-w-[380px] overflow-y-auto border-l border-border bg-card p-4 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <PilotDetail row={selected} onClose={() => setMobileDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PilotCsat;
