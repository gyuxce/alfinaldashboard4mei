import { describe, it, expect } from 'vitest';
import {
  findScoreColumnByData,
  isCsatScoreCell,
  resolveCsatScColumns,
} from '../sheetHeaders';
import { processKPIs } from '../dataProcessor';

describe('isCsatScoreCell', () => {
  it('accepts bare 1–5 ratings', () => {
    expect(isCsatScoreCell('1')).toBe(true);
    expect(isCsatScoreCell('5')).toBe(true);
    expect(isCsatScoreCell('4.0')).toBe(true);
    expect(isCsatScoreCell('3,0')).toBe(true);
  });

  it('rejects date strings that parseFloat would treat as 1–5', () => {
    expect(isCsatScoreCell('1/8/2026')).toBe(false);
    expect(isCsatScoreCell('5/8/2026')).toBe(false);
    expect(isCsatScoreCell('5-Agu-2026')).toBe(false);
    expect(isCsatScoreCell('3-1-1001')).toBe(false);
    expect(isCsatScoreCell('')).toBe(false);
    expect(isCsatScoreCell('6')).toBe(false);
  });
});

describe('findScoreColumnByData', () => {
  it('does not pick the date column for early-August DD/MM dates', () => {
    const headers = Array.from({ length: 14 }, (_, i) => `Column${i + 1}`);
    const rows = Array.from({ length: 10 }, (_, i) => {
      const day = i + 1;
      const row = Array(14).fill('');
      row[0] = `${day}/8/2026`;
      row[1] = '3-1-1001';
      row[2] = `T${day}`;
      row[12] = day % 2 === 0 ? '5' : '4';
      return row;
    });
    const data = [headers, ...rows];
    expect(findScoreColumnByData(data)).toBe(12);
    expect(resolveCsatScColumns(headers, data).score).toBe(12);
  });
});

describe('processKPIs CSAT SC daily buckets', () => {
  const agentDictionary = {
    '3-1-1001': { name: 'Agent One', bpo: 'TIN', teamLeader: 'Fandi' },
  };

  const scheduleData = [
    ['', 'CSID', 'Name', 'Team Leader', 'BPO', ...Array.from({ length: 10 }, (_, i) => `${i + 1}-Agu-2026`)],
    ['', '3-1-1001', 'Agent One', 'Fandi', 'TIN', ...Array(10).fill('08:00')],
  ];

  it('keeps daily CSAT for dates 6–10 when headers are generic ColumnN', () => {
    const headers = Array.from({ length: 14 }, (_, i) => `Column${i + 1}`);
    const csatRows = Array.from({ length: 10 }, (_, i) => {
      const day = i + 1;
      const row = Array(14).fill('');
      row[0] = `${day}/8/2026`;
      row[1] = '3-1-1001';
      row[2] = `TICKET-${day}`;
      row[9] = 'General';
      row[12] = '5';
      return row;
    });

    const result = processKPIs(
      [],
      [headers, ...csatRows],
      [],
      scheduleData,
      [],
      '2026-08-01',
      '2026-08-31',
      agentDictionary,
    );

    const agent = result.find((a) => a.csId === '3-1-1001')!;
    expect(agent).toBeDefined();
    expect(agent.csatScFullCount).toBe(10);
    const days = new Set(agent.dailyHistory.csatScFull.map((h) => h.normDate));
    expect(days.has('2026-08-01')).toBe(true);
    expect(days.has('2026-08-05')).toBe(true);
    expect(days.has('2026-08-06')).toBe(true);
    expect(days.has('2026-08-10')).toBe(true);
    expect(agent.dailyHistory.csatScFull).toHaveLength(10);
  });

  it('does not treat the date cell as a CSAT score', () => {
    const headers = Array.from({ length: 3 }, (_, i) => `Column${i + 1}`);
    const csatRows = Array.from({ length: 10 }, (_, i) => {
      const day = i + 1;
      return [`${day}/8/2026`, '3-1-1001', `TICKET-${day}`];
    });

    const result = processKPIs(
      [],
      [headers, ...csatRows],
      [],
      scheduleData,
      [],
      '2026-08-01',
      '2026-08-31',
      agentDictionary,
    );

    const agent = result.find((a) => a.csId === '3-1-1001')!;
    expect(agent.csatScFullCount).toBe(0);
    expect(agent.dailyHistory.csatScFull).toHaveLength(0);
  });
});
