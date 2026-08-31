import { describe, expect, it } from 'vitest';
import { aggregateTeamLeaderStats, type TeamMemberStats } from '../teamLeaderRows';

const member = (
  manDays: number,
  productivityTotal: number,
  extra: Partial<TeamMemberStats> = {},
): TeamMemberStats => ({
  manDays,
  productivityTotal,
  qaScoreSum: 0,
  qaScoreCount: 0,
  csatGood: 0,
  csatBad: 0,
  ...extra,
});

const productivityColumns = (avgChat: number, avgDuty: number) => {
  const targetChat = avgDuty * 100;
  const points = targetChat > 0 ? (avgChat / targetChat) * 20 : null;
  const finalPoints = points !== null ? Math.min(points, 20) : null;
  return { targetChat, points, finalPoints };
};

describe('aggregateTeamLeaderStats', () => {
  it('reports the per-agent average duty and chat', () => {
    // Gagas: 5 agents averaging 23 duty and 2291 chats.
    const team = [
      member(23, 2300),
      member(23, 2280),
      member(23, 2291),
      member(23, 2305),
      member(23, 2279),
    ];
    const stats = aggregateTeamLeaderStats(team);

    expect(stats?.agentCount).toBe(5);
    expect(stats?.avgDuty).toBe(23);
    expect(stats?.avgChat).toBe(2291);

    const prod = productivityColumns(stats!.avgChat, stats!.avgDuty);
    expect(prod.targetChat).toBe(2300);
    expect(prod.points).toBeCloseTo(19.92, 2);
    expect(prod.finalPoints).toBeCloseTo(19.92, 2);
  });

  it('caps final points at 20 while keeping raw points above target', () => {
    // Yuge: average 2333 chats against a 2300 target.
    const stats = aggregateTeamLeaderStats([member(23, 2333)]);
    const prod = productivityColumns(stats!.avgChat, stats!.avgDuty);

    expect(prod.points).toBeCloseTo(20.29, 2);
    expect(prod.finalPoints).toBe(20);
    expect(Math.round(prod.points! - prod.finalPoints!)).toBe(0);
  });

  it('weights QA by the number of audited chats and sums CSAT counts', () => {
    const stats = aggregateTeamLeaderStats([
      member(23, 2000, { qaScoreSum: 190, qaScoreCount: 2, csatGood: 8, csatBad: 2 }),
      member(23, 2000, { qaScoreSum: 100, qaScoreCount: 1, csatGood: 2, csatBad: 0 }),
    ]);

    expect(stats?.qaPct).toBeCloseTo(96.67, 2);
    expect(stats?.csatGood).toBe(10);
    expect(stats?.csatBad).toBe(2);
    expect(stats?.csatPct).toBeCloseTo(83.33, 2);
  });

  it('returns null KPIs when the team has no QA or CSAT data', () => {
    const stats = aggregateTeamLeaderStats([member(23, 2000)]);
    expect(stats?.qaPct).toBeNull();
    expect(stats?.csatPct).toBeNull();
  });

  it('returns null for an empty team', () => {
    expect(aggregateTeamLeaderStats([])).toBeNull();
  });
});
