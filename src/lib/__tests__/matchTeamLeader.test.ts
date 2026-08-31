import { describe, expect, it } from 'vitest';
import { matchTeamLeaderToAgent, resolveTeamLeaderAgent } from '../matchTeamLeader';

const officialTls = [
  { name: 'Gagas Bayu Krisnha', csId: '3-1-gagas', manDays: 23, productivityTotal: 2291 },
  { name: 'Muhammad Aufar Himdani', csId: '3-1-aufar', manDays: 23, productivityTotal: 2202 },
  { name: 'Yuga Giri Purboyo', csId: '3-1-yuga', manDays: 23, productivityTotal: 2333 },
  { name: 'Agra Eka Permana', csId: '3-1-agra', manDays: 23, productivityTotal: 2154 },
  { name: 'Fandi Bahtiar Rifai', csId: '3-1-fandi', manDays: 23, productivityTotal: 2102 },
];

describe('matchTeamLeaderToAgent', () => {
  it('maps roster nicknames to official sheet full names', () => {
    expect(matchTeamLeaderToAgent('Gagas', officialTls)?.name).toBe('Gagas Bayu Krisnha');
    expect(matchTeamLeaderToAgent('Yuge', officialTls)?.name).toBe('Yuga Giri Purboyo');
    expect(matchTeamLeaderToAgent('Fandi', officialTls)?.name).toBe('Fandi Bahtiar Rifai');
    expect(matchTeamLeaderToAgent('Agra', officialTls)?.name).toBe('Agra Eka Permana');
    expect(matchTeamLeaderToAgent('Aufar', officialTls)?.name).toBe('Muhammad Aufar Himdani');
  });

  it('prefers an exact full-name match', () => {
    expect(matchTeamLeaderToAgent('Yuga Giri Purboyo', officialTls)?.name).toBe(
      'Yuga Giri Purboyo',
    );
  });

  it('picks the productive TL when several names loosely match', () => {
    const rows = [
      { name: 'Yudha Extra', csId: 'x1', manDays: 0, productivityTotal: 0 },
      { name: 'Yuga Giri Purboyo', csId: '3-1-yuga', manDays: 23, productivityTotal: 2333 },
    ];
    expect(matchTeamLeaderToAgent('Yuge', rows)?.csId).toBe('3-1-yuga');
  });

  it('returns undefined when no unique personal row exists', () => {
    expect(matchTeamLeaderToAgent('Unknown TL', officialTls)).toBeUndefined();
    expect(matchTeamLeaderToAgent('', officialTls)).toBeUndefined();
  });
});

describe('resolveTeamLeaderAgent', () => {
  it('finds a TL via CSID roster when KPI name is empty', () => {
    const agents = [
      { name: '', csId: '3-1-gagas', manDays: 23, productivityTotal: 2291 },
      { name: 'Someone Else', csId: '3-1-other', manDays: 20, productivityTotal: 1000 },
    ];
    const roster = {
      '3-1-gagas': { name: 'Gagas Bayu Krisnha' },
      '3-1-other': { name: 'Someone Else' },
    };
    expect(resolveTeamLeaderAgent('Gagas', agents, roster)?.csId).toBe('3-1-gagas');
  });
});
