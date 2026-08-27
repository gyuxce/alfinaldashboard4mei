import { describe, it, expect } from 'vitest';
import { resolveCsatScColumns } from '../sheetHeaders';
import { processKPIs } from '../dataProcessor';

/**
 * Reproduce the AUG 2026 CSAT SC layout: placeholder headers, CS ID at column D
 * (index 3), date in an early column, real score in column O (index 14).
 *
 * Before the fix, findScoreColumnByData scanned every column and the date
 * column won (parseFloat('5/8/2026') === 5), so days 1-5 showed the date number
 * as the score and 6+ stayed empty.
 */
function buildCsatScSheet({ withScoresOnlyForFirstDays = true }: { withScoresOnlyForFirstDays?: boolean } = {}) {
  const headers = Array.from({ length: 16 }, (_, i) => `Column${i + 1}`);
  const days = withScoresOnlyForFirstDays ? 5 : 31;
  const validScores = [1, 2, 4, 5];
  const rows = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const row = Array(16).fill('');
    row[0] = `${day}/8/2026`; // date
    row[3] = '3-1-1001'; // CS ID
    row[4] = `TICKET-${day}`;
    row[9] = 'General'; // category
    row[14] = String(validScores[i % validScores.length]); // score in column O
    return row;
  });
  return [headers, ...rows] as unknown[][];
}

const agentDictionary = {
  '3-1-1001': { name: 'Agent One', bpo: 'TIN', teamLeader: 'Fandi' },
};

const scheduleData = [
  ['', 'CSID', 'Name', 'Team Leader', 'BPO', ...Array.from({ length: 31 }, (_, i) => `${i + 1}-Agu-2026`)],
  ['', '3-1-1001', 'Agent One', 'Fandi', 'TIN', ...Array(31).fill('08:00')],
];

describe('resolveCsatScColumns score detection', () => {
  it('picks column O (14) as the score column, not the date column', () => {
    const data = buildCsatScSheet();
    const cols = resolveCsatScColumns(data[0] as unknown[], data.slice(1));
    expect(cols.score).toBe(14);
    // Date header is a placeholder ("Column1") so header lookup returns -1;
    // the processor falls back to the legacy offset, which lands on column 0.
    expect(cols.date).toBe(-1);
  });

  it('still falls back to -1 when no column looks like scores', () => {
    const headers = ['Column1', 'Column2'];
    const rows = [
      ['1/8/2026', '3-1-1001'],
      ['2/8/2026', '3-1-1002'],
    ];
    const cols = resolveCsatScColumns(headers, rows);
    expect(cols.score).toBe(-1);
  });
});

describe('processKPIs CSAT SC daily buckets (date column not read as score)', () => {
  it('reads real scores from column O for days 1-5 and leaves 6+ empty', () => {
    const csatData = buildCsatScSheet({ withScoresOnlyForFirstDays: true });
    const result = processKPIs(
      [],
      csatData,
      [],
      scheduleData,
      [],
      '2026-08-01',
      '2026-08-31',
      agentDictionary,
    );

    const agent = result.find((a) => a.csId === '3-1-1001')!;
    expect(agent).toBeDefined();
    // 5 survey rows, each with a real valid score (1,2,4,5) in column O
    expect(agent.csatScFullCount).toBe(5);
    const days = new Set(agent.dailyHistory.csatScFull.map((h) => h.normDate));
    expect(days.has('2026-08-01')).toBe(true);
    expect(days.has('2026-08-05')).toBe(true);
    expect(days.has('2026-08-06')).toBe(false);
    // Score must come from column O, not the date day number.
    const day1 = agent.dailyHistory.csatScFull.find((h) => h.normDate === '2026-08-01')!;
    expect(day1.count).toBe(1);
  });

  it('fills the whole month when the sheet has surveys for every day', () => {
    const csatData = buildCsatScSheet({ withScoresOnlyForFirstDays: false });
    const result = processKPIs(
      [],
      csatData,
      [],
      scheduleData,
      [],
      '2026-08-01',
      '2026-08-31',
      agentDictionary,
    );

    const agent = result.find((a) => a.csId === '3-1-1001')!;
    expect(agent.csatScFullCount).toBe(31);
    const days = new Set(agent.dailyHistory.csatScFull.map((h) => h.normDate));
    expect(days.has('2026-08-06')).toBe(true);
    expect(days.has('2026-08-26')).toBe(true);
    expect(days.has('2026-08-31')).toBe(true);
  });
});
