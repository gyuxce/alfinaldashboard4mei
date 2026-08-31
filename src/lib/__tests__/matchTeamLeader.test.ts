import { describe, expect, it } from 'vitest';
import { matchTeamLeaderToAgent } from '../matchTeamLeader';

const officialTls = [
  { name: 'Gagas Bayu Krisnha' },
  { name: 'Muhammad Aufar Himdani' },
  { name: 'Yuga Giri Purboyo' },
  { name: 'Agra Eka Permana' },
  { name: 'Fandi Bahtiar Rifai' },
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

  it('returns undefined when no unique personal row exists', () => {
    expect(matchTeamLeaderToAgent('Unknown TL', officialTls)).toBeUndefined();
    expect(matchTeamLeaderToAgent('', officialTls)).toBeUndefined();
  });
});
