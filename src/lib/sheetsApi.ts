// Config (dari env variables)
const API_KEY = import.meta.env.VITE_SHEETS_API_KEY;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Type untuk raw data dari Sheets API
export type SheetRow = string[];
export type SheetData = SheetRow[];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch single sheet
export async function fetchSheet(
  sheetName: string,
  range: string = 'A:AZ'
): Promise<SheetData> {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}?key=${API_KEY}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      const json = await response.json();
      return json.values || [];
    }

    const shouldRetry = RETRYABLE_STATUS.has(response.status) && attempt < 3;
    if (!shouldRetry) {
      throw new Error(
        `Failed to fetch sheet "${sheetName}": ${response.status} ${response.statusText}`
      );
    }

    await sleep(1000 * Math.pow(2, attempt));
  }

  return [];
}

// Fetch semua sheet dari Google Sheets
export interface AllSheetsData {
  csid: SheetData;
  productivity: SheetData;
  csatSc: SheetData;
  sla: SheetData;
  schedule: SheetData;
  qa: SheetData;
}

export interface SheetConfig {
  csidSheetName: string;
  productivitySheetName: string;
  csatScSheetName: string;
  slaSheetName: string;
  scheduleSheetName: string;
  qaSheetName: string;
}

export interface SheetMonthOption {
  key: string;
  label: string;
  suffix: string | null;
  description: string;
}

// Default config, user bisa override di env atau settings
const DEFAULT_CONFIG: SheetConfig = {
  csidSheetName: import.meta.env.VITE_SHEET_CSID || 'CSID',
  productivitySheetName: import.meta.env.VITE_SHEET_PRODUCTIVITY || 'Productivity CSAT WHU',
  csatScSheetName: import.meta.env.VITE_SHEET_CSAT_SC || 'CSAT SC',
  slaSheetName: import.meta.env.VITE_SHEET_SLA || 'SLA',
  scheduleSheetName: import.meta.env.VITE_SHEET_SCHEDULE || 'Schedule',
  qaSheetName: import.meta.env.VITE_SHEET_QA || 'QA',
};

export const SHEET_MONTH_OPTIONS: SheetMonthOption[] = [
  {
    key: 'legacy',
    label: 'Mei 2026',
    suffix: null,
    description: 'Menggunakan nama tab dari env Vercel saat ini',
  },
  {
    key: 'JUN_2026',
    label: 'Juni 2026',
    suffix: 'JUN_2026',
    description: 'Menggunakan tab bulanan format *_JUN_2026',
  },
  {
    key: 'JUL_2026',
    label: 'Juli 2026',
    suffix: 'JUL_2026',
    description: 'Menggunakan tab bulanan format *_JUL_2026',
  },
  {
    key: 'AUG_2026',
    label: 'Agustus 2026',
    suffix: 'AUG_2026',
    description: 'Menggunakan tab bulanan format *_AUG_2026',
  },
  {
    key: 'SEP_2026',
    label: 'September 2026',
    suffix: 'SEP_2026',
    description: 'Menggunakan tab bulanan format *_SEP_2026',
  },
  {
    key: 'OCT_2026',
    label: 'Oktober 2026',
    suffix: 'OCT_2026',
    description: 'Menggunakan tab bulanan format *_OCT_2026',
  },
  {
    key: 'NOV_2026',
    label: 'November 2026',
    suffix: 'NOV_2026',
    description: 'Menggunakan tab bulanan format *_NOV_2026',
  },
  {
    key: 'DEC_2026',
    label: 'Desember 2026',
    suffix: 'DEC_2026',
    description: 'Menggunakan tab bulanan format *_DEC_2026',
  },
];

export function getSheetMonthOption(monthKey: string): SheetMonthOption {
  return SHEET_MONTH_OPTIONS.find(option => option.key === monthKey) || SHEET_MONTH_OPTIONS[0];
}

export function getSheetConfigForMonth(monthKey: string): SheetConfig {
  const option = getSheetMonthOption(monthKey);
  if (!option.suffix) return DEFAULT_CONFIG;

  return {
    csidSheetName: `CSID_${option.suffix}`,
    productivitySheetName: `PRODUCTIVITY_${option.suffix}`,
    csatScSheetName: `CSAT_SC_${option.suffix}`,
    slaSheetName: `SLA_${option.suffix}`,
    scheduleSheetName: `SCHEDULE_${option.suffix}`,
    qaSheetName: `QA_${option.suffix}`,
  };
}

export async function fetchAllSheets(
  config: SheetConfig = DEFAULT_CONFIG
): Promise<AllSheetsData> {
  // Fetch berurutan supaya Google Sheets API tidak terlalu mudah kena 503.
  const csid = await fetchSheet(config.csidSheetName);
  await sleep(250);
  const productivity = await fetchSheet(config.productivitySheetName);
  await sleep(250);
  const csatSc = await fetchSheet(config.csatScSheetName);
  await sleep(250);
  const sla = await fetchSheet(config.slaSheetName);
  await sleep(250);
  const schedule = await fetchSheet(config.scheduleSheetName);
  await sleep(250);
  const qa = await fetchSheet(config.qaSheetName);
  
  return { csid, productivity, csatSc, sla, schedule, qa };
}

// Convert SheetData ke format CSV string (agar kompatibel 
// dengan PapaParse yang sudah ada)
export function sheetDataToCsv(data: SheetData): string {
  return data
    .map(row => row.map(cell => {
      // Quote cells yang mengandung koma atau newline
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','))
    .join('\n');
}

// Convert SheetData ke format yang sama dengan PapaParse output
export function sheetDataToParseResult(
  data: SheetData
): { data: string[][] } {
  return { data };
}
