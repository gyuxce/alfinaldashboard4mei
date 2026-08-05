import { create } from 'zustand';
import { saveData, loadData, clearAllData, listKeys } from './lib/storage';
import { countDataRows, ValidationResult } from './lib/csvValidator';
import { fetchAllSheets, getCurrentSheetMonthKey, getPreviousSheetMonthKey, getSheetConfigForMonth, getSheetMonthOption, getSpreadsheetIdForMonth, mergeAllSheetsData, sheetDataToParseResult } from './lib/sheetsApi';

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
}

export const useStore = create<AppState>((set, get) => ({
  dataSource: 'csv',
  isFetchingSheets: false,
  sheetsFetchError: null,
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
      const dict: Record<string, {name: string; bpo: string; teamLeader: string}> = {};
      let idIdx = 0, nameIdx = 1, bpoIdx = 2, tlIdx = -1;

      if (data.length > 0) {
        const header = data[0].map((h: any) => String(h || '').toLowerCase().trim());
        const iCSID = header.findIndex((h: string) => h === 'cs id' || h === 'csid');
        const iName = header.findIndex((h: string) => h === 'agent name' || h === 'name');
        const iBpo = header.findIndex((h: string) => h === 'bpo');
        const iTL = header.findIndex((h: string) => h === 'team leader' || h === 'tl' || h === 'leader' || h === 'supervisor');
        
        if (iCSID >= 0) idIdx = iCSID;
        if (iName >= 0) nameIdx = iName;
        if (iBpo >= 0) bpoIdx = iBpo;
        if (iTL >= 0) tlIdx = iTL;
        else if (header.length > 3 && (header[3] === '' || !header[3])) tlIdx = 3;
      }

      data.forEach(row => {
        if (row && row.length > Math.max(idIdx, 0)) {
          const id = String(row[idIdx] || '').trim();
          const name = String(row[nameIdx] || '').trim();
          const bpo = String(row[bpoIdx] || '').trim();
          const teamLeader = tlIdx >= 0 ? String(row[tlIdx] || '').trim() : '';

          if (id && id.toLowerCase() !== 'cs id' && id !== 'undefined' && id.startsWith('3-1-')) {
            if (!dict[id]) {
              dict[id] = { name, bpo, teamLeader };
            } else {
              if (name) dict[id].name = name;
              if (bpo) dict[id].bpo = bpo;
              if (teamLeader) dict[id].teamLeader = teamLeader;
            }
          }
        }
      });
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
        const dict: Record<string, {name: string; bpo: string; teamLeader: string}> = {};
        const data = fileData.csidData as any[][];
        let idIdx = 0, nameIdx = 1, bpoIdx = 2, tlIdx = -1;

        if (data.length > 0) {
          const header = data[0].map((h: any) => String(h || '').toLowerCase().trim());
          const iCSID = header.findIndex((h: string) => h === 'cs id' || h === 'csid');
          const iName = header.findIndex((h: string) => h === 'agent name' || h === 'name');
          const iBpo = header.findIndex((h: string) => h === 'bpo');
          const iTL = header.findIndex((h: string) => h === 'team leader' || h === 'tl' || h === 'leader' || h === 'supervisor');
          
          if (iCSID >= 0) idIdx = iCSID;
          if (iName >= 0) nameIdx = iName;
          if (iBpo >= 0) bpoIdx = iBpo;
          if (iTL >= 0) tlIdx = iTL;
          else if (header.length > 3 && (header[3] === '' || !header[3])) tlIdx = 3;
        }

        data.forEach(row => {
          if (row && row.length > Math.max(idIdx, 0)) {
            const id = String(row[idIdx] || '').trim();
            const name = String(row[nameIdx] || '').trim();
            const bpo = String(row[bpoIdx] || '').trim();
            const teamLeader = tlIdx >= 0 ? String(row[tlIdx] || '').trim() : '';

            if (id && id.toLowerCase() !== 'cs id' && id !== 'undefined' && id.startsWith('3-1-')) {
              if (!dict[id]) {
                dict[id] = { name, bpo, teamLeader };
              } else {
                if (name) dict[id].name = name;
                if (bpo) dict[id].bpo = bpo;
                if (teamLeader) dict[id].teamLeader = teamLeader;
              }
            }
          }
        });
        fileData.agentDictionary = dict;
        fileData.agentDictionaryByMonth = { legacy: dict };
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
    set({ isFetchingSheets: true, sheetsFetchError: null });
    
    try {
      const selectedMonth = get().selectedSheetMonth;
      const sheetConfig = getSheetConfigForMonth(selectedMonth);
      const monthOption = getSheetMonthOption(selectedMonth);
      const currentMonthData = await fetchAllSheets(
        sheetConfig,
        getSpreadsheetIdForMonth(selectedMonth),
      );
      const currentMonthRows = {
        csidData: countDataRows(sheetDataToParseResult(currentMonthData.csid).data),
        productivityData: countDataRows(sheetDataToParseResult(currentMonthData.productivity).data),
        csatScData: countDataRows(sheetDataToParseResult(currentMonthData.csatSc).data),
        slaData: countDataRows(sheetDataToParseResult(currentMonthData.sla).data),
        scheduleData: countDataRows(sheetDataToParseResult(currentMonthData.schedule).data),
        qaData: countDataRows(sheetDataToParseResult(currentMonthData.qa).data),
      };
      const historyMonthKeys = [selectedMonth];
      let historyCursor = getPreviousSheetMonthKey(selectedMonth);
      while (historyCursor) {
        historyMonthKeys.unshift(historyCursor);
        historyCursor = getPreviousSheetMonthKey(historyCursor);
      }

      const historicalSheets = await Promise.all(
        historyMonthKeys.map(monthKey =>
          monthKey === selectedMonth
            ? Promise.resolve(currentMonthData)
            : fetchAllSheets(
                getSheetConfigForMonth(monthKey),
                getSpreadsheetIdForMonth(monthKey),
              ),
        ),
      );
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

      // Function to process dictionary inline to avoid duplicating logic from setFile
      const buildDict = (data: any[][]) => {
        const dict: Record<string, {name: string; bpo: string; teamLeader: string}> = {};
        let idIdx = 0, nameIdx = 1, bpoIdx = 2, tlIdx = -1;

        if (data.length > 0) {
          const header = data[0].map((h: any) => String(h || '').toLowerCase().trim());
          const iCSID = header.findIndex((h: string) => h === 'cs id' || h === 'csid');
          const iName = header.findIndex((h: string) => h === 'agent name' || h === 'name');
          const iBpo = header.findIndex((h: string) => h === 'bpo');
          const iTL = header.findIndex((h: string) => h === 'team leader' || h === 'tl' || h === 'leader' || h === 'supervisor');
          
          if (iCSID >= 0) idIdx = iCSID;
          if (iName >= 0) nameIdx = iName;
          if (iBpo >= 0) bpoIdx = iBpo;
          if (iTL >= 0) tlIdx = iTL;
          else if (header.length > 3 && (header[3] === '' || !header[3])) tlIdx = 3;
        }

        data.forEach(row => {
          if (row && row.length > Math.max(idIdx, 0)) {
            const id = String(row[idIdx] || '').trim();
            const name = String(row[nameIdx] || '').trim();
            const bpo = String(row[bpoIdx] || '').trim();
            const teamLeader = tlIdx >= 0 ? String(row[tlIdx] || '').trim() : '';

            if (id && id.toLowerCase() !== 'cs id' && id !== 'undefined' && id.startsWith('3-1-')) {
              if (!dict[id]) {
                dict[id] = { name, bpo, teamLeader };
              } else {
                if (name) dict[id].name = name;
                if (bpo) dict[id].bpo = bpo;
                if (teamLeader) dict[id].teamLeader = teamLeader;
              }
            }
          }
        });
        return dict;
      };

      const newAgentDict = buildDict(csvCsid.data);
      const agentDictionaryByMonth = historyMonthKeys.reduce((result, monthKey, index) => {
        result[monthKey] = buildDict(
          sheetDataToParseResult(historicalSheets[index].csid).data,
        );
        return result;
      }, {} as Record<string, Record<string, { name: string; bpo: string; teamLeader: string }>>);
      
      set({
        // We set dummy files so the UI knows data is "present"
        csidFile: new File([], `CSID (${loadedMonthLabel})`),
        productivityFile: new File([], `Productivity (${loadedMonthLabel})`),
        csatScFile: new File([], `CSAT SC (${loadedMonthLabel})`),
        slaFile: new File([], `SLA (${loadedMonthLabel})`),
        scheduleFile: new File([], `Schedule (${loadedMonthLabel})`),
        qaFile: new File([], `QA (${loadedMonthLabel})`),

        csidData: csvCsid.data,
        productivityData: csvProductivity.data,
        csatScData: csvCsatSc.data,
        slaData: csvSla.data,
        scheduleData: csvSchedule.data,
        qaData: csvQa.data,

        agentDictionary: agentDictionaryByMonth[selectedMonth] || newAgentDict,
        agentDictionaryByMonth,
        activeMonthRowCounts: currentMonthRows,
        lastSyncTime: new Date(),
        isFetchingSheets: false,
        dataSource: 'sheets',
      });
      
    } catch (error) {
      set({ 
        isFetchingSheets: false,
        sheetsFetchError: error instanceof Error ? error.message : 'Gagal mengambil data dari Google Sheets',
      });
    }
  }
}));
