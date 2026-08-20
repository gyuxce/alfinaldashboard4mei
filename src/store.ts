import { create } from 'zustand';
import { saveData, loadData, clearAllData, listKeys } from './lib/storage';
import { countDataRows, ValidationResult } from './lib/csvValidator';
import { fetchAllSheets, getCurrentSheetMonthKey, getSheetMonthHistoryKeys, getSheetConfigForMonth, getSheetMonthOption, getSpreadsheetIdForMonth, mergeAllSheetsData, sheetDataToParseResult } from './lib/sheetsApi';
import { buildAgentDictionary } from './lib/csid';

let sheetsSyncGeneration = 0;
let sheetsAbortController: AbortController | null = null;

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
  );
}

function formatLocalDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: formatLocalDate(year, month, 1),
    end: formatLocalDate(year, month, lastDay),
  };
}

const defaultDateRange = getCurrentMonthRange();

export interface AppState {
  // Data source mode
  dataSource: 'sheets' | 'csv';
  
  // Loading & error state untuk Sheets fetch
  isFetchingSheets: boolean;
  sheetsFetchError: string | null;
  /** Soft progress for boot/sync panel (single-phase loading). */
  sheetsSyncProgress: {
    message: string;
    steps: Array<{ id: string; label: string; state: 'pending' | 'active' | 'done' | 'error' }>;
  } | null;
  lastSyncTime: Date | null;
  selectedSheetMonth: string;
  activeMonthRowCounts: Record<string, number> | null;
  
  // Sheet configuration
  sheetsConfig: {
    spreadsheetId: string;
    apiKey: string;
    sheetNames: {
      csid: string;
      productivity: string;
      csatSc: string;
      sla: string;
      schedule: string;
      qa: string;
    };
  } | null;

  productivityFile: File | null;
  csatScFile: File | null;
  slaFile: File | null;
  scheduleFile: File | null;
  csidFile: File | null;
  qaFile: File | null;
  
  productivityData: any[][];
  csatScData: any[][];
  slaData: any[][];
  scheduleData: any[][];
  csidData: any[][];
  qaData: any[][];
  
  startDate: string;
  endDate: string;
  selectedBpo: string;
  selectedTL: string;
  selectedGlobalAgent: string;
  agentDictionary: Record<string, { name: string; bpo: string; teamLeader: string }>;
  agentDictionaryByMonth: Record<string, Record<string, { name: string; bpo: string; teamLeader: string }>>;
  isComparisonEnabled: boolean;
  comparisonMode: 'wow' | 'mom';

  isHydrating: boolean;
  isPersisting: boolean;
  persistedKeys: string[];
  fileValidations: Record<string, ValidationResult | null>;
  fileNames: Record<string, string>;

  setFile: (key: keyof AppState, file: File | null, data: any[], validation?: ValidationResult | null) => void;
  setDateRange: (start: string, end: string) => void;
  setSelectedBpo: (bpo: string) => void;
  setSelectedTL: (tl: string) => void;
  setSelectedGlobalAgent: (agent: string) => void;
  clearFiles: () => void;
  hydrateFromStorage: () => Promise<void>;
  
  // Sheet actions
  fetchFromSheets: () => Promise<void>;
  setSelectedSheetMonth: (monthKey: string) => void;
  setDataSource: (mode: 'sheets' | 'csv') => void;
  setIsComparisonEnabled: (enabled: boolean) => void;
  setComparisonMode: (mode: 'wow' | 'mom') => void;

  /** Soft navigation request from child views (e.g. EmptyState → File Center) */
  pendingTab: string | null;
  openTab: (tab: string) => void;
  clearPendingTab: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  dataSource: 'csv',
  isFetchingSheets: false,
  sheetsFetchError: null,
  sheetsSyncProgress: null,
  lastSyncTime: null,
  selectedSheetMonth: getCurrentSheetMonthKey(),
  activeMonthRowCounts: null,
  sheetsConfig: null,

  productivityFile: null,
  csatScFile: null,
  slaFile: null,
  scheduleFile: null,
  csidFile: null,
  qaFile: null,

  productivityData: [],
  csatScData: [],
  slaData: [],
  scheduleData: [],
  csidData: [],
  qaData: [],
  
  startDate: defaultDateRange.start,
  endDate: defaultDateRange.end,
  selectedBpo: 'All BPO',
  selectedTL: 'All TL',
  selectedGlobalAgent: 'All Agents',
  agentDictionary: {},
  agentDictionaryByMonth: {},
  isComparisonEnabled: false,
  comparisonMode: 'wow',
  pendingTab: null,
  fileValidations: {},
  fileNames: {},

  isHydrating: true, // Start as true to show loading initially if used
  isPersisting: false,
  persistedKeys: [],

  setFile: (key, file, data, validation = null) => {
    set({ isPersisting: true });
    
    // Process CSID Dictionary if csidData is uploaded
    let dictUpdates = {};
    if (key === 'csidFile') {
      const dict = buildAgentDictionary(data);
      dictUpdates = { agentDictionary: dict, agentDictionaryByMonth: { legacy: dict } };
    }

    const dataKey = key.replace('File', 'Data');
    
    // Update Zustand state synchronously
    set((state) => ({
      [key]: file,
      [dataKey]: data,
      ...dictUpdates,
      fileValidations: { ...state.fileValidations, [key]: validation },
      ...(file && file.name ? { fileNames: { ...state.fileNames, [key]: file.name } } : {})
    }));

    // Persist to IndexedDB asynchronously
    const p1 = saveData(key, data);
    const p2 = validation ? saveData(key + '_validation', validation) : Promise.resolve();
    const p3 = file && file.name ? saveData(key + '_filename', file.name) : Promise.resolve();
    
    Promise.all([p1, p2, p3]).then(() => {
      listKeys().then(keys => {
        set({ persistedKeys: keys, isPersisting: false });
      });
    }).catch(err => {
      console.warn("Failed to persist data in background", err);
      set({ isPersisting: false });
    });
  },

  setDateRange: (start, end) => set(() => ({ startDate: start, endDate: end })),
  setSelectedBpo: (bpo) => set(() => ({ selectedBpo: bpo })),
  setSelectedTL: (tl) => set(() => ({ selectedTL: tl })),
  setSelectedGlobalAgent: (agent) => set(() => ({ selectedGlobalAgent: agent })),
  setIsComparisonEnabled: (enabled) => set(() => ({ isComparisonEnabled: enabled })),
  setComparisonMode: (mode) => set(() => ({ comparisonMode: mode })),
  openTab: (tab) => set(() => ({ pendingTab: tab })),
  clearPendingTab: () => set(() => ({ pendingTab: null })),

  clearFiles: async () => {
    // Clear Zustand
    set(() => ({
      productivityFile: null,
      csatScFile: null,
      slaFile: null,
      scheduleFile: null,
      csidFile: null,
      qaFile: null,
      productivityData: [],
      csatScData: [],
      slaData: [],
      scheduleData: [],
      csidData: [],
      qaData: [],
      agentDictionary: {},
      agentDictionaryByMonth: {},
      fileValidations: {},
      fileNames: {},
      activeMonthRowCounts: null,
      selectedBpo: 'All BPO',
      selectedTL: 'All TL',
      persistedKeys: []
    }));
    
    // Clear IndexedDb
    await clearAllData();
  },

  hydrateFromStorage: async () => {
    set({ isHydrating: true });
    try {
      const keys = await listKeys();
      const filesToLoad = ['productivityFile', 'csatScFile', 'slaFile', 'scheduleFile', 'csidFile', 'qaFile'];
      
      const fileData: Partial<AppState> = { fileValidations: {}, fileNames: {} };
      let hasData = false;

      for (const k of filesToLoad) {
        if (keys.includes(k)) {
          const loadedData = await loadData(k);
          if (loadedData) {
            const dataKey = k.replace('File', 'Data') as keyof AppState;
            
            if (keys.includes(k + '_filename')) {
              const savedName = await loadData(k + '_filename');
              if (savedName && fileData.fileNames) {
                fileData.fileNames[k] = savedName;
              }
            }

            // Generate a dummy file object for UI display
            const dummyFile = new File([], `Persisted Data (${k.replace('File', '')}.csv)`, { type: 'text/csv' });
            
            // @ts-ignore
            fileData[k as keyof AppState] = dummyFile;
            // @ts-ignore
            fileData[dataKey] = loadedData;
            hasData = true;

            if (keys.includes(k + '_validation')) {
              const valData = await loadData(k + '_validation');
              if (valData && fileData.fileValidations) {
                fileData.fileValidations[k] = valData;
              }
            }
          }
        }
      }

      // Re-build dictionary if csidData is present
      if (fileData.csidData) {
        const data = fileData.csidData as any[][];
        const dict = buildAgentDictionary(data);
        fileData.agentDictionary = dict;
        fileData.agentDictionaryByMonth = { legacy: dict };
      }

      if (keys.includes('sheetsMeta')) {
        const meta = await loadData('sheetsMeta');
        if (meta && typeof meta === 'object') {
          if (meta.dataSource === 'sheets' || meta.dataSource === 'csv') {
            fileData.dataSource = meta.dataSource;
          }
          if (meta.selectedSheetMonth) fileData.selectedSheetMonth = meta.selectedSheetMonth;
          if (meta.lastSyncTime) fileData.lastSyncTime = new Date(meta.lastSyncTime);
          if (meta.activeMonthRowCounts) fileData.activeMonthRowCounts = meta.activeMonthRowCounts;
          if (meta.agentDictionaryByMonth) fileData.agentDictionaryByMonth = meta.agentDictionaryByMonth;
          if (meta.agentDictionary) fileData.agentDictionary = meta.agentDictionary;
          if (meta.fileNames) {
            fileData.fileNames = { ...(fileData.fileNames || {}), ...meta.fileNames };
          }
        }
      }

      set({ ...fileData, persistedKeys: keys, isHydrating: false });
    } catch (e) {
      console.warn("Failed to hydrate from IndexedDB", e);
      set({ isHydrating: false });
    }
  },

  setDataSource: (mode) => set({ dataSource: mode }),
  setSelectedSheetMonth: (monthKey) => set({ selectedSheetMonth: monthKey }),

  fetchFromSheets: async () => {
    const gen = ++sheetsSyncGeneration;
    sheetsAbortController?.abort();
    sheetsAbortController = new AbortController();
    const signal = sheetsAbortController.signal;

    type StepState = 'pending' | 'active' | 'done' | 'error';
    const sourceSteps: Array<{ id: string; label: string; state: StepState }> = [
      { id: 'month', label: 'Data bulan aktif', state: 'pending' },
      { id: 'history', label: 'Riwayat 3 bulan sebelumnya', state: 'pending' },
      { id: 'master', label: 'Master CSID', state: 'pending' },
      { id: 'productivity', label: 'Productivity', state: 'pending' },
      { id: 'csat', label: 'CSAT SC', state: 'pending' },
      { id: 'sla', label: 'SLA / WHU', state: 'pending' },
      { id: 'schedule', label: 'Schedule', state: 'pending' },
      { id: 'qa', label: 'QA', state: 'pending' },
      { id: 'assemble', label: 'Menyusun dataset', state: 'pending' },
    ];

    const patchProgress = (
      message: string,
      patch: Partial<Record<string, StepState>>,
    ) => {
      if (gen !== sheetsSyncGeneration) return;
      set({
        sheetsSyncProgress: {
          message,
          steps: sourceSteps.map((step) => ({
            ...step,
            state: patch[step.id] ?? step.state,
          })),
        },
      });
      // Keep local step states in sync for subsequent patches.
      sourceSteps.forEach((step) => {
        const next = patch[step.id];
        if (next) step.state = next;
      });
    };

    set({
      isFetchingSheets: true,
      sheetsFetchError: null,
      sheetsSyncProgress: { message: 'Menyiapkan sync...', steps: [...sourceSteps] },
    });
    
    try {
      const selectedMonth = get().selectedSheetMonth;
      const sheetConfig = getSheetConfigForMonth(selectedMonth);
      const monthOption = getSheetMonthOption(selectedMonth);

      patchProgress(`Mengambil data ${monthOption.label}...`, { month: 'active' });
      const currentMonthData = await fetchAllSheets(
        sheetConfig,
        getSpreadsheetIdForMonth(selectedMonth),
        signal,
      );
      if (gen !== sheetsSyncGeneration) return;
      patchProgress(`Bulan ${monthOption.label} siap`, {
        month: 'done',
        master: 'done',
        productivity: 'done',
        csat: 'done',
        sla: 'done',
        schedule: 'done',
        qa: 'done',
      });

      const currentMonthRows = {
        csidData: countDataRows(sheetDataToParseResult(currentMonthData.csid).data),
        productivityData: countDataRows(sheetDataToParseResult(currentMonthData.productivity).data),
        csatScData: countDataRows(sheetDataToParseResult(currentMonthData.csatSc).data),
        slaData: countDataRows(sheetDataToParseResult(currentMonthData.sla).data),
        scheduleData: countDataRows(sheetDataToParseResult(currentMonthData.schedule).data),
        qaData: countDataRows(sheetDataToParseResult(currentMonthData.qa).data),
      };
      // Cap history: selected month + 3 prior (MoM×3 / Incentive). Avoid unbounded RAM growth.
      const historyMonthKeys = getSheetMonthHistoryKeys(selectedMonth);

      patchProgress('Mengambil riwayat bulan sebelumnya...', { history: 'active' });
      const historicalSheets = await Promise.all(
        historyMonthKeys.map(monthKey =>
          monthKey === selectedMonth
            ? Promise.resolve(currentMonthData)
            : fetchAllSheets(
                getSheetConfigForMonth(monthKey),
                getSpreadsheetIdForMonth(monthKey),
                signal,
              ),
        ),
      );
      if (gen !== sheetsSyncGeneration) return;
      patchProgress('Riwayat siap', { history: 'done', assemble: 'active' });

      const allData = historicalSheets.reduce(
        (merged, monthData) =>
          merged ? mergeAllSheetsData(merged, monthData) : monthData,
        null as typeof currentMonthData | null,
      ) || currentMonthData;
      const loadedMonthLabel = historyMonthKeys.length > 1
        ? `${getSheetMonthOption(historyMonthKeys[0]).label} - ${monthOption.label}`
        : monthOption.label;
      
      const csvCsid = sheetDataToParseResult(allData.csid);
      const csvProductivity = sheetDataToParseResult(allData.productivity);
      const csvCsatSc = sheetDataToParseResult(allData.csatSc);
      const csvSla = sheetDataToParseResult(allData.sla);
      const csvSchedule = sheetDataToParseResult(allData.schedule);
      const csvQa = sheetDataToParseResult(allData.qa);

      const newAgentDict = buildAgentDictionary(csvCsid.data);
      const agentDictionaryByMonth = historyMonthKeys.reduce((result, monthKey, index) => {
        result[monthKey] = buildAgentDictionary(
          sheetDataToParseResult(historicalSheets[index].csid).data,
        );
        return result;
      }, {} as Record<string, Record<string, { name: string; bpo: string; teamLeader: string }>>);

      patchProgress('Dataset siap', { assemble: 'done' });
      if (gen !== sheetsSyncGeneration) return;

      const syncedAt = new Date();
      const fileNames = {
        csidFile: `CSID (${loadedMonthLabel})`,
        productivityFile: `Productivity (${loadedMonthLabel})`,
        csatScFile: `CSAT SC (${loadedMonthLabel})`,
        slaFile: `SLA (${loadedMonthLabel})`,
        scheduleFile: `Schedule (${loadedMonthLabel})`,
        qaFile: `QA (${loadedMonthLabel})`,
      };
      const agentDictionary = agentDictionaryByMonth[selectedMonth] || newAgentDict;
      
      set({
        // We set dummy files so the UI knows data is "present"
        csidFile: new File([], fileNames.csidFile),
        productivityFile: new File([], fileNames.productivityFile),
        csatScFile: new File([], fileNames.csatScFile),
        slaFile: new File([], fileNames.slaFile),
        scheduleFile: new File([], fileNames.scheduleFile),
        qaFile: new File([], fileNames.qaFile),

        csidData: csvCsid.data,
        productivityData: csvProductivity.data,
        csatScData: csvCsatSc.data,
        slaData: csvSla.data,
        scheduleData: csvSchedule.data,
        qaData: csvQa.data,

        agentDictionary,
        agentDictionaryByMonth,
        activeMonthRowCounts: currentMonthRows,
        lastSyncTime: syncedAt,
        isFetchingSheets: false,
        sheetsSyncProgress: null,
        dataSource: 'sheets',
        fileNames,
      });

      Promise.all([
        saveData('csidFile', csvCsid.data),
        saveData('productivityFile', csvProductivity.data),
        saveData('csatScFile', csvCsatSc.data),
        saveData('slaFile', csvSla.data),
        saveData('scheduleFile', csvSchedule.data),
        saveData('qaFile', csvQa.data),
        saveData('sheetsMeta', {
          dataSource: 'sheets',
          selectedSheetMonth: selectedMonth,
          lastSyncTime: syncedAt.toISOString(),
          activeMonthRowCounts: currentMonthRows,
          agentDictionary,
          agentDictionaryByMonth,
          fileNames,
        }),
      ]).then(() => {
        if (gen !== sheetsSyncGeneration) return;
        listKeys().then((keys) => set({ persistedKeys: keys }));
      }).catch((err) => {
        console.warn('Failed to persist sheets snapshot', err);
      });
      
    } catch (error) {
      if (gen !== sheetsSyncGeneration || isAbortError(error)) return;
      set({ 
        isFetchingSheets: false,
        sheetsSyncProgress: null,
        sheetsFetchError: error instanceof Error ? error.message : 'Gagal mengambil data dari Google Sheets',
      });
    }
  }
}));
