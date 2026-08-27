import { describe, it, expect } from 'vitest';
import { processKPIs, type AgentKPI } from '../dataProcessor';

// Minimal sheet fixtures — just enough to verify the pipeline
// produces agents with correct identity, man-days, and QA scores.

const csidData = [
  ['CS ID', 'AGENT NAME', 'BPO', 'TEAM LEADER'],
  ['3-1-1001', 'Agent One', 'TIN', 'Fandi'],
  ['3-1-1002', 'Agent Two', 'TCID', 'Yuge'],
];

const scheduleData = [
  ['', 'CSID', 'Name', 'Team Leader', 'BPO', '1-Agu-2026', '2-Agu-2026'],
  ['', '3-1-1001', 'Agent One', 'Fandi', 'TIN', '08:00', 'OFF'],
  ['', '3-1-1002', 'Agent Two', 'Yuge', 'TCID', 'OFF', '08:00'],
];

const productivityData: string[][] = [];

const csatScData: string[][] = [];

const slaData: string[][] = [];

const qaData = [
  ['CSID', 'Company Name', 'CS Name', 'CS ID (CRM)', 'Ticket ID', 'UID', 'CHATID', 'Tagg', 'Tanggal Case', 'Category', 'Sub Type Ticket', 'CSAT', 'Type of System Checking', 'Checking Date', 'QC Name', 'Mistake Level', 'Nilai Pengurang', 'QC Score'],
  ['3-1-1001', 'TIN', 'Agent One', 'Agent One', '24093396', '123', 'chat1', '', '1-Agu-2026', 'General', 'Info', 'N/A', 'LIVECHAT', '1-Agu-2026', 'QC Person', 'NO MISTAKE', '0', '100'],
  ['3-1-1001', 'TIN', 'Agent One', 'Agent One', '24093396', '123', 'chat1', '', '1-Agu-2026', 'General', 'Info', 'N/A', 'LIVECHAT', '1-Agu-2026', 'QC Person', 'MEDIUM', '10', ''],
];

const agentDictionary = {
  '3-1-1001': { name: 'Agent One', bpo: 'TIN', teamLeader: 'Fandi' },
  '3-1-1002': { name: 'Agent Two', bpo: 'TCID', teamLeader: 'Yuge' },
};

describe('processKPIs', () => {
  const result = processKPIs(
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    '2026-08-01',
    '2026-08-31',
    agentDictionary,
  );

  it('creates agents from CSID dictionary', () => {
    expect(result.length).toBe(2);
    const agent1 = result.find(a => a.csId === '3-1-1001');
    const agent2 = result.find(a => a.csId === '3-1-1002');
    expect(agent1).toBeDefined();
    expect(agent2).toBeDefined();
  });

  it('applies roster identity (name, BPO, TL) from dictionary', () => {
    const agent1 = result.find(a => a.csId === '3-1-1001')!;
    expect(agent1.name).toBe('Agent One');
    expect(agent1.bpo).toBe('TIN');
    expect(agent1.teamLeader).toBe('Fandi');
  });

  it('counts man-days from schedule', () => {
    const agent1 = result.find(a => a.csId === '3-1-1001')!;
    // 1-Agu has "08:00" (man-day), 2-Agu has "OFF" (not man-day)
    expect(agent1.manDays).toBe(1);
  });

  it('counts QA score once per ticket even with multiple line-items', () => {
    const agent1 = result.find(a => a.csId === '3-1-1001')!;
    // Ticket 24093396 has two rows: one with score 100, one empty.
    // Score should be counted once → avg = 100, count = 1.
    expect(agent1.qaScoreCount).toBe(1);
    expect(agent1.qaScoreSum).toBe(100);
  });

  it('keeps all QA line-items in history for defect analysis', () => {
    const agent1 = result.find(a => a.csId === '3-1-1001')!;
    // Both rows should be in qaHistory (NO MISTAKE + MEDIUM)
    expect(agent1.qaHistory.length).toBe(2);
    const mistakes = agent1.qaHistory.filter(q => q.mistakeLevel === 'MEDIUM');
    expect(mistakes.length).toBe(1);
  });

  it('sorts results by CS ID', () => {
    expect(result[0].csId).toBe('3-1-1001');
    expect(result[1].csId).toBe('3-1-1002');
  });
});
