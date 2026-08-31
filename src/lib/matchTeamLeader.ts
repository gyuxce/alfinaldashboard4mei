export const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export type TeamLeaderMatchable = {
  name: string;
  csId?: string;
  manDays?: number;
  productivityTotal?: number;
};

const displayName = (row: TeamLeaderMatchable) =>
  normalizeAgentName(row.name || row.csId || "");

const pickMostProductive = <T extends TeamLeaderMatchable>(rows: T[]): T =>
  [...rows].sort(
    (a, b) =>
      (b.productivityTotal || 0) - (a.productivityTotal || 0) ||
      (b.manDays || 0) - (a.manDays || 0),
  )[0];

/**
 * Find the TL's personal agent row from the short roster label used on the
 * dashboard ("Gagas", "Yuge"). Exact name match only — do not fuzzy-map
 * nicknames onto different first names (Yuge is not Yuga).
 */
export const matchTeamLeaderToAgent = <T extends TeamLeaderMatchable>(
  tlName: string,
  rows: T[],
): T | undefined => {
  const tl = normalizeAgentName(tlName);
  if (!tl) return undefined;

  const exact = rows.filter((row) => displayName(row) === tl);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return pickMostProductive(exact);

  // Same first word only, e.g. roster "Gagas" and CSID "Gagas Bayu Krisnha".
  const firstWord = rows.filter((row) => displayName(row).startsWith(`${tl} `));
  if (firstWord.length === 1) return firstWord[0];
  if (firstWord.length > 1) return pickMostProductive(firstWord);

  return undefined;
};

export const resolveTeamLeaderAgent = <T extends TeamLeaderMatchable>(
  tlName: string,
  agents: T[],
  roster?: Record<string, { name: string }>,
): T | undefined => {
  const fromAgents = matchTeamLeaderToAgent(tlName, agents);
  if (fromAgents) return fromAgents;

  if (!roster) return undefined;
  const dictEntries = Object.entries(roster).map(([csId, info]) => ({
    csId,
    name: info.name,
  }));
  const dictHit = matchTeamLeaderToAgent(tlName, dictEntries);
  if (!dictHit?.csId) return undefined;
  return agents.find((agent) => agent.csId === dictHit.csId);
};
