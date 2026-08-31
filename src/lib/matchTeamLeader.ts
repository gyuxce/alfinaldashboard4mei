export const normalizeAgentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

/** Map roster TL label ("Gagas", "Yuge") to that TL's personal agent row. */
export const matchTeamLeaderToAgent = <T extends { name: string }>(
  tlName: string,
  rows: T[],
): T | undefined => {
  const tl = normalizeAgentName(tlName);
  if (!tl) return undefined;

  const exact = rows.find((row) => normalizeAgentName(row.name) === tl);
  if (exact) return exact;

  const wordMatches = rows.filter((row) => {
    const name = normalizeAgentName(row.name);
    const parts = name.split(" ");
    return parts.includes(tl) || name.startsWith(`${tl} `);
  });
  if (wordMatches.length === 1) return wordMatches[0];
  if (wordMatches.length > 1) {
    return (
      wordMatches.find((row) => normalizeAgentName(row.name).startsWith(`${tl} `)) ||
      wordMatches[0]
    );
  }

  // Nickname like roster "Yuge" vs CSID "Yuga Giri Purboyo"
  const loose = rows.filter((row) => {
    const first = normalizeAgentName(row.name).split(" ")[0] || "";
    if (first.length < 3 || tl.length < 3) return false;
    if (Math.abs(first.length - tl.length) > 1) return false;
    return first.slice(0, 3) === tl.slice(0, 3);
  });
  return loose.length === 1 ? loose[0] : undefined;
};
