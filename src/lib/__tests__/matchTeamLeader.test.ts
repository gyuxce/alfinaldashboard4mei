import { describe, expect, it } from 'vitest';
import { matchTeamLeaderToAgent, resolveTeamLeaderAgent } from '../matchTeamLeader';

const shortNamedTls = [
  { name: 'Gagas', csId: '3-1-gagas', manDays: 23, productivityTotal: 2291 },
  { name: 'Aufar', csId: '3-1-aufar', manDays: 23, productivityTotal: 2202 },
  { name: 'Yuge', csId: '3-1-yuge', manDays: 23, productivityTotal: 2333 },
  { name: 'Agra', csId: '3-1-agra', manDays: 23, productivityTotal: 2154 },
  { name: 'Fandi', csId: '3-1-fandi', manDays: 23, productivityTotal: 2102 },
];

describe('matchTeamLeaderToAgent', () => {
  it('matches short roster TL names exactly', () => {
    expect(matchTeamLeaderToAgent('Gagas', shortNamedTls)?.csId).toBe('3-1-gagas');
    expect(matchTeamLeaderToAgent('Yuge', shortNamedTls)?.csId).toBe('3-1-yuge');
    expect(matchTeamLeaderToAgent('Fandi', shortNamedTls)?.csId).toBe('3-1-fandi');
    expect(matchTeamLeaderToAgent('Agra', shortNamedTls)?.csId).toBe('3-1-agra');
    expect(matchTeamLeaderToAgent('Aufar', shortNamedTls)?.csId).toBe('3-1-aufar');
  });

  it('does not map Yuge onto a different first name like Yuga', () => {
    const rows = [
      { name: 'Yuga Giri Purboyo', csId: '3-1-yuga', manDays: 23, productivityTotal: 2333 },
      { name: 'Yuge', csId: '3-1-yuge', manDays: 23, productivityTotal: 2100 },
    ];
    expect(matchTeamLeaderToAgent('Yuge', rows)?.csId).toBe('3-1-yuge');
    expect(matchTeamLeaderToAgent('Yuge', [
      { name: 'Yuga Giri Purboyo', csId: '3-1-yuga', manDays: 23, productivityTotal: 2333 },
    ])).toBeUndefined();
  });

  it('allows first-word prefix when CSID has a longer name', () => {
    expect(
      matchTeamLeaderToAgent('Gagas', [
        { name: 'Gagas Bayu Krisnha', csId: '3-1-gagas', manDays: 23, productivityTotal: 2291 },
      ])?.csId,
    ).toBe('3-1-gagas');
  });

  it('returns undefined when no personal row exists', () => {
    expect(matchTeamLeaderToAgent('Unknown TL', shortNamedTls)).toBeUndefined();
    expect(matchTeamLeaderToAgent('', shortNamedTls)).toBeUndefined();
  });
});

describe('resolveTeamLeaderAgent', () => {
  it('finds a TL via CSID roster when KPI name is empty', () => {
    const agents = [
      { name: '', csId: '3-1-gagas', manDays: 23, productivityTotal: 2291 },
      { name: 'Someone Else', csId: '3-1-other', manDays: 20, productivityTotal: 1000 },
    ];
    const roster = {
      '3-1-gagas': { name: 'Gagas' },
      '3-1-other': { name: 'Someone Else' },
    };
    expect(resolveTeamLeaderAgent('Gagas', agents, roster)?.csId).toBe('3-1-gagas');
  });
});
