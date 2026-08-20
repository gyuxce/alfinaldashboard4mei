import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { normalizeDateStr } from './dataProcessor';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format numbers
export function formatNum(num: number | null | undefined, decimals = 2, suffix = '') {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return Number(num).toFixed(decimals) + suffix;
}

export type KpiType = 'productivity' | 'qa' | 'sla1m' | 'sla3m' | 'whu' | 'csatFull' | 'csatFair' | 'csatOfficial' | 'attendance';

export function parseDateForSort(dateStr: string): number {
  if (!dateStr) return 0;

  // Prefer local Y-M-D parse — `new Date('YYYY-MM-DD')` is UTC and shifts week buckets in ID timezone.
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)).getTime();
  }
  
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
  }
  
  const dashMatch = dateStr.match(/^(\d{1,2})[-\s]([A-Za-z]+)(?:[-\s](\d{4}))?$/);
  if (dashMatch) {
    const [, day, monthStr, yearStr] = dashMatch;
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, agu: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11,
      januari: 0, februari: 1, maret: 2, april: 3, mei: 4,
      juni: 5, juli: 6, agustus: 7, september: 8, oktober: 9,
      november: 10, desember: 11
    };
    let mIdx = monthMap[monthStr.toLowerCase()];
    if (mIdx === undefined) {
       for(const [k, v] of Object.entries(monthMap)) {
         if (monthStr.toLowerCase().startsWith(k)) {
           mIdx = v; break;
         }
       }
    }

    if (mIdx !== undefined) {
      const year = yearStr ? parseInt(yearStr) : new Date().getFullYear();
      return new Date(year, mIdx, parseInt(day)).getTime();
    }
  }
  
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) return fallback.getTime();
  
  return 0;
}

export function getMonthOffsetLabel(periodStart: string, offset = 0): string {
  const match = String(periodStart || '').match(/^(\d{4})-(\d{2})-/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return '';

  // Start from day 1 so subtracting a month cannot overflow from June 31 to July.
  const target = new Date(year, month - 1, 1);
  target.setMonth(target.getMonth() - offset);
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(target) + ` ${target.getFullYear()}`;
}

type DatedEntry = { date?: string; normDate?: string };

/**
 * O(n) index of dated entries → Map<raw date | normalized date, entry>.
 *
 * Views display human labels (e.g. `1 Agustus 2026`) while the processor
 * commonly stores ISO `normDate` (`2026-08-01`). Index both forms so tables
 * can reliably look up entries with either representation.
 */
export function indexByDate<T extends readonly DatedEntry[]>(
  entries: T | null | undefined,
): Map<string, T[number]> {
  const map = new Map<string, T[number]>();
  if (!entries) return map;
  for (const entry of entries) {
    if (entry.date) map.set(entry.date, entry);
    if (entry.normDate) map.set(entry.normDate, entry);
    const extraNorm = normalizeDateStr(entry.date || '');
    if (extraNorm) map.set(extraNorm, entry);
  }
  return map;
}

/** O(n) group of dated entries → Map<raw date | normalized date, entries[]>. */
export function groupByDate<T extends readonly DatedEntry[]>(
  entries: T | null | undefined,
): Map<string, Array<T[number]>> {
  const map = new Map<string, Array<T[number]>>();
  if (!entries) return map;
  for (const entry of entries) {
    const extraNorm = normalizeDateStr(entry.date || '');
    const keys = new Set([entry.date, entry.normDate, extraNorm].filter(Boolean) as string[]);
    for (const key of keys) {
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
  }
  return map;
}

export function formatCalendarHeader(dateKey: string): string {
  const nd = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : (normalizeDateStr(dateKey) || '');
  const match = nd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

export function uniqueCalendarDates(
  series: Array<readonly DatedEntry[] | null | undefined>,
): string[] {
  const byNorm = new Set<string>();
  for (const entries of series) {
    if (!entries) continue;
    for (const entry of entries) {
      const label = String(entry.date || '').trim();
      const nd = String(entry.normDate || '').trim() || normalizeDateStr(label);
      if (!nd) continue;
      byNorm.add(nd);
    }
  }
  return Array.from(byNorm).sort((a, b) => a.localeCompare(b));
}

export function getByCalendarDate<T extends DatedEntry>(
  indexed: Map<string, T>,
  dateLabel: string,
): T | undefined {
  const nd = /^\d{4}-\d{2}-\d{2}$/.test(dateLabel) ? dateLabel : normalizeDateStr(dateLabel);
  if (nd && indexed.has(nd)) return indexed.get(nd);
  if (indexed.has(dateLabel)) return indexed.get(dateLabel);
  return undefined;
}

export function getGroupByCalendarDate<T extends DatedEntry>(
  grouped: Map<string, T[]>,
  dateLabel: string,
): T[] {
  const nd = /^\d{4}-\d{2}-\d{2}$/.test(dateLabel) ? dateLabel : normalizeDateStr(dateLabel);
  if (nd && grouped.has(nd)) return grouped.get(nd) || [];
  if (grouped.has(dateLabel)) return grouped.get(dateLabel) || [];
  return [];
}


const kpiColorCache = new Map<string, string>();

export function getKpiColor(val: number | null | undefined, type: KpiType): string {
  if (val === null || val === undefined || isNaN(val)) return 'text-text-disabled';
  
  const key = `${type}_${val}`;
  let cached = kpiColorCache.get(key);
  if (cached) return cached;
  
  let target = 0;

  switch (type) {
    case 'productivity': target = 100; break;
    case 'qa': target = 92.00; break;
    case 'sla1m': target = 92.00; break;
    case 'sla3m': target = 96.00; break;
    case 'whu': target = 96.00; break;
    case 'csatFull': target = 75.00; break;
    case 'csatFair': target = 92.00; break;
    case 'csatOfficial': target = 3.75; break;
    case 'attendance': target = 95.00; break;
  }

  const reached = val >= target;
  const result = reached ? 'text-success' : 'text-danger';
  
  kpiColorCache.set(key, result);
  return result;
}
