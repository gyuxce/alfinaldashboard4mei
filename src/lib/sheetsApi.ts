// Config (dari env variables)
const API_KEY = import.meta.env.VITE_SHEETS_API_KEY;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Type untuk raw data dari Sheets API
export type SheetRow = string[];
export type SheetData = SheetRow[];

// Fetch single sheet
export async function fetchSheet(
  sheetName: string,
  range: string = 'A:AZ'
): Promise<SheetData> {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}?key=${API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sheet "${sheetName}": ${response.status} ${response.statusText}`
    );
  }
  
  const json = await response.json();
  return json.values || [];
}

// Fetch semua sheet sekaligus (parallel)
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

// Default config, user bisa override di env atau settings
const DEFAULT_CONFIG: SheetConfig = {
  csidSheetName: import.meta.env.VITE_SHEET_CSID || 'CSID',
  productivitySheetName: import.meta.env.VITE_SHEET_PRODUCTIVITY || 'Productivity CSAT WHU',
  csatScSheetName: import.meta.env.VITE_SHEET_CSAT_SC || 'CSAT SC',
  slaSheetName: import.meta.env.VITE_SHEET_SLA || 'SLA',
  scheduleSheetName: import.meta.env.VITE_SHEET_SCHEDULE || 'Schedule',
  qaSheetName: import.meta.env.VITE_SHEET_QA || 'QA',
};

export async function fetchAllSheets(
  config: SheetConfig = DEFAULT_CONFIG
): Promise<AllSheetsData> {
  // Fetch semua parallel untuk kecepatan
  const [csid, productivity, csatSc, sla, schedule, qa] = await Promise.all([
    fetchSheet(config.csidSheetName),
    fetchSheet(config.productivitySheetName),
    fetchSheet(config.csatScSheetName),
    fetchSheet(config.slaSheetName),
    fetchSheet(config.scheduleSheetName),
    fetchSheet(config.qaSheetName),
  ]);
  
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
