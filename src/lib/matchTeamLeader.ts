export const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const stripTlLabel = (value: string) =>
  normalizeAgentName(value)
    .replace(/^(tl|team leader)\s*[:.\-]?\s*/, "")
    .replace(/\s*\(tl\)$/, "");

export type TeamLeaderMatchable = {
  name: string;
  csId?: string;
  manDays?: number;
  productivityTotal?: number;
};

const scoreNameMatch = (tl: string, row: TeamLeaderMatchable): number => {
  const name = normalizeAgentName(row.name || "");
  const csId = String(row.csId || "").trim().toLowerCase();
  if (csId && csId === tl) return 100;
  if (!name) return 0;
  if (name === tl) return 90;
  if (name.startsWith(`${tl} `)) return 80;

  const nameParts = name.split(" ").filter(Boolean);
  const tlParts = tl.split(" ").filter(Boolean);
  if (tlParts.length > 1 && tlParts.every((part) => nameParts.includes(part))) return 75;
  if (tlParts.length === 1 && nameParts.includes(tlParts[0])) return 70;

  const first = nameParts[0] || "";
  const tlFirst = tlParts[0] || "";
  if (first.length >= 3 && tlFirst.length >= 3) {
    const prefix = Math.min(3, first.length, tlFirst.length);
    if (
      first.slice(0, prefix) === tlFirst.slice(0, prefix) &&
      Math.abs(first.length - tlFirst.length) <= 2
    ) {
      return 40;
    }
  }
  return 0;
};

/** Map roster TL label ("Gagas", "Yuge") to that TL's personal agent row. */
export const matchTeamLeaderToAgent = <T extends TeamLeaderMatchable>(
  tlName: string,
  rows: T[],
): T | undefined => {
  const tl = stripTlLabel(tlName);
  if (!tl) return undefined;

  const ranked = rows
    .map((row) => ({
      row,
      rank: scoreNameMatch(tl, { ...row, name: row.name || row.csId || "" }),
      prod: row.productivityTotal || 0,
      duty: row.manDays || 0,
    }))
    .filter((item) => item.rank > 0)
    .sort((a, b) => b.rank - a.rank || b.prod - a.prod || b.duty - a.duty);

  return ranked[0]?.row;
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
