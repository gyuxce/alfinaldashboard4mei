import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import { getPreviousMonthPeriod, getPreviousPeriod } from './lib/dataProcessor';
import { formatRelativeTime, isStaleSync, countDataRows, extractCsIds, getProductivityDuplicateCount } from './lib/dataQuality';
import { useFilteredKpis } from './hooks/useFilteredKpis';
import { formatLocalDate, getCurrentMonthValue, getMonthValue, getMonthRange, getCurrentMonthRange } from './lib/dates';
import { getSheetMonthKeyFromDate } from './lib/sheetsApi';

import { 
  LayoutDashboard, 
  Activity, 
  Star, 
  Clock, 
  UserCircle, 
  FolderDown,
  CheckCircle,
  Menu,
  X,
  Trophy,
  RefreshCw,
  Calendar,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Calculator,
  Check,
  AlertTriangle
} from 'lucide-react';

import { cn } from './lib/utils';

import { SearchableSelect } from './components/ui/SearchableSelect';
import { TabSkeleton } from './components/ui/TabSkeleton';
import { BootLoadingPanel } from './components/ui/BootLoadingPanel';
import { TabErrorBoundary } from './components/ui/TabErrorBoundary';
import { useProcessedKpis } from './hooks/useProcessedKpis';

const FileCenter = React.lazy(() => import('./components/dashboard/FileCenter').then(module => ({ default: module.FileCenter })));
const DashboardSummary = React.lazy(() => import('./components/dashboard/DashboardSummary').then(module => ({ default: module.DashboardSummary })));
const ProductivityDetail = React.lazy(() => import('./components/dashboard/ProductivityDetail').then(module => ({ default: module.ProductivityDetail })));
const CsatOfficialMonitor = React.lazy(() => import('./components/csat/CsatOfficialMonitor').then(module => ({ default: module.CsatOfficialMonitor })));
const CsatRoom = React.lazy(() => import('./components/csat/CsatRoom').then(module => ({ default: module.CsatRoom })));
const CsatRcaMonitor = React.lazy(() => import('./components/csat/CsatRcaMonitor').then(module => ({ default: module.CsatRcaMonitor })));
const SlaWhuMonitor = React.lazy(() => import('./components/sla/SlaWhuMonitor').then(module => ({ default: module.SlaWhuMonitor })));
const WhuMonitor = React.lazy(() => import('./components/sla/WhuMonitor').then(module => ({ default: module.WhuMonitor })));
const QaAgent360 = React.lazy(() => import('./components/qa/QaAgent360').then(module => ({ default: module.QaAgent360 })));
const Leaderboard = React.lazy(() => import('./components/team/Leaderboard').then(module => ({ default: module.Leaderboard })));
const IncentiveSimulation = React.lazy(() => import('./components/team/IncentiveSimulation').then(module => ({ default: module.IncentiveSimulation })));
const ScheduleBoard = React.lazy(() => import('./components/team/ScheduleBoard').then(module => ({ default: module.ScheduleBoard })));
const AttendanceMonitor = React.lazy(() => import('./components/team/AttendanceMonitor').then(module => ({ default: module.AttendanceMonitor })));

function TabLoading() {
  return <TabSkeleton />;
}

interface ActiveFilterChipProps {
  label: string;
  value: string;
  onClear: () => void;
}

function ActiveFilterChip({ label, value, onClear }: ActiveFilterChipProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
      <span className="shrink-0 text-primary/70">{label}:</span>
      <span className="min-w-0 truncate">{value}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={`Clear ${label} filter`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function formatFilterDate(date: string) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function getMonthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      value,
      label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date),
    };
  });
}

interface MonthPickerProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function MonthPicker({ value, options, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const selectedOption = options.find(option => option.value === value);

  const updateMenuPos = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 192);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setMenuPos({ top: rect.bottom + 4, left, width });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onScrollOrResize = () => updateMenuPos();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div className="relative w-[140px] shrink-0" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-muted focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="truncate">{selectedOption?.label || 'Pilih bulan'}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      </button>

      {isOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label="Pilih bulan"
            className="fixed z-[200] overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <div className="max-h-64 overflow-y-auto p-1">
              {options.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      isSelected ? "bg-primary-soft font-semibold text-primary" : "text-text-primary hover:bg-surface-muted"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const hasAutoFetchedSheetsRef = useRef(false);
  const autoRetryCountRef = useRef(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const {
    csidData, productivityData, csatScData, slaData, scheduleData, qaData,
    startDate, endDate, selectedBpo, selectedTL, selectedGlobalAgent, agentDictionary, agentDictionaryByMonth, selectedSheetMonth,
    setDateRange, setSelectedBpo, setSelectedTL, setSelectedGlobalAgent, setSelectedSheetMonth,
    isHydrating, hydrateFromStorage,
    isFetchingSheets, fetchFromSheets, lastSyncTime, sheetsFetchError, sheetsSyncProgress, activeMonthRowCounts,
    isComparisonEnabled, setIsComparisonEnabled, comparisonMode, setComparisonMode,
    pendingTab, clearPendingTab,
  } = useStore(useShallow((s) => ({
    csidData: s.csidData,
    productivityData: s.productivityData,
    csatScData: s.csatScData,
    slaData: s.slaData,
    scheduleData: s.scheduleData,
    qaData: s.qaData,
    startDate: s.startDate,
    endDate: s.endDate,
    selectedBpo: s.selectedBpo,
    selectedTL: s.selectedTL,
    selectedGlobalAgent: s.selectedGlobalAgent,
    agentDictionary: s.agentDictionary,
    agentDictionaryByMonth: s.agentDictionaryByMonth,
    selectedSheetMonth: s.selectedSheetMonth,
    setDateRange: s.setDateRange,
    setSelectedBpo: s.setSelectedBpo,
    setSelectedTL: s.setSelectedTL,
    setSelectedGlobalAgent: s.setSelectedGlobalAgent,
    setSelectedSheetMonth: s.setSelectedSheetMonth,
    isHydrating: s.isHydrating,
    hydrateFromStorage: s.hydrateFromStorage,
    isFetchingSheets: s.isFetchingSheets,
    fetchFromSheets: s.fetchFromSheets,
    lastSyncTime: s.lastSyncTime,
    sheetsFetchError: s.sheetsFetchError,
    sheetsSyncProgress: s.sheetsSyncProgress,
    activeMonthRowCounts: s.activeMonthRowCounts,
    isComparisonEnabled: s.isComparisonEnabled,
    setIsComparisonEnabled: s.setIsComparisonEnabled,
    comparisonMode: s.comparisonMode,
    setComparisonMode: s.setComparisonMode,
    pendingTab: s.pendingTab,
    clearPendingTab: s.clearPendingTab,
  })));

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!pendingTab) return;
    setActiveTab(pendingTab);
    clearPendingTab();
  }, [pendingTab, clearPendingTab]);

  // Auto-sync on every page load — always fetch fresh data, even if cache
  // exists. Cached data shows immediately while sync runs in background.
  useEffect(() => {
    if (!import.meta.env.VITE_SHEETS_API_KEY) return;
    if (isHydrating || isFetchingSheets) return;
    if (hasAutoFetchedSheetsRef.current) return;

    hasAutoFetchedSheetsRef.current = true;
    autoRetryCountRef.current = 0;
    void fetchFromSheets();
  }, [fetchFromSheets, isFetchingSheets, isHydrating]);

  // Auto-retry on sync failure so loading never gets stuck on an error.
  useEffect(() => {
    if (!sheetsFetchError) return;
    if (autoRetryCountRef.current >= 3) return;

    const retryCount = ++autoRetryCountRef.current;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
    autoRetryTimerRef.current = setTimeout(() => {
      hasAutoFetchedSheetsRef.current = false;
      void fetchFromSheets();
    }, delay);
    return () => {
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    };
  }, [sheetsFetchError, fetchFromSheets]);

  // Reset retry counter when sync succeeds.
  useEffect(() => {
    if (!isFetchingSheets && !sheetsFetchError && lastSyncTime) {
      autoRetryCountRef.current = 0;
    }
  }, [isFetchingSheets, sheetsFetchError, lastSyncTime]);

  const syncStatusText = isFetchingSheets
    ? (sheetsSyncProgress?.message || 'Menyinkronkan data...')
    : sheetsFetchError
      ? 'Sync gagal, mencoba lagi otomatis...'
      : lastSyncTime
        ? ''
        : 'Menunggu sync';
  const syncIsStale = isStaleSync(lastSyncTime);
  const syncDotColor = isFetchingSheets
    ? 'bg-primary animate-pulse'
    : sheetsFetchError
      ? 'bg-danger animate-pulse'
      : syncIsStale
        ? 'bg-warning'
        : lastSyncTime
          ? 'bg-success'
          : 'bg-border';
  const dataQuality = useMemo(() => {
    const sourceRows = [
      { label: 'Master', rows: activeMonthRowCounts?.csidData ?? countDataRows(csidData) },
      { label: 'Productivity', rows: activeMonthRowCounts?.productivityData ?? countDataRows(productivityData) },
      { label: 'CSAT SC', rows: activeMonthRowCounts?.csatScData ?? countDataRows(csatScData) },
      { label: 'SLA', rows: activeMonthRowCounts?.slaData ?? countDataRows(slaData) },
      { label: 'Schedule', rows: activeMonthRowCounts?.scheduleData ?? countDataRows(scheduleData) },
      { label: 'QA', rows: activeMonthRowCounts?.qaData ?? countDataRows(qaData) },
    ];
    const missingSources = sourceRows.filter((source) => source.rows === 0);
    const masterIds = new Set(Object.keys(agentDictionary || {}));
    const productivityIds = extractCsIds(productivityData);
    const scheduleIds = extractCsIds(scheduleData);
    const missingProductivity = Array.from(masterIds).filter((id) => !productivityIds.has(id)).length;
    const missingSchedule = Array.from(masterIds).filter((id) => !scheduleIds.has(id)).length;
    const duplicateProductivityRows = getProductivityDuplicateCount(productivityData);

    let warningCount = 0;
    if (syncIsStale) warningCount += 1;
    if (missingProductivity > 0) warningCount += 1;
    if (missingSchedule > 0) warningCount += 1;
    if (duplicateProductivityRows > 0) warningCount += 1;

    const errorCount = (sheetsFetchError ? 1 : 0) + missingSources.length;
    const detailParts = [
      sheetsFetchError ? 'sync error' : '',
      missingSources.length ? `${missingSources.length} missing source` : '',
      missingProductivity ? `${missingProductivity} missing productivity` : '',
      missingSchedule ? `${missingSchedule} missing schedule` : '',
      duplicateProductivityRows ? `${duplicateProductivityRows} duplicate suspect` : '',
      syncIsStale ? 'stale sync' : '',
    ].filter(Boolean);

    if (errorCount > 0) {
      return {
        status: 'error' as const,
        label: 'Need Review',
        detail: detailParts.join(' | '),
        count: errorCount + warningCount,
      };
    }

    if (warningCount > 0) {
      return {
        status: 'warning' as const,
        label: `${warningCount} Warning${warningCount > 1 ? 's' : ''}`,
        detail: detailParts.join(' | '),
        count: warningCount,
      };
    }

    return {
      status: 'ok' as const,
      label: 'Data OK',
      detail: lastSyncTime ? `Tersinkron ${formatRelativeTime(lastSyncTime)}` : 'Menunggu sync',
      count: 0,
    };
  }, [
    agentDictionary,
    activeMonthRowCounts,
    csidData,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    lastSyncTime,
    sheetsFetchError,
    syncIsStale,
  ]);

  const comparisonTabs = activeTab === 'summary'
    || activeTab === 'productivity'
    || activeTab === 'csat_official'
    || activeTab === 'csat';
  const needsComparisonData = isComparisonEnabled && comparisonTabs;

  const comparisonRanges = useMemo(() => {
    if (!needsComparisonData || !startDate || !endDate) {
      return { prev1: null, prev2: null, prev3: null } as const;
    }
    const getPrevRange = comparisonMode === 'mom' ? getPreviousMonthPeriod : getPreviousPeriod;
    const prev1 = getPrevRange(startDate, endDate);
    const prev2 = getPrevRange(prev1.start, prev1.end);
    const prev3 = getPrevRange(prev2.start, prev2.end);
    return { prev1, prev2, prev3 } as const;
  }, [needsComparisonData, comparisonMode, startDate, endDate]);

  const hasSourceData =
    productivityData.length > 0
    || csatScData.length > 0
    || slaData.length > 0
    || scheduleData.length > 0
    || qaData.length > 0
    || csidData.length > 0;

  // Yield between KPI passes so boot UI does not freeze/"patah".
  const { bundle: kpiRawBundle, isProcessing: isProcessingKpis } = useProcessedKpis({
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    startDate,
    endDate,
    agentDictionary,
    agentDictionaryByMonth,
    needsComparisonData,
    prev1: comparisonRanges.prev1,
    prev2: comparisonRanges.prev2,
    prev3: comparisonRanges.prev3,
    enabled: !isHydrating && hasSourceData,
  });

  const {
    rawData,
    previousRawData,
    previousRawData2,
    previousRawData3,
  } = kpiRawBundle;

  const { kpiData, previousKpiData, previousKpiData2, previousKpiData3, incentiveKpiData, incentivePeriod, tlList, agentList } = useFilteredKpis({
    rawData,
    previousRawData,
    previousRawData2,
    previousRawData3,
    activeTab,
    startDate,
    endDate,
    selectedSheetMonth,
    selectedBpo,
    selectedTL,
    selectedGlobalAgent,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
    agentDictionaryByMonth,
  });



  // Keep persisted/stale scope choices from mixing different BPO rosters.
  useEffect(() => {
    if (
      selectedTL !== 'All TL'
      && selectedTL !== 'All Team Leaders'
      && !tlList.includes(selectedTL)
    ) {
      setSelectedTL('All TL');
    }
  }, [selectedTL, setSelectedTL, tlList]);

  useEffect(() => {
    if (
      selectedGlobalAgent !== 'All Agents'
      && !agentList.includes(selectedGlobalAgent)
    ) {
      setSelectedGlobalAgent('All Agents');
    }
  }, [agentList, selectedGlobalAgent, setSelectedGlobalAgent]);

  const handleBpoChange = (bpo: string) => {
    setSelectedBpo(bpo);
    setSelectedTL('All TL');
    setSelectedGlobalAgent('All Agents');
  };

  const handleTeamLeaderChange = (teamLeader: string) => {
    setSelectedTL(teamLeader);
    setSelectedGlobalAgent('All Agents');
  };

  const showBootLoading =
    isHydrating
    || (isFetchingSheets && !hasSourceData)
    || (isProcessingKpis && rawData.length === 0);

  const bootTitle = isHydrating
    ? 'Mohon menunggu...'
    : isFetchingSheets && !hasSourceData
      ? 'Menyinkronkan data...'
      : 'Menyiapkan KPI...';

  const bootSubtitle = isHydrating
    ? 'Sedang menyiapkan dashboard'
    : isFetchingSheets && !hasSourceData
      ? (sheetsSyncProgress?.message || 'Sedang mengambil data terbaru')
      : 'Menghitung metrik tanpa membekukan layar';

  const bootSteps = isFetchingSheets && !hasSourceData && sheetsSyncProgress?.steps
    ? sheetsSyncProgress.steps
    : undefined;

  const navItems = [
    { id: 'summary', label: 'Dashboard Summary', icon: LayoutDashboard },
    { id: 'productivity', label: 'Productivity Detail', icon: Activity },
    { id: 'qa', label: 'QA Agent 360', icon: UserCircle },
    { id: 'csat_official', label: 'CSAT Official', icon: Star },
    { id: 'csat', label: 'CSAT Room (Survey)', icon: Star },
    { id: 'csat_rca', label: 'CSAT Root Cause', icon: FileText },
    { id: 'sla', label: 'SLA Monitor', icon: CheckCircle },
    { id: 'whu', label: 'WHU Monitor', icon: Clock },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'incentive', label: 'Simulasi Insentif', icon: Calculator },
    { id: 'schedule', label: 'Schedule Board', icon: Calendar },
    { id: 'attendance', label: 'Attendance Monitor', icon: Calendar },
    { id: 'files', label: 'File Center', icon: FolderDown },
  ];

  const activeNavLabel = navItems.find((item) => item.id === activeTab)?.label || 'tab';

  const navigateWeek = (dir: 'prev' | 'next' | 'current') => {
    if (dir === 'current') {
      const d = new Date();
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const t1 = formatLocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      setDateRange(t1, formatLocalDate(end.getFullYear(), end.getMonth() + 1, end.getDate()));
      return;
    }
    if (startDate) {
      const s = new Date(startDate);
      const e = new Date(endDate || startDate);
      const offset = dir === 'next' ? 7 : -7;
      s.setDate(s.getDate() + offset);
      e.setDate(e.getDate() + offset);
      setDateRange(
        formatLocalDate(s.getFullYear(), s.getMonth() + 1, s.getDate()),
        formatLocalDate(e.getFullYear(), e.getMonth() + 1, e.getDate()),
      );
    } else {
      const now = new Date();
      const day = now.getDay() || 7;
      now.setDate(now.getDate() - day + 1);
      const t1 = formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      setDateRange(t1, formatLocalDate(end.getFullYear(), end.getMonth() + 1, end.getDate()));
    }
  };

  const selectedMonthFilter = getMonthValue(startDate);
  const monthOptions = getMonthOptions();
  const defaultDateRange = getCurrentMonthRange();
  const isDefaultDateRange = startDate === defaultDateRange.start && endDate === defaultDateRange.end;
  const hasCustomDateFilter = !!(startDate || endDate) && !isDefaultDateRange;
  const applyMonthFilter = (monthValue: string) => {
    const range = getMonthRange(monthValue);
    setDateRange(range.start, range.end);
    // Keep the roster aligned with the displayed period so TL/BPO
    // follows the month the user is viewing, not just the File Center sync month.
    setSelectedSheetMonth(getSheetMonthKeyFromDate(monthValue));
  };
  const resetPeriodToCurrentMonth = () => {
    setDateRange(defaultDateRange.start, defaultDateRange.end);
  };

  const activeFilters = [
    selectedBpo && selectedBpo !== 'All BPO'
      ? { label: 'BPO', value: selectedBpo, onClear: () => handleBpoChange('All BPO') }
      : null,
    selectedTL && selectedTL !== 'All TL' && selectedTL !== 'All Team Leaders'
      ? { label: 'TL', value: selectedTL, onClear: () => handleTeamLeaderChange('All TL') }
      : null,
    selectedGlobalAgent && selectedGlobalAgent !== 'All Agents'
      ? { label: 'Agent', value: selectedGlobalAgent, onClear: () => setSelectedGlobalAgent('All Agents') }
      : null,
    hasCustomDateFilter
      ? {
          label: 'Date',
          value: `${startDate ? formatFilterDate(startDate) : 'awal'} to ${endDate ? formatFilterDate(endDate) : 'akhir'}`,
          onClear: resetPeriodToCurrentMonth,
        }
      : null,
  ].filter((filter): filter is ActiveFilterChipProps => filter !== null);

  const clearAllFilters = () => {
    setSelectedBpo('All BPO');
    setSelectedTL('All TL');
    setSelectedGlobalAgent('All Agents');
    resetPeriodToCurrentMonth();
  };

  const comparisonHint = (() => {
    if (!isComparisonEnabled || !startDate) return null;
    const end = endDate || startDate;
    const getPrevRange = comparisonMode === 'mom' ? getPreviousMonthPeriod : getPreviousPeriod;
    const prev = getPrevRange(startDate, end);
    if (!prev.start || !prev.end) return null;
    const currentLabel = `${formatFilterDate(startDate)} – ${formatFilterDate(end)}`;
    const prevLabel = `${formatFilterDate(prev.start)} – ${formatFilterDate(prev.end)}`;
    return comparisonMode === 'mom'
      ? `MoM: ${currentLabel} vs ${prevLabel}`
      : `WoW: ${currentLabel} vs ${prevLabel}`;
  })();

  return (
    <div className="flex h-[100dvh] w-full bg-background font-sans text-text-primary overflow-hidden relative transition-colors duration-300">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar-bg text-sidebar-text border-b border-sidebar-border absolute top-0 left-0 w-full z-40 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-semibold shrink-0 text-sm">LC</div>
          <span className="font-semibold text-sidebar-text-hover tracking-tight text-sm">LIVE DASHBOARD</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg hover:bg-sidebar-bg-hover transition-colors relative w-10 h-10 flex items-center justify-center overflow-hidden"
          aria-label="Toggle menu"
        >
          <Menu className={cn("w-6 h-6 absolute transition-all duration-300 ease-out", isSidebarOpen ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0")} />
          <X className={cn("w-6 h-6 absolute transition-all duration-300 ease-out", isSidebarOpen ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 -rotate-90")} />
        </button>
      </div>

      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300 ease-out",
          isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
        aria-modal={isSidebarOpen ? "true" : undefined}
      />

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative top-0 left-0 h-full bg-sidebar-bg text-sidebar-text flex flex-col border-r border-sidebar-border z-[70] transition-all duration-300 ease-out will-change-transform shrink-0 group/sidebar",
        isSidebarOpen ? "translate-x-0 w-60" : "-translate-x-full md:translate-x-0",
        isSidebarMinimized ? "md:w-[72px] w-60" : "w-60"
      )}>
        {/* Toggle Button for Desktop */}
        <button
          onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-card border border-border rounded-r-md items-center justify-center text-text-muted hover:text-text-primary z-50 cursor-pointer"
          title={isSidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
        >
          {isSidebarMinimized ? <ChevronRight className="w-4 h-4 ml-0.5" /> : <ChevronLeft className="w-4 h-4 ml-0.5" />}
        </button>

        <div className={cn("p-4 border-b border-sidebar-border overflow-hidden", isSidebarMinimized ? "md:px-4" : "")}>
        <div className={cn("flex items-center gap-3 relative z-10 group cursor-default", isSidebarMinimized ? "md:justify-center" : "")}>
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-semibold shrink-0 text-sm">LC</div>
          <span className={cn("font-semibold tracking-tight text-sidebar-text-hover text-sm transition-all duration-300 whitespace-nowrap", isSidebarMinimized ? "md:opacity-0 md:w-0" : "opacity-100")}>LIVE DASHBOARD</span>
        </div>
      </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto no-scrollbar">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={cn(
                  "group relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 ease-out overflow-hidden cursor-pointer",
                  isActive 
                    ? "bg-sidebar-bg-active text-sidebar-text-active" 
                    : "text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover",
                  isSidebarMinimized ? "md:justify-center md:px-0" : ""
                )}
                title={isSidebarMinimized ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-sidebar-accent rounded-full" />
                )}
                <Icon className={cn(
                  "w-4 h-4 transition-colors duration-150 ease-out shrink-0", 
                  isActive ? "text-sidebar-accent" : "text-sidebar-text group-hover:text-sidebar-text-hover"
                )} />
                <span className={cn("relative z-10 transition-all duration-300 whitespace-nowrap", isSidebarMinimized ? "md:opacity-0 md:w-0" : "opacity-100")}>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className={cn("py-3 text-[10px] text-text-muted border-t border-sidebar-border flex items-center transition-colors duration-300 overflow-hidden", isSidebarMinimized ? "md:flex-col md:px-2 md:gap-3 md:justify-center" : "justify-between px-4")}>
          <span className={cn("flex items-center text-sidebar-text transition-all duration-300 whitespace-nowrap", isSidebarMinimized ? "md:opacity-0 md:w-0 md:hidden" : "opacity-100")}>
            Status
            <span className="flex items-center text-success font-medium ml-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5"></span>
              Live
            </span>
          </span>
          <span className={cn("items-center justify-center text-success hidden", isSidebarMinimized ? "md:flex" : "")}>
             <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
          </span>
          <div className={cn("flex items-center", isSidebarMinimized ? "md:flex-col md:gap-3" : "gap-2")}>
            <button
               onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
               className="p-1.5 rounded-md hover:bg-sidebar-bg-hover text-sidebar-text transition-colors cursor-pointer shrink-0"
               aria-label="Toggle Theme"
             >
               {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-3 pt-20 md:p-6 gap-6 overflow-y-auto overflow-x-hidden w-full relative">
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-col relative z-50 overflow-visible">
          {/* Mobile Filter Toggle */}
          <div className="flex md:hidden items-center justify-between w-full mb-2">
            <span className="text-[11px] font-medium text-text-muted tracking-wide pl-1">Filter</span>
            <button
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-surface border border-border hover:bg-surface-muted transition-colors cursor-pointer"
            >
              {isMobileFilterOpen ? (
                <>Sembunyikan <ChevronUp size={14} /></>
              ) : (
                <>Tampilkan filter <ChevronDown size={14} /></>
              )}
            </button>
          </div>

          {/* Filter Content — 1 baris compact di desktop agar stabil saat zoom */}
          <div className={cn(
            "flex-col gap-2",
            isMobileFilterOpen ? "flex" : "hidden md:flex"
          )}>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:overflow-visible">
              {/* Scope */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:border-r md:border-border md:pr-2.5 shrink-0">
                <span className="hidden lg:inline text-[10px] font-medium text-text-muted tracking-wide w-10 shrink-0">Scope</span>
                <div className="w-[100px] shrink-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:text-xs [&_button]:px-2.5">
                  <SearchableSelect 
                    options={['TIN', 'TCID', 'TCID X TIN']}
                    value={selectedBpo}
                    onChange={handleBpoChange}
                    allOptionLabel="All BPO"
                    placeholder="Cari BPO..."
                  />
                </div>
                <div className="w-[120px] shrink-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:text-xs [&_button]:px-2.5">
                  <SearchableSelect 
                    options={tlList}
                    value={selectedTL}
                    onChange={handleTeamLeaderChange}
                    allOptionLabel="All TL"
                    placeholder="Cari TL..."
                  />
                </div>
                <div className="w-[130px] shrink-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:text-xs [&_button]:px-2.5">
                  <SearchableSelect
                    options={agentList}
                    value={selectedGlobalAgent}
                    onChange={setSelectedGlobalAgent}
                    allOptionLabel="All Agents"
                    placeholder="Cari agent..."
                  />
                </div>
              </div>
              
              {/* Period */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:border-r md:border-border md:pr-2.5 shrink-0">
                <span className="hidden lg:inline text-[10px] font-medium text-text-muted tracking-wide w-10 shrink-0">Periode</span>
                <MonthPicker
                  value={selectedMonthFilter || getCurrentMonthValue()}
                  options={monthOptions}
                  onChange={applyMonthFilter}
                />
                <input type="date" className="h-8 w-[128px] shrink-0 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-text-primary transition-colors focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" value={startDate || ''} onChange={e => setDateRange(e.target.value, endDate)} />
                <span className="text-text-muted text-[10px] shrink-0">–</span>
                <input type="date" className="h-8 w-[128px] shrink-0 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-text-primary transition-colors focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" value={endDate || ''} onChange={e => setDateRange(startDate, e.target.value)} />
              </div>
              
              {/* Quick nav */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:border-r md:border-border md:pr-2.5 shrink-0">
                <button onClick={resetPeriodToCurrentMonth} className="h-8 rounded-lg px-2 text-[10px] font-semibold text-text-muted transition-colors hover:bg-primary-soft hover:text-primary whitespace-nowrap">Bulan Ini</button>
                
                <div className="flex h-8 items-center bg-card rounded-lg border border-border p-0.5 gap-0.5">
                  <button 
                    onClick={() => navigateWeek('prev')} 
                    className="text-[10px] hover:bg-surface-muted text-text-secondary px-1.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    &laquo;
                  </button>
                  <button 
                    onClick={() => navigateWeek('current')} 
                    className="text-[10px] bg-primary-soft text-primary px-2 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Minggu Ini
                  </button>
                  <button 
                    onClick={() => navigateWeek('next')} 
                    className="text-[10px] hover:bg-surface-muted text-text-secondary px-1.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    &raquo;
                  </button>
                </div>
              </div>

              {/* Compare */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 shrink-0">
                <span className="hidden lg:inline text-[10px] font-medium text-text-muted tracking-wide shrink-0">Cmp</span>
                <div 
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2 transition-colors hover:bg-surface-muted group cursor-pointer" 
                  onClick={() => setIsComparisonEnabled(!isComparisonEnabled)}
                >
                  <div className={cn("w-7 h-4 rounded-full relative transition-colors duration-200", isComparisonEnabled ? "bg-primary" : "bg-border")}>
                    <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200", isComparisonEnabled ? "translate-x-3" : "translate-x-0")} />
                  </div>
                  <span className="text-[10px] font-medium text-text-secondary group-hover:text-text-primary whitespace-nowrap">Bandingkan</span>
                </div>

                <div className={cn(
                  "flex h-8 items-center rounded-md border p-0.5 gap-0.5 transition-opacity",
                  isComparisonEnabled ? "border-primary/30 bg-primary-soft opacity-100" : "border-border bg-surface opacity-80"
                )}>
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonMode('wow');
                      setIsComparisonEnabled(true);
                    }}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      comparisonMode === 'wow' && isComparisonEnabled ? "bg-primary text-white" : "text-primary hover:bg-primary/10"
                    )}
                    title="WoW membandingkan dengan periode sebelumnya dengan durasi yang sama"
                  >
                    WoW
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonMode('mom');
                      setIsComparisonEnabled(true);
                    }}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      comparisonMode === 'mom' && isComparisonEnabled ? "bg-primary text-white" : "text-primary hover:bg-primary/10"
                    )}
                    title="MoM membandingkan dengan bulan sebelumnya"
                  >
                    MoM
                  </button>
                </div>
              </div>

              {selectedTL && selectedTL !== 'All TL' && selectedTL !== 'All Team Leaders' && (
                <div className="inline-flex h-8 items-center px-2.5 rounded-md bg-primary-soft text-primary-text text-[10px] font-medium border border-primary-soft-hover shrink-0 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5"></span>
                  Tim {selectedTL}
                </div>
              )}
            </div>

            {/* Status strip — selalu satu baris tipis di bawah */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-1.5">
              <div className="flex min-w-0 flex-col gap-0.5 text-[10px] leading-tight">
                {comparisonHint ? (
                  <span className="font-medium text-primary">
                    Bandingkan · {comparisonHint}
                  </span>
                ) : null}
                {import.meta.env.VITE_SHEETS_API_KEY && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', syncDotColor)} />
                      {syncStatusText ? (
                        <span className={cn(
                          "font-medium",
                          isFetchingSheets ? "text-primary" : sheetsFetchError ? "text-danger" : syncIsStale ? "text-warning" : "text-text-secondary"
                        )}>
                          {syncStatusText}
                        </span>
                      ) : null}
                    </span>
                    {lastSyncTime && !isFetchingSheets && !sheetsFetchError && (
                      <span className={cn("text-text-muted", syncIsStale && "text-warning")}>
                        {syncIsStale ? `Data terakhir sync ${formatRelativeTime(lastSyncTime)}, klik Refresh untuk update.` : `Tersinkron ${formatRelativeTime(lastSyncTime)}`}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  title={dataQuality.detail}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors",
                    dataQuality.status === 'ok'
                      ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
                      : dataQuality.status === 'warning'
                        ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15"
                        : "border-danger/30 bg-danger-soft text-danger hover:bg-danger-soft/80"
                  )}
                >
                  {dataQuality.status === 'ok' ? (
                    <CheckCircle size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}
                  <span>{dataQuality.label}</span>
                </button>
                {import.meta.env.VITE_SHEETS_API_KEY && (
                  <button
                    onClick={fetchFromSheets}
                    disabled={isFetchingSheets}
                    className={`flex h-7 items-center gap-1 px-2.5 
                      rounded-lg text-[10px] font-medium transition-colors
                      border border-border shrink-0
                      ${isFetchingSheets 
                        ? 'bg-surface-muted text-text-muted cursor-not-allowed' 
                        : 'bg-card text-text-secondary hover:bg-primary-soft hover:text-primary cursor-pointer'
                      }`}
                  >
                    <RefreshCw 
                      size={11} 
                      className={isFetchingSheets ? 'animate-spin' : ''} 
                    />
                   {isFetchingSheets ? 'Menyinkronkan...' : 'Refresh'}
                 </button>
               )}
              </div>
           </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="text-[10px] font-medium tracking-wide text-text-muted">
                Filter aktif
              </span>
              {activeFilters.map((filter) => (
                <React.Fragment key={filter.label}>
                  <ActiveFilterChip
                    label={filter.label}
                    value={filter.value}
                    onClear={filter.onClear}
                  />
                </React.Fragment>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-text-muted hover:bg-surface-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                Hapus semua
              </button>
            </div>
          )}
        </div>

        <div className="w-full pb-8">
          {showBootLoading ? (
            <BootLoadingPanel
              title={bootTitle}
              subtitle={bootSubtitle}
              steps={bootSteps}
            />
          ) : (
            <div key={activeTab}>
              <TabErrorBoundary label={activeNavLabel}>
                <React.Suspense fallback={<TabLoading />}>
                  {activeTab === 'summary' && <DashboardSummary data={kpiData} previousData={previousKpiData} previousData2={previousKpiData2} previousData3={previousKpiData3} />}
                  {activeTab === 'leaderboard' && <Leaderboard data={kpiData} />}
                  {activeTab === 'incentive' && (
                    <IncentiveSimulation data={incentiveKpiData} period={incentivePeriod} />
                  )}
                  {activeTab === 'productivity' && <ProductivityDetail data={kpiData} previousData={previousKpiData} previousData2={previousKpiData2} previousData3={previousKpiData3} />}
                  {activeTab === 'csat_official' && <CsatOfficialMonitor data={kpiData} previousData={previousKpiData} previousData2={previousKpiData2} previousData3={previousKpiData3} />}
                  {activeTab === 'csat' && <CsatRoom data={kpiData} previousData={previousKpiData} previousData2={previousKpiData2} previousData3={previousKpiData3} />}
                  {activeTab === 'csat_rca' && <CsatRcaMonitor data={kpiData} />}
                  {activeTab === 'sla' && <SlaWhuMonitor data={kpiData} />}
                  {activeTab === 'whu' && <WhuMonitor data={kpiData} />}
                  {activeTab === 'qa' && <QaAgent360 data={kpiData} />}
                  {activeTab === 'schedule' && <ScheduleBoard data={kpiData} />}
                  {activeTab === 'attendance' && <AttendanceMonitor data={kpiData} />}
                  {activeTab === 'files' && <FileCenter />}
                </React.Suspense>
              </TabErrorBoundary>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
