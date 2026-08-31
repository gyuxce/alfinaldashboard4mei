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
  /** Per-agent average duty — the TL's Total Duty in the official sheet. */
  avgDuty: number;
  /** Per-agent average chats — the TL's Total Chat in the official sheet. */
  avgChat: number;
  qaPct: number | null;
  csatGood: number;
  csatBad: number;
  csatPct: number | null;
};

/**
 * Team Leaders do not handle chats themselves, so the official sheet scores
 * them on the per-agent average of their team against the same personal
 * target (duty x 100).
 */
export const aggregateTeamLeaderStats = (
  team: TeamMemberStats[],
): TeamLeaderStats | null => {
  const agentCount = team.length;
  if (agentCount === 0) return null;

  const totals = team.reduce(
    (acc, member) => {
      acc.duty += member.manDays;
      acc.chat += member.productivityTotal;
      acc.qaSum += member.qaScoreSum;
      acc.qaCount += member.qaScoreCount;
      acc.csatGood += member.csatGood;
      acc.csatBad += member.csatBad;
      return acc;
    },
    { duty: 0, chat: 0, qaSum: 0, qaCount: 0, csatGood: 0, csatBad: 0 },
  );

  const csatTotal = totals.csatGood + totals.csatBad;

  return {
    agentCount,
    avgDuty: totals.duty / agentCount,
    avgChat: totals.chat / agentCount,
    qaPct: totals.qaCount > 0 ? totals.qaSum / totals.qaCount : null,
    csatGood: totals.csatGood,
    csatBad: totals.csatBad,
    csatPct: csatTotal > 0 ? (totals.csatGood / csatTotal) * 100 : null,
  };
};
