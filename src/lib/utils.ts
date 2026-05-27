import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
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
    case 'csatOfficial': target = 75.00; break;
    case 'attendance': target = 95.00; break;
  }

  const reached = val >= target;
  const result = reached ? 'text-success' : 'text-danger';
  
  kpiColorCache.set(key, result);
  return result;
}
