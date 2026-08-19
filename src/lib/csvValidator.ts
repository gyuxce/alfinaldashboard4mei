import { resolveCsidColumns } from './csid';

export type ValidationSeverity = 'ok' | 'warning' | 'error';

export interface ValidationResult {
  isValid: boolean;
  errorType?: string;
  message?: string;
  severity: ValidationSeverity;
}

export function extractHeaders(parsedData: any[][]): string[] {
  if (!parsedData || parsedData.length === 0) return [];
  // Find the first row that has at least some content
  const headerRow = parsedData.find(row => row && row.some(cell => String(cell || '').trim() !== '')) || [];
  return headerRow.map((h: any) => String(h || ''));
}

export function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[\s_-]/g, '');
}

export function hasAnyHeader(headers: string[], possibleNames: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedNames = possibleNames.map(normalizeHeader);
  return normalizedHeaders.some(h => normalizedNames.includes(h));
}

export function countDataRows(parsedData: any[][]): number {
  const validRows = parsedData.filter(row => row && row.some(cell => String(cell || '').trim() !== ''));
  return Math.max(0, validRows.length - 1);
}

export function scanRowsForKeyword(
  parsedData: any[][], 
  keywords: string[], 
  maxRows: number = 5
): boolean {
  const rowsToScan = parsedData.slice(0, maxRows);
  for (const row of rowsToScan) {
    if (!row) continue;
    const rowText = row.join(' ').toLowerCase();
    for (const keyword of keywords) {
      if (rowText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function getBaseIssues(parsedData: any[][]): ValidationResult | null {
  if (!parsedData || parsedData.length === 0) {
    return {
      isValid: false,
      errorType: 'PARSE_ERROR',
      message: 'File tidak bisa di-parse, kemungkinan format bukan CSV.',
      severity: 'error'
    };
  }
  const rows = countDataRows(parsedData);
  if (rows === 0) {
    return {
      isValid: false,
      errorType: 'EMPTY_DATA',
      message: 'File tidak memiliki data (hanya header).',
      severity: 'warning'
    };
  }
  return null;
}

export function validateCsidFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  const headers = extractHeaders(parsedData);
  // Parser and validator intentionally share aliases so a file cannot be
  // shown as valid while its CSID columns are read from different positions.
  const columns = resolveCsidColumns(headers);
  const hasId = columns.id >= 0;
  const hasName = columns.name >= 0;
  const hasBpo = columns.bpo >= 0;
  const hasTl = columns.teamLeader >= 0;

  if (!hasId || !hasName || !hasBpo || !hasTl) {
    let missing = [];
    if (!hasId) missing.push('CS ID');
    if (!hasName) missing.push('Agent Name');
    if (!hasBpo) missing.push('BPO');
    if (!hasTl) missing.push('Team Leader');
    
    return {
      isValid: false,
      errorType: 'MISSING_COLUMN',
      message: `Kolom wajib tidak ditemukan: ${missing.join(', ')}.`,
      severity: 'warning'
    };
  }

  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }

  return { isValid: true, severity: 'ok' };
}

export function validateProductivityFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  const headers = extractHeaders(parsedData);
  const topRowsContent = parsedData.slice(0, 10).map(row => row.join(' ').toLowerCase()).join(' ');
  const hasProdKeyword = topRowsContent.includes('productivity') || topRowsContent.includes('whu');

  // Find date format in first few rows (DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD format approximation)
  let hasDateColumn = false;
  let maxCols = 0;
  for (let i = 0; i < Math.min(parsedData.length, 10); i++) {
    const row = parsedData[i];
    if (row && row.length > maxCols) maxCols = row.length;
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(cell)) {
        hasDateColumn = true;
        break;
      }
    }
  }

  if (maxCols < 7) {
    return {
      isValid: false,
      errorType: 'FEW_COLUMNS',
      message: `Jumlah minimal kolom untuk Productivity kurang dari yg diharapkan (Punya: ${maxCols}, Butuh: 7+).`,
      severity: 'warning'
    };
  }

  if (!hasProdKeyword && !hasDateColumn) {
    return {
      isValid: false,
      errorType: 'INVALID_FORMAT',
      message: 'Format mencurigakan: tidak menemukan tanggal atau indikator Productivity.',
      severity: 'warning'
    };
  }
  
  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }

  return { isValid: true, severity: 'ok' };
}

export function validateCsatScFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  const keywords = ['CSAT', 'Score', 'Rating', 'Tanggal', 'Date', 'Agent', 'CS', 'Survey', 'Star', 'Rate'];
  const hasKeyword = scanRowsForKeyword(parsedData, keywords, 5);

  if (!hasKeyword) {
    return {
      isValid: false,
      errorType: 'MISSING_COLUMN',
      message: 'Indikator file CSAT (misal: CSAT, Score, Rating, Agent) tidak ditemukan di awal file.',
      severity: 'warning'
    };
  }

  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }

  return { isValid: true, severity: 'ok' };
}

export function validateSlaFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  const parseSlaLikeProcessor = (value: unknown): number | null => {
    const clean = String(value || '').replace(',', '.').trim();
    if (!clean) return null;
    if (clean.includes('%')) {
      const pct = parseFloat(clean.replace('%', ''));
      return Number.isNaN(pct) ? null : pct;
    }
    const n = parseFloat(clean);
    return Number.isNaN(n) ? null : n * 100;
  };

  let rowsWithCsId = 0;
  let rowsWithSlaValue = 0;

  for (let i = 1; i < parsedData.length; i++) {
    const row = parsedData[i];
    if (!row || !Array.isArray(row)) continue;

    const idIdx = row.findIndex(cell => String(cell || '').trim().startsWith('3-1-'));
    if (idIdx === -1) continue;

    rowsWithCsId++;

    const sla1 = parseSlaLikeProcessor(row[idIdx + 11]);
    const sla3 = parseSlaLikeProcessor(row[idIdx + 13]);
    if (sla1 !== null || sla3 !== null) rowsWithSlaValue++;
  }

  if (rowsWithCsId === 0) {
    return {
      isValid: false,
      errorType: 'MISSING_CSID',
      message: 'Tidak menemukan baris SLA dengan CS ID format 3-1-....',
      severity: 'warning'
    };
  }

  if (rowsWithSlaValue === 0) {
    return {
      isValid: false,
      errorType: 'MISSING_SLA_VALUE',
      message: 'CS ID ditemukan, tapi nilai SLA di kolom relatif +11/+13 tidak terbaca.',
      severity: 'warning'
    };
  }
  
  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }

  return { isValid: true, severity: 'ok' };
}

export function validateScheduleFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  let maxCols = 0;
  for (let i = 0; i < Math.min(parsedData.length, 10); i++) {
    const row = parsedData[i];
    if (row && row.length > maxCols) maxCols = row.length;
  }

  if (maxCols < 6) {
    return {
      isValid: false,
      errorType: 'FEW_COLUMNS',
      message: `File ini terlalu sempit (hanya ${maxCols} kolom) untuk menjadi file Schedule.`,
      severity: 'warning'
    };
  }

  // Check some data logic
  const topRowsContent = parsedData.slice(0, 10).map(row => row.join(' ').toLowerCase()).join(' ');
  const hasShiftKeywords = topRowsContent.includes('off') || topRowsContent.includes('pullout') || topRowsContent.includes('sick');
  
  // Checking format shift in body (e.g. \d{2}:\d{2} or OFF or PULLOUT)
  let hasShiftTime = false;
  for (let i = 1; i < Math.min(parsedData.length, 10); i++) {
    const row = parsedData[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim().toUpperCase();
      if (/^\d{1,2}:\d{2}/.test(cell) || cell === 'OFF' || cell === 'PULLOUT') {
        hasShiftTime = true;
        break;
      }
    }
  }

  if (!hasShiftTime && !hasShiftKeywords) {
    return {
      isValid: false,
      errorType: 'INVALID_FORMAT',
      message: 'Format mencurigakan: tidak ada data shift atau OFF/PULLOUT di beberapa baris pertama.',
      severity: 'warning'
    };
  }

  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }
  return { isValid: true, severity: 'ok' };
}

export function validateQaFile(parsedData: any[][]): ValidationResult {
  const base = getBaseIssues(parsedData);
  if (base && base.errorType !== 'FEW_ROWS') return base;

  const keywords = ['QA', 'Score', 'Defect', 'CSAT', 'QC', 'Mistake', 'Quality', 'Audit', 'Indicator', 'KODE', 'Banding'];
  
  const rowsToScan = parsedData.slice(0, 5);
  const combinedText = rowsToScan.map(row => (row || []).join(' ').toLowerCase()).join(' ');
  
  let matchCount = 0;
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  if (matchCount < 2) {
    return {
      isValid: false,
      errorType: 'MISSING_COLUMN',
      message: 'Kolom indikator QA (butuh min 2 seperti: QA, QC, Score, Defect) tidak cukup.',
      severity: 'warning'
    };
  }
  
  const rows = countDataRows(parsedData);
  if (rows < 5) {
    return {
      isValid: false,
      errorType: 'FEW_ROWS',
      message: `File hanya memiliki ${rows} baris data, mungkin tidak lengkap.`,
      severity: 'warning'
    };
  }

  return { isValid: true, severity: 'ok' };
}
