import React from 'react';
import Papa from 'papaparse';
import { useShallow } from 'zustand/react/shallow';
import { useStore, AppState } from '../../store';
import { UploadCloud, CheckCircle2, FileText, DownloadCloud, Loader2, DatabaseBackup, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSheetConfigForMonth, getSheetMonthOption, getSheetMonthOptions } from '../../lib/sheetsApi';
import { 
  countDataRows,
  validateCsidFile, 
  validateProductivityFile, 
  validateCsatScFile, 
  validateSlaFile, 
  validateScheduleFile, 
  validateQaFile,
  ValidationResult
} from '../../lib/csvValidator';
import { normalizeDateStr } from '../../lib/dates';
import { formatRelativeTime, isStaleSync } from '../../lib/dataQuality';
import {
  cell,
  pickColumn,
  resolveCsatScColumns,
  resolveProductivityColumns,
  resolveQaColumns,
  resolveRowCsId,
  resolveScheduleIdentityColumns,
  resolveSlaColumns,
} from '../../lib/sheetHeaders';

const validators: Record<string, (data: any[][]) => ValidationResult> = {
  csidFile: validateCsidFile,
  productivityFile: validateProductivityFile,
  csatScFile: validateCsatScFile,
  slaFile: validateSlaFile,
  scheduleFile: validateScheduleFile,
  qaFile: validateQaFile,
};

const dataSources = [
  { label: 'Master CSID', fileKey: 'csidFile', dataKey: 'csidData' },
  { label: 'Productivity, CSAT, WHU', fileKey: 'productivityFile', dataKey: 'productivityData' },
  { label: 'CSAT SC Raw Data', fileKey: 'csatScFile', dataKey: 'csatScData' },
  { label: 'SLA Responses', fileKey: 'slaFile', dataKey: 'slaData' },
  { label: 'Agent Scheduling', fileKey: 'scheduleFile', dataKey: 'scheduleData' },
  { label: 'QA Score', fileKey: 'qaFile', dataKey: 'qaData' },
] as const;

type HealthStatus = 'ok' | 'warning' | 'error' | 'missing';
type DataSource = typeof dataSources[number];

const getHealthStyles = (status: HealthStatus) => {
  switch (status) {
    case 'ok':
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-success" />,
        label: 'OK',
        className: 'border-success/20 bg-success/5 text-success',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="w-4 h-4 text-warning" />,
        label: 'Warning',
        className: 'border-warning/20 bg-warning/5 text-warning',
      };
    case 'error':
      return {
        icon: <AlertCircle className="w-4 h-4 text-danger" />,
        label: 'Error',
        className: 'border-danger/20 bg-danger/5 text-danger',
      };
    default:
      return {
        icon: <FileText className="w-4 h-4 text-text-muted" />,
        label: 'Missing',
        className: 'border-border bg-surface/40 text-text-muted',
      };
  }
};

const extractCsIds = (
  data: any[][],
  dataKey: DataSource['dataKey'],
  masterIds: ReadonlySet<string>,
) => {
  const ids = new Set<string>();
  const header = data[0] || [];

  const addId = (value: unknown) => {
    const id = String(value || '').trim();
    if (id.startsWith('3-1-')) ids.add(id);
  };

  const scheduleCols = dataKey === 'scheduleData' ? resolveScheduleIdentityColumns(header) : null;
  const qaCsIdIdx = dataKey === 'qaData' ? pickColumn(resolveQaColumns(header).csId, 0) : -1;

  data.forEach((row, index) => {
    if (!row || index === 0) return;

    if (scheduleCols) {
      addId(cell(row, scheduleCols.csId));
      return;
    }

    if (dataKey === 'qaData') {
      addId(resolveRowCsId(row, qaCsIdIdx).id);
      return;
    }

    if (dataKey === 'productivityData' || dataKey === 'csatScData' || dataKey === 'slaData') {
      row.forEach((value) => {
        const id = String(value || '').trim();
        if (id.startsWith('3-1-') && masterIds.has(id)) ids.add(id);
      });
    }
  });

  return ids;
};

const getDateHealth = (source: DataSource, data: any[][]) => {
  if (source.dataKey === 'csidData') {
    return { checked: 0, invalid: 0, samples: [] as string[], ruleLabel: 'No date expected' };
  }

  const samples: string[] = [];
  let checked = 0;
  let invalid = 0;

  const checkValue = (raw: unknown) => {
    const value = String(raw || '').trim();
    if (!value) return;
    checked += 1;
    if (!normalizeDateStr(value)) {
      invalid += 1;
      if (samples.length < 3) samples.push(value);
    }
  };

  if (source.dataKey === 'scheduleData') {
    const header = data[0] || [];
    const firstDate = resolveScheduleIdentityColumns(header).firstDateColumn;
    for (let c = firstDate; c < header.length; c++) {
      checkValue(header[c]);
    }
    return { checked, invalid, samples, ruleLabel: 'Schedule header dates' };
  }

  const header = data[0] || [];
  const dateIdxBySource: Record<string, { idx: number; startRow: number; label: string }> = {
    productivityData: {
      idx: pickColumn(resolveProductivityColumns(data).date, 0),
      startRow: 2,
      label: 'Productivity date column',
    },
    csatScData: {
      idx: pickColumn(resolveCsatScColumns(header).date, 0),
      startRow: 1,
      label: 'CSAT SC date column',
    },
    slaData: {
      idx: pickColumn(resolveSlaColumns(data).date, 0),
      startRow: 1,
      label: 'SLA date column',
    },
    qaData: {
      idx: pickColumn(resolveQaColumns(header).date, 13),
      startRow: 1,
      label: 'QA checking date column',
    },
  };
  const sourceConfig = dateIdxBySource[source.dataKey];
  if (!sourceConfig) return { checked, invalid, samples, ruleLabel: 'No date rule' };

  for (let r = sourceConfig.startRow; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.some(item => String(item || '').trim() !== '')) continue;
    checkValue(row[sourceConfig.idx]);
  }

  return { checked, invalid, samples, ruleLabel: sourceConfig.label };
};

type CoverageStatus = 'ok' | 'partial' | 'empty';

const getCoverageStatus = (covered: number, total: number): CoverageStatus => {
  if (total <= 0 || covered <= 0) return 'empty';
  return covered >= total ? 'ok' : 'partial';
};

const getProductivityDuplicateHealth = (data: any[][]) => {
  const seen = new Map<string, { count: number; label: string }>();
  const columns = resolveProductivityColumns(data);
  const startRow = data.length > 2 ? 2 : 1;

  for (let r = startRow; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length < 2) continue;

    const resolved = resolveRowCsId(row, columns.csId);
    if (!resolved.id) continue;

    const dateIdx = pickColumn(columns.date, resolved.index > 0 ? 0 : -1);
    const rawDate = cell(row, dateIdx);
    const normDate = normalizeDateStr(rawDate) || rawDate;
    const agentId = resolved.id;
    const productivity = cell(row, pickColumn(columns.productivity, resolved.index >= 0 ? resolved.index + 8 : -1));
    const csatOfficial = cell(row, pickColumn(columns.csatAsli, resolved.index >= 0 ? resolved.index + 1 : -1));
    const whu = cell(row, pickColumn(columns.whu, resolved.index >= 0 ? resolved.index + 15 : -1));
    const scoreDistribution = [columns.star5, columns.star4, columns.star3, columns.star2, columns.star1]
      .map((idx, i) => cell(row, pickColumn(idx, 3 + i)))
      .join("/");

    const key = [
      agentId,
      normDate,
      productivity,
      csatOfficial,
      whu,
      scoreDistribution,
    ].join("|").toLowerCase();

    if (!agentId || !normDate) continue;

    const label = `${agentId} | ${normDate} | prod ${productivity || "0"} | CSAT ${scoreDistribution}`;
    const current = seen.get(key);
    seen.set(key, current ? { ...current, count: current.count + 1 } : { count: 1, label });
  }

  const duplicates = Array.from(seen.values())
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count);

  return {
    duplicateGroups: duplicates.length,
    duplicateRows: duplicates.reduce((sum, item) => sum + item.count - 1, 0),
    samples: duplicates.slice(0, 5),
  };
};

const DataHealthPanel = ({ isSheetMode }: { isSheetMode: boolean }) => {
  const store = useStore(useShallow((s) => ({
    csidData: s.csidData,
    productivityData: s.productivityData,
    csatScData: s.csatScData,
    slaData: s.slaData,
    scheduleData: s.scheduleData,
    qaData: s.qaData,
    activeMonthRowCounts: s.activeMonthRowCounts,
    fileValidations: s.fileValidations,
  }))) as any;

  const healthItems = React.useMemo(() => {
    return dataSources.map((source) => {
      const data = (store[source.dataKey] || []) as any[][];
      const rows = store.activeMonthRowCounts?.[source.dataKey] ?? countDataRows(data);
      const hasData = data.length > 0 && rows > 0;
      const persistedValidation = store.fileValidations?.[source.fileKey] as ValidationResult | null | undefined;
      const validation = hasData
        ? (isSheetMode ? validators[source.fileKey](data) : persistedValidation || validators[source.fileKey](data))
        : null;
      const status: HealthStatus = !hasData
        ? 'missing'
        : validation?.severity === 'error'
          ? 'error'
          : validation?.severity === 'warning'
            ? 'warning'
            : 'ok';

      return {
        ...source,
        rows,
        status,
        message: validation?.message || '',
        errorType: validation?.errorType || '',
        fileName: store.fileNames?.[source.fileKey] || '',
      };
    });
  }, [
    isSheetMode,
    store.csidData,
    store.productivityData,
    store.csatScData,
    store.slaData,
    store.scheduleData,
    store.qaData,
    store.fileValidations,
    store.fileNames,
  ]);

  const summary = healthItems.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      acc.rows += item.rows;
      return acc;
    },
    { ok: 0, warning: 0, error: 0, missing: 0, rows: 0 } as Record<HealthStatus, number> & { rows: number },
  );

  const masterIdList = React.useMemo<string[]>(() => Object.keys(store.agentDictionary || {}), [store.agentDictionary]);
  const agentCount = masterIdList.length;
  const masterIds = React.useMemo(() => new Set<string>(masterIdList), [masterIdList]);
  const masterProfileIssues = React.useMemo(() => {
    return Object.entries(store.agentDictionary || {})
      .filter(([, profile]: [string, any]) => !profile?.name || !profile?.bpo || !profile?.teamLeader)
      .map(([csId, profile]: [string, any]) => ({
        csId,
        missing: [
          !profile?.name ? 'name' : '',
          !profile?.bpo ? 'BPO' : '',
          !profile?.teamLeader ? 'TL' : '',
        ].filter(Boolean),
      }))
      .sort((a, b) => a.csId.localeCompare(b.csId));
  }, [store.agentDictionary]);

  const coverageItems = React.useMemo(() => {
    return dataSources
      .filter((source) => source.dataKey !== 'csidData')
      .map((source) => {
        const data = (store[source.dataKey] || []) as any[][];
        const ids = extractCsIds(data, source.dataKey, masterIds);
        const matchedIds = Array.from(ids).filter((id) => masterIds.has(id)).sort();
        const missingIds = masterIdList.filter((id) => !ids.has(id)).sort();
        const coverage = agentCount > 0 ? Math.round((matchedIds.length / agentCount) * 100) : 0;

        return {
          label: source.label,
          dataKey: source.dataKey,
          totalIds: ids.size,
          matchedIds,
          missingIds,
          coverage,
          status: getCoverageStatus(matchedIds.length, agentCount),
        };
      });
  }, [
    agentCount,
    masterIdList,
    masterIds,
    store.productivityData,
    store.csatScData,
    store.slaData,
    store.scheduleData,
    store.qaData,
  ]);

  const orphanChecks = React.useMemo(() => {
    return dataSources
      .filter((source) => source.dataKey !== 'csidData')
      .map((source) => {
        const data = (store[source.dataKey] || []) as any[][];
        const ids = extractCsIds(data, source.dataKey, masterIds);
        const orphanIds = Array.from(ids).filter((id) => !masterIds.has(id)).sort();
        return {
          label: source.label,
          totalIds: ids.size,
          orphanIds,
        };
      });
  }, [
    masterIds,
    store.productivityData,
    store.csatScData,
    store.slaData,
    store.scheduleData,
    store.qaData,
  ]);

  const totalOrphanIds = React.useMemo(() => {
    const ids = new Set<string>();
    orphanChecks.forEach((check) => check.orphanIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [orphanChecks]);

  const dateChecks = React.useMemo(() => {
    return dataSources
      .filter((source) => source.dataKey !== 'csidData')
      .map((source) => {
        const data = (store[source.dataKey] || []) as any[][];
        return {
          sourceLabel: source.label,
          ...getDateHealth(source, data),
        };
      });
  }, [
    store.productivityData,
    store.csatScData,
    store.slaData,
    store.scheduleData,
    store.qaData,
  ]);

  const totalInvalidDates = dateChecks.reduce((sum, check) => sum + check.invalid, 0);
  const productivityDuplicateHealth = React.useMemo(
    () => getProductivityDuplicateHealth((store.productivityData || []) as any[][]),
    [store.productivityData],
  );
  const criticalCoverageIssues = coverageItems.filter((item) => (
    item.dataKey === 'productivityData' || item.dataKey === 'scheduleData'
  ) && item.missingIds.length > 0);
  const issueItems = [
    {
      title: 'Orphan CS ID',
      count: totalOrphanIds,
      tone: totalOrphanIds > 0 ? 'warning' : 'success',
      detail: totalOrphanIds > 0
        ? 'Ada CS ID di data KPI yang belum terdaftar di Master CSID.'
        : 'Tidak ada CS ID asing di data KPI.',
    },
    {
      title: 'Master profile incomplete',
      count: masterProfileIssues.length,
      tone: masterProfileIssues.length > 0 ? 'warning' : 'success',
      detail: masterProfileIssues.length > 0
        ? `${masterProfileIssues.slice(0, 3).map(issue => `${issue.csId} (${issue.missing.join(', ')})`).join(', ')}${masterProfileIssues.length > 3 ? ` +${masterProfileIssues.length - 3} more` : ''}`
        : 'Semua agent di Master CSID punya nama, BPO, dan TL.',
    },
    {
      title: 'Critical source coverage',
      count: criticalCoverageIssues.reduce((sum, item) => sum + item.missingIds.length, 0),
      tone: criticalCoverageIssues.length > 0 ? 'warning' : 'success',
      detail: criticalCoverageIssues.length > 0
        ? criticalCoverageIssues.map(item => `${item.label}: ${item.missingIds.length} agent belum muncul`).join(' | ')
        : 'Productivity dan Schedule sudah mencakup semua agent master.',
    },
    {
      title: 'Invalid date values',
      count: totalInvalidDates,
      tone: totalInvalidDates > 0 ? 'warning' : 'success',
      detail: totalInvalidDates > 0
        ? 'Ada tanggal yang tidak bisa dibaca, filter tanggal bisa tidak akurat.'
        : 'Format tanggal terbaca normal.',
    },
    {
      title: 'Productivity duplicate suspect',
      count: productivityDuplicateHealth.duplicateRows,
      tone: productivityDuplicateHealth.duplicateRows > 0 ? 'warning' : 'success',
      detail: productivityDuplicateHealth.duplicateRows > 0
        ? `${productivityDuplicateHealth.duplicateGroups} group suspect duplicate. Review data pusat sebelum dedupe otomatis.`
        : 'Tidak ada exact duplicate suspect di Productivity.',
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Data Health</h2>
          <p className="text-[11px] text-text-muted mt-1">
            Status input data bulan aktif sebelum KPI diproses.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 text-[11px] font-bold">
          <span className="px-2 py-1 rounded-lg bg-success/5 text-success border border-success/20">OK {summary.ok}</span>
          <span className="px-2 py-1 rounded-lg bg-warning/5 text-warning border border-warning/20">Warning {summary.warning}</span>
          <span className="px-2 py-1 rounded-lg bg-danger/5 text-danger border border-danger/20">Error {summary.error}</span>
          <span className="px-2 py-1 rounded-lg bg-surface text-text-muted border border-border">Missing {summary.missing}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-border bg-surface/30">
        <div>
          <div className="text-[11px] tracking-wide text-text-muted font-medium">Total baris</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{summary.rows}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Bulan aktif saja</div>
        </div>
        <div>
          <div className="text-[11px] tracking-wide text-text-muted font-medium">Agent dikenal</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{agentCount}</div>
        </div>
        <div>
          <div className="text-[11px] tracking-wide text-text-muted font-medium">Mode</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{isSheetMode ? 'Google Sheets' : 'CSV Upload'}</div>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold text-text-primary">Data Completeness</h3>
            <p className="text-[10px] text-text-muted mt-1">
              Coverage agent per source dibandingkan Master CSID.
            </p>
          </div>
          <span className="text-[10px] font-bold text-text-muted tracking-wide">
            Target utama: Productivity + Schedule 100%
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {coverageItems.map((item) => (
            <div key={item.dataKey} className="rounded-lg border border-border bg-surface/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-text-primary truncate">{item.label}</div>
                  <div className="text-[10px] text-text-muted mt-1">
                    {item.matchedIds.length}/{agentCount} master agents
                  </div>
                </div>
                <span className={cn(
                  'shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold',
                  item.status === 'ok'
                    ? 'bg-success/5 border-success/20 text-success'
                    : item.status === 'partial'
                      ? 'bg-warning/5 border-warning/20 text-warning'
                      : 'bg-surface border-border text-text-muted'
                )}>
                  {item.coverage}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/60">
                <div
                  className={cn(
                    'h-full rounded-full',
                    item.status === 'ok' ? 'bg-success' : item.status === 'partial' ? 'bg-warning' : 'bg-text-muted'
                  )}
                  style={{ width: `${Math.min(item.coverage, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>{item.totalIds} unique IDs</span>
                <span>{item.missingIds.length} missing</span>
              </div>
              {item.missingIds.length > 0 && (
                <div className="mt-2 truncate text-[10px] text-warning" title={item.missingIds.join(', ')}>
                  Missing: {item.missingIds.slice(0, 3).join(', ')}{item.missingIds.length > 3 ? ` +${item.missingIds.length - 3} more` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border bg-surface/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold text-text-primary">Agent Issue Detector</h3>
            <p className="text-[10px] text-text-muted mt-1">
              Deteksi cepat masalah data agent yang bisa memengaruhi KPI.
            </p>
          </div>
          <span className={cn(
            'rounded-lg border px-2 py-1 text-[10px] font-bold',
            issueItems.some(item => item.count > 0)
              ? 'bg-warning/5 border-warning/20 text-warning'
              : 'bg-success/5 border-success/20 text-success'
          )}>
            {issueItems.reduce((sum, item) => sum + item.count, 0)} issues
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {issueItems.map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-text-primary">{item.title}</div>
                <span className={cn(
                  'rounded-lg border px-2 py-1 text-[10px] font-semibold',
                  item.tone === 'success'
                    ? 'bg-success/5 border-success/20 text-success'
                    : 'bg-warning/5 border-warning/20 text-warning'
                )}>
                  {item.count}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold text-text-primary">Duplicate Watch</h3>
            <p className="text-[10px] text-text-muted mt-1">
              Audit suspect duplicate tanpa mengubah hasil KPI.
            </p>
          </div>
          <span className={cn(
            'rounded-lg border px-2 py-1 text-[10px] font-bold',
            productivityDuplicateHealth.duplicateRows > 0
              ? 'bg-warning/5 border-warning/20 text-warning'
              : 'bg-success/5 border-success/20 text-success'
          )}>
            Productivity {productivityDuplicateHealth.duplicateRows} rows
          </span>
        </div>
        <div className="rounded-lg border border-border bg-surface/20 p-3">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-text-primary">Productivity / CSAT Official / WHU</div>
              <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
                Detector memakai exact key dari CS ID, tanggal, productivity, CSAT distribution, CSAT official, dan WHU. Ini hanya warning karena row productivity bisa punya pola agregasi khusus.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="font-semibold text-text-primary">{productivityDuplicateHealth.duplicateGroups}</div>
                <div className="text-text-muted">groups</div>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="font-semibold text-text-primary">{productivityDuplicateHealth.duplicateRows}</div>
                <div className="text-text-muted">extra rows</div>
              </div>
            </div>
          </div>
          {productivityDuplicateHealth.samples.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {productivityDuplicateHealth.samples.map((sample, index) => (
                <div key={`${sample.label}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-[10px]">
                  <span className="min-w-0 truncate text-warning" title={sample.label}>{sample.label}</span>
                  <span className="shrink-0 font-bold text-warning">x{sample.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[10px] font-semibold text-success">
              Tidak ada suspect duplicate productivity saat ini.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
        {healthItems.map((item) => {
          const style = getHealthStyles(item.status);
          return (
            <div key={item.fileKey} className="border border-border rounded-lg p-3 bg-surface/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{item.label}</div>
                  <div className="text-[10px] text-text-muted mt-1">
                    {item.rows > 0 ? `${item.rows} rows detected bulan aktif` : 'No data detected'}
                  </div>
                  {item.fileName && (
                    <div className="text-[10px] text-text-muted mt-1 truncate" title={item.fileName}>
                      {item.fileName}
                    </div>
                  )}
                </div>
                <div className={cn('shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold', style.className)}>
                  {style.icon}
                  {style.label}
                </div>
              </div>
              {item.message && (
                <div className="mt-3 text-[10px] leading-relaxed text-text-secondary bg-card border border-border rounded-lg p-2">
                  {item.errorType && <span className="font-bold">{item.errorType}: </span>}
                  {item.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 border-t border-border bg-surface/20">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-bold text-text-primary">Orphan CS ID</h3>
              <p className="text-[10px] text-text-muted mt-1">CS ID muncul di data KPI tapi tidak ada di Master CSID.</p>
            </div>
            <span className={cn(
              'px-2 py-1 rounded-lg border text-[10px] font-bold',
              totalOrphanIds > 0 ? 'bg-warning/5 border-warning/20 text-warning' : 'bg-success/5 border-success/20 text-success'
            )}>
              {totalOrphanIds} orphan
            </span>
          </div>
          <div className="space-y-2">
            {orphanChecks.map((check) => (
              <div key={check.label} className="flex items-start justify-between gap-3 text-[11px] border-b border-border/60 last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary">{check.label}</div>
                  <div className="text-text-muted mt-0.5">{check.totalIds} unique CS ID found</div>
                  {check.orphanIds.length > 0 && (
                    <div className="text-warning mt-1 truncate" title={check.orphanIds.join(', ')}>
                      {check.orphanIds.slice(0, 5).join(', ')}{check.orphanIds.length > 5 ? ` +${check.orphanIds.length - 5} more` : ''}
                    </div>
                  )}
                </div>
                <span className={cn('shrink-0 font-bold', check.orphanIds.length ? 'text-warning' : 'text-success')}>
                  {check.orphanIds.length}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-bold text-text-primary">Date Parse Health</h3>
              <p className="text-[10px] text-text-muted mt-1">Tanggal yang tidak bisa dibaca tidak akan terfilter dengan akurat.</p>
            </div>
            <span className={cn(
              'px-2 py-1 rounded-lg border text-[10px] font-bold',
              totalInvalidDates > 0 ? 'bg-warning/5 border-warning/20 text-warning' : 'bg-success/5 border-success/20 text-success'
            )}>
              {totalInvalidDates} invalid
            </span>
          </div>
          <div className="space-y-2">
            {dateChecks.map((check) => (
              <div key={check.sourceLabel} className="flex items-start justify-between gap-3 text-[11px] border-b border-border/60 last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary">{check.sourceLabel}</div>
                  <div className="text-text-muted mt-0.5">{check.ruleLabel}</div>
                  <div className="text-text-muted mt-0.5">{check.checked} date values checked</div>
                  {check.samples.length > 0 && (
                    <div className="text-warning mt-1 truncate" title={check.samples.join(', ')}>
                      Sample: {check.samples.join(', ')}
                    </div>
                  )}
                </div>
                <span className={cn('shrink-0 font-bold', check.invalid ? 'text-warning' : 'text-success')}>
                  {check.invalid}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const UploadCard = ({ title, fileKey }: { title: string, fileKey: keyof AppState }) => {
  const store = useStore(useShallow((s) => ({
    [fileKey]: (s as any)[fileKey],
    setFile: s.setFile,
    persistedKeys: s.persistedKeys,
    fileValidations: s.fileValidations,
    isPersisting: s.isPersisting,
    fileNames: s.fileNames,
  }))) as any;
  const file = store[fileKey] as File | null;
  const setFile = store.setFile;
  const persistedKeys = store.persistedKeys || [];
  const fileValidations = store.fileValidations || {};
  const validation = fileValidations[fileKey];
  
  const isPersisted = persistedKeys.includes(fileKey as string);
  const isPersisting = store.isPersisting;
  const fileName = store.fileNames?.[fileKey] || (file ? file.name : null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    Papa.parse(selectedFile, {
      complete: (results) => {
        const validator = validators[fileKey];
        const valResult = validator ? validator(results.data as any[][]) : { isValid: true, severity: 'ok' };
        if (valResult && valResult.severity !== 'ok') {
           console.warn(`Validation warning for ${fileKey}:`, valResult);
        }
        setFile(fileKey, selectedFile, results.data as string[][], valResult);
      },
      error: (error) => {
        console.error('Error parsing CSV: ' + error.message);
        setFile(fileKey, selectedFile, [], { 
          isValid: false, 
          errorType: 'PARSE_ERROR', 
          message: 'Error membaca file: ' + error.message,
          severity: 'error'
        });
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden group">
      {/* Saved Indicator */}
      {isPersisted && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold text-success  px-1.5 py-0.5 rounded tracking-wide backdrop-blur-sm mt-0.5">
           <DatabaseBackup className="w-3 h-3" />
           Saved
        </div>
      )}
      
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
        file ? "text-success" : "bg-primary-soft text-primary group-hover:bg-primary-soft-hover"
      )}>
        {file ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
      </div>
      <h3 className="text-13px font-bold text-text-primary mb-1">{title}</h3>
      <p className="text-[11px] text-text-muted mb-4 h-8 flex flex-col items-center justify-center" title={fileName || ''}>
        {fileName ? (
          <span className="line-clamp-2">{fileName}</span>
        ) : (
          'Pilih file CSV yang sesuai.'
        )}
      </p>
      
      {/* Validation Badge */}
      {validation && validation.severity !== 'ok' && (
        <div className={cn(
          "mb-3 px-2 py-1 rounded text-left flex items-start gap-1.5 w-full",
          validation.severity === 'warning' ? "text-warning" : "text-danger"
        )}>
          <div className="mt-0.5 shrink-0">
            {validation.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
          <div className="text-[10px] leading-tight">
            <strong>{validation.errorType}:</strong> {validation.message}
          </div>
        </div>
      )}
      
      <label className={cn(
        "relative cursor-pointer border text-text-primary px-3 py-1.5 rounded-lg w-full font-bold text-[11px] transition-colors flex justify-center",
        file ? "bg-surface border-border hover:bg-border/50" : "bg-card border-border hover:bg-surface hover:text-primary"
      )}>
        <input type="file" accept=".csv" className="sr-only" onChange={handleUpload} />
        <span className="flex items-center gap-2">
          {isPersisting && file ? (
             <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
             <DownloadCloud className="w-3.5 h-3.5" />
          )}
          {file ? 'Replace File' : 'Browse File'}
        </span>
      </label>
    </div>
  );
};

export const FileCenter = () => {
  const {
    clearFiles,
    fetchFromSheets,
    isFetchingSheets,
    sheetsFetchError,
    lastSyncTime,
    selectedSheetMonth,
    setSelectedSheetMonth,
  } = useStore(useShallow((s) => ({
    clearFiles: s.clearFiles,
    fetchFromSheets: s.fetchFromSheets,
    isFetchingSheets: s.isFetchingSheets,
    sheetsFetchError: s.sheetsFetchError,
    lastSyncTime: s.lastSyncTime,
    selectedSheetMonth: s.selectedSheetMonth,
    setSelectedSheetMonth: s.setSelectedSheetMonth,
  })));

  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleClear = () => {
    if (isConfirming) {
       clearFiles();
       setIsConfirming(false);
    } else {
       setIsConfirming(true);
       setTimeout(() => setIsConfirming(false), 3000);
    }
  };

  const isSheetMode = !!import.meta.env.VITE_SHEETS_API_KEY;
  const activeMonth = getSheetMonthOption(selectedSheetMonth);
  const activeSheetConfig = getSheetConfigForMonth(selectedSheetMonth);
  const sheetMonthOptions = getSheetMonthOptions();
  const failedSheetName = sheetsFetchError?.match(/"([^"]+)"/)?.[1] || null;
  const hasSuccessfulSync = !!lastSyncTime && !sheetsFetchError;
  const syncStatusText = isFetchingSheets
    ? 'Menyinkronkan data...'
    : hasSuccessfulSync
      ? ''
      : `Sheet belum aktif: ${activeMonth.label}`;
  const syncIsStale = isStaleSync(lastSyncTime);

  const sheetNames = [
    { label: 'Master CSID', tabName: activeSheetConfig.csidSheetName },
    { label: 'Productivity, CSAT, WHU', tabName: activeSheetConfig.productivitySheetName },
    { label: 'CSAT SC Raw Data', tabName: activeSheetConfig.csatScSheetName },
    { label: 'SLA Responses', tabName: activeSheetConfig.slaSheetName },
    { label: 'Agent Scheduling', tabName: activeSheetConfig.scheduleSheetName },
    { label: 'QA Score', tabName: activeSheetConfig.qaSheetName },
  ];

  if (isSheetMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Data Integration Center
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Data otomatis diambil dari Google Sheets
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <span className="whitespace-nowrap">Data Bulan</span>
              <select
                value={selectedSheetMonth}
                onChange={(event) => setSelectedSheetMonth(event.target.value)}
                disabled={isFetchingSheets}
                className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-text-primary outline-none transition-colors hover:border-primary/40 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sheetMonthOptions.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button 
              onClick={handleClear}
              className="px-3 py-1.5 border-danger/20 border text-danger text-xs hover:bg-danger-soft transition-colors rounded-lg font-bold"
            >
               {isConfirming ? 'Click Again to Confirm Reset' : 'Reset Data'}
            </button>
            <button 
              onClick={fetchFromSheets} 
              disabled={isFetchingSheets}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors
                ${isFetchingSheets ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingSheets ? 'animate-spin' : ''}`} />
              {isFetchingSheets ? 'Menyinkronkan...' : 'Sync sekarang'}
            </button>
          </div>
        </div>
        
        {/* Error state */}
        {sheetsFetchError && (
          <div className="bg-danger-soft border border-danger/50 rounded-xl p-4 text-danger text-sm flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p>{sheetsFetchError}</p>
              <p className="text-xs mt-1 text-danger/80">
                Data yang sedang tampil tidak dihapus. Setelah tab dibuat, klik Sync sekarang lagi.
              </p>
            </div>
          </div>
        )}

        <div className={cn(
          "rounded-xl p-4 text-sm border",
          hasSuccessfulSync
            ? syncIsStale
              ? "bg-warning/10 border-warning/30"
              : "bg-success/10 border-success/30"
            : "bg-warning/10 border-warning/30"
        )}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className={cn(
                "font-medium",
                isFetchingSheets ? "text-primary" : syncIsStale ? "text-warning" : "text-text-primary"
              )}>
                {syncStatusText || (syncIsStale ? 'Data perlu di-refresh' : 'Data tersinkron')}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {isFetchingSheets
                  ? 'Mohon tunggu, dashboard sedang membaca tab Google Sheets.'
                  : hasSuccessfulSync
                    ? syncIsStale
                      ? `Data terakhir sync ${formatRelativeTime(lastSyncTime)}, klik Sync sekarang untuk update.`
                      : `Sinkron ${formatRelativeTime(lastSyncTime)}. ${activeMonth.description}`
                    : 'Dashboard akan otomatis sync saat dibuka. Klik Sync sekarang jika ingin memaksa update manual.'}
              </p>
            </div>
            <span className={cn(
              "text-[11px] font-medium tracking-wide px-2 py-1 rounded-lg border",
              hasSuccessfulSync
                ? syncIsStale
                  ? "text-warning border-warning/30 bg-warning/10"
                  : "text-success border-success/30 bg-success/10"
                : "text-warning border-warning/30 bg-warning/10"
            )}>
              {isFetchingSheets ? 'Menyinkronkan' : hasSuccessfulSync ? syncIsStale ? 'Perlu refresh' : 'Synced' : 'Belum sync'}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Monthly Sheet Setup</h3>
                <p className="text-xs text-text-muted mt-1">
                  {activeMonth.suffix
                    ? 'Buat tab berikut sebelum sync bulan baru. Sync memuat bulan aktif + 3 bulan sebelumnya (cukup untuk Bandingkan MoM & Insentif).'
                    : 'Mei 2026 masih memakai nama tab dari env Vercel, jadi tidak perlu rename tab.'}
                </p>
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-wide px-2 py-1 rounded-lg border",
                hasSuccessfulSync
                  ? "text-success border-success/30 bg-success/10"
                  : activeMonth.suffix
                    ? "text-warning border-warning/30 bg-warning/10"
                    : "text-success border-success/30 bg-success/10"
              )}>
                {hasSuccessfulSync ? 'Synced' : activeMonth.suffix ? 'Setup needed' : 'Ready'}
              </span>
            </div>

            {activeMonth.suffix ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {sheetNames.map(sheet => (
                    <div
                      key={sheet.tabName}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs",
                        failedSheetName === sheet.tabName
                          ? "border-danger/40 bg-danger-soft text-danger"
                          : "border-border bg-surface/40 text-text-secondary"
                      )}
                    >
                      <span className="font-medium truncate">{sheet.label}</span>
                      <span className="font-bold text-text-primary truncate max-w-[180px]" title={sheet.tabName}>
                        {sheet.tabName}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-text-muted">
                  <div className="rounded-lg bg-surface/50 border border-border px-3 py-2">1. Copy tab bulan sebelumnya.</div>
                  <div className="rounded-lg bg-surface/50 border border-border px-3 py-2">2. Rename sesuai nama tab di atas.</div>
                  <div className="rounded-lg bg-surface/50 border border-border px-3 py-2">3. Kosongkan data lama, header jangan diubah.</div>
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-surface/50 border border-border px-3 py-2 text-xs text-text-muted">
                Dashboard akan membaca tab env default yang sudah tersimpan di Vercel.
              </div>
            )}
          </div>
        </div>
        
        {/* Loading state */}
        {isFetchingSheets && (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted bg-card/50 rounded-xl border border-border mt-4">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary"/>
            <p className="font-medium text-text-primary">Menyinkronkan data dari Google Sheets...</p>
            <p className="text-xs mt-1">Mohon tunggu sebentar</p>
          </div>
        )}

        <DataHealthPanel isSheetMode={isSheetMode} />

        {!isFetchingSheets && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheetNames.map((sheet, idx) => {
              const isFailed = failedSheetName === sheet.tabName;
              const isSynced = !!lastSyncTime && !isFailed && !sheetsFetchError;
              return (
                <div
                  key={idx}
                  className={cn(
                    "bg-card border rounded-xl p-5 flex flex-col relative overflow-hidden group transition-colors shadow-sm",
                    isFailed
                      ? "border-danger/50 hover:border-danger/70"
                      : isSynced
                        ? "border-success/40 hover:border-success/60"
                        : "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded flex items-center justify-center shrink-0",
                        isFailed ? "bg-danger-soft" : isSynced ? "bg-success/10" : "bg-surface-muted"
                      )}
                    >
                      {isFailed ? (
                        <AlertCircle size={18} className="text-danger" />
                      ) : isSynced ? (
                        <CheckCircle2 size={18} className="text-success"/>
                      ) : (
                        <FileText size={18} className="text-text-muted"/>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary text-sm">{sheet.label}</h3>
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-auto border-t border-border/50 pt-3">
                    <p className="text-[11px] text-text-muted flex justify-between">
                      <span>Google Sheet Tab:</span>
                      <span className="font-medium text-text-primary">"{sheet.tabName}"</span>
                    </p>
                    <p className="text-[11px] text-text-muted flex justify-between">
                      <span>Status:</span>
                      <span className={cn("font-medium", isFailed ? "text-danger" : isSynced ? "text-success" : "text-text-muted")}>
                        {isFailed
                          ? 'Tab belum ditemukan'
                          : isSynced ? `Tersinkron ${formatRelativeTime(lastSyncTime)}` : 'Belum di-sync'}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Data Integration Center</h1>
          <p className="text-xs text-text-muted mt-1">Upload CSV files across modules to power the 360-degree dashboard.</p>
        </div>
        <button 
          onClick={handleClear}
          className="text-danger font-bold text-[11px] px-3 py-1.5 bg-danger-soft hover:bg-danger-soft/80 border border-danger/20 rounded-lg transition-colors flex items-center gap-1.5 relative z-20 cursor-pointer pointer-events-auto"
        >
          {isConfirming ? 'Click Again to Confirm' : 'Reset All Data'}
        </button>
      </div>

      <DataHealthPanel isSheetMode={isSheetMode} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <UploadCard title="Master CSID" fileKey="csidFile" />
        <UploadCard title="Productivity, CSAT, WHU" fileKey="productivityFile" />
        <UploadCard title="CSAT SC Raw Data" fileKey="csatScFile" />
        <UploadCard title="SLA Responses" fileKey="slaFile" />
        <UploadCard title="Agent Scheduling" fileKey="scheduleFile" />
        <UploadCard title="QA Score" fileKey="qaFile" />
      </div>
    </div>
  );
};
