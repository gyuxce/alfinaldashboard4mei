export const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export type TeamMemberStats = {
  manDays: number;
  productivityTotal: number;
  qaScoreSum: number;
  qaScoreCount: number;
  csatGood: number;
  csatBad: number;
};

export type TeamLeaderStats = {
  agentCount: number;
  /** Standard period duty — every TL shares one Target Call in the sheet. */
  duty: number;
  /** Per-agent average chats — the TL's Total Call in the official sheet. */
  avgChat: number;
  qaPct: number | null;
  csatGood: number;
  csatBad: number;
  csatPct: number | null;
};

/**
 * The official sheet gives every leader the same Target Call (2300 = 23 x 100)
 * regardless of team size, so a TL is measured against the period's standard
 * duty rather than their team's average attendance. Use the most common
 * man-days across the roster, which is that standard working-day count.
 */
export const getStandardPeriodDuty = (manDaysPerAgent: number[]): number => {
  const counts = new Map<number, number>();
  manDaysPerAgent.forEach((manDays) => {
    if (manDays > 0) counts.set(manDays, (counts.get(manDays) || 0) + 1);
  });
  if (counts.size === 0) return 0;

  let standardDuty = 0;
  let highestCount = 0;
  counts.forEach((count, manDays) => {
    if (count > highestCount || (count === highestCount && manDays > standardDuty)) {
      standardDuty = manDays;
      highestCount = count;
    }
  });
  return standardDuty;
};

/**
 * Team Leaders are scored on the per-agent average output of their team,
 * against the standard period target (duty x 100).
 */
export const aggregateTeamLeaderStats = (
  team: TeamMemberStats[],
  standardDuty: number,
): TeamLeaderStats | null => {
  const agentCount = team.length;
  if (agentCount === 0) return null;

  const totals = team.reduce(
    (acc, member) => {
      acc.chat += member.productivityTotal;
      acc.qaSum += member.qaScoreSum;
      acc.qaCount += member.qaScoreCount;
      acc.csatGood += member.csatGood;
      acc.csatBad += member.csatBad;
      return acc;
    },
    { chat: 0, qaSum: 0, qaCount: 0, csatGood: 0, csatBad: 0 },
  );

  const csatTotal = totals.csatGood + totals.csatBad;

  return {
    agentCount,
    duty: standardDuty,
    avgChat: totals.chat / agentCount,
    qaPct: totals.qaCount > 0 ? totals.qaSum / totals.qaCount : null,
    csatGood: totals.csatGood,
    csatBad: totals.csatBad,
    csatPct: csatTotal > 0 ? (totals.csatGood / csatTotal) * 100 : null,
  };
};
