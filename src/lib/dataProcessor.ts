import {
  cell,
  findLegacyCsIdIndex,
  isLegacyCsId,
  pickColumn,
  resolveCsatScColumns,
  resolveProductivityColumns,
  resolveQaColumns,
  resolveRowCsId,
  resolveScheduleIdentityColumns,
  resolveSlaColumns,
} from './sheetHeaders';

export interface CSATEntry {
  date: string;
  normDate?: string | null;
  ticketId: string;
  chatId: string;
  uid: string;
  score: number;
  category: string;
  response: string;
  isTakeout: boolean;
  rcaAgent?: string;
  rcaCustomer?: string;
  rcaAkulaku?: string;
  agentName?: string;
  csId?: string;
}

export interface QAEntry {
  date: string;
  normDate?: string | null;
  systemCheckingType?: string;
  ticketId: string;
  chatId?: string;
  uid?: string;
  qcName?: string;
  caseDate?: string;
  mistakeLevel: string;
  category: string;
  remarks: string;
  deduction: number;
  score: number;
  hasScore?: boolean;
  feedback: string;
  crmKode?: string;
}

export interface HistoryEntry {
  date: string;
  normDate?: string | null;
  value: number;
  count?: number;
  sum?: number;
}

export const CSAT_TAKEOUT_CATEGORIES = [
  "tidak bisa transaksi namun memiliki limit",
  "pengajuan limit kredit ditolak",
  "pertanyaan belum bisa diidentifikasi",
] as const;

const normalizeCsatCategory = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

export const isCsatTakeoutCategory = (category: unknown) =>
  CSAT_TAKEOUT_CATEGORIES.includes(
    normalizeCsatCategory(category) as (typeof CSAT_TAKEOUT_CATEGORIES)[number],
  );

export const isValidCsatScScore = (score: number) =>
  score === 1 || score === 2 || score === 4 || score === 5;

export interface AgentKPI {
  csId: string;
  name: string;
  bpo: string;
  teamLeader: string;
  productivityBase: number;
  productivityTotal: number;
  productivityAverage: number;
  manDays: number;
  targetQuota: number;
  gap: number;
  csatRespondents: number;
  csat5Count: number;
  csat4Count: number;
  csat3Count: number;
  csat2Count: number;
  csat1Count: number;

  attendanceDuty: number;
  attendancePresence: number;
  attendanceOff: number;
  attendanceS: number;
  attendanceC: number;
  attendancePullout: number;
  attendanceTotalDays: number;
  attendanceScore: number;

  csatAsli: number | null;
  whu: number | null;

  csatScFullScore: number;
  csatScFullCount: number;
  csatScGoodCount: number;
  csatScBadCount: number;
  csatScTotalValid: number;
  csatScFull: number | null;

  csatScFairScore: number;
  csatScFairCount: number;
  csatScFairGoodCount: number;
  csatScFairBadCount: number;
  csatScFairTotalValid: number;
  csatScFair: number | null;

  csatScCategoriesFull: Record<string, number>;
  csatScCategoriesFair: Record<string, number>;
  csatScScoreDistribution: Record<string, Record<string, number>>;

  csatScBadScoreFullCount: number;
  csatScBadScoreFairCount: number;

  // RCA (Root Cause Analysis)
  rcaAgentAreaCounts: Record<string, number>;
  rcaCustomerAreaCounts: Record<string, number>;
  rcaAkulakuProcessCounts: Record<string, number>;
  rcaTotalCases: number;

  sla1m: number | null;
  sla3m: number | null;
  sla1mCount: number;
  sla3mCount: number;

  qaScoreSum: number;
  qaScoreCount: number;
  qaHistory: QAEntry[];
  csatHistory: CSATEntry[];
  hourlyProductivity: number[];
  hourlyCategoryCounts: Record<string, number>[];
  dailyHistory: {
    productivity: HistoryEntry[];
    csat: HistoryEntry[];
    csatScFull: { date: string; normDate?: string | null; score: number; count: number }[];
    csatScFair: { date: string; normDate?: string | null; score: number; count: number }[];
    sla1m: HistoryEntry[];
    sla3m: HistoryEntry[];
    whu: HistoryEntry[];
    schedule: {
      date: string;
      status: string;
      isManDay: boolean;
      normDate: string | null;
    }[];
  };
}

export interface AgentScopeFilters {
  bpo?: string;
  teamLeader?: string;
  agent?: string;
}

const PERIOD_MONTH_CODES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const normalizeScopeValue = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ").toUpperCase();

/**
 * Keep standalone BPOs distinct from the shared TCID × TIN roster.
 * Source sheets use a few separators (`x`, `×`, `&`, `/`), so normalize
 * them into one canonical combined value before strict scope comparison.
 */
const normalizeBpoScope = (value: unknown) => {
  const normalized = normalizeScopeValue(value)
    .replace(/[×&/+]/g, " X ")
    .replace(/\s*X\s*/g, " X ")
    .trim();
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (tokens.has("TCID") && tokens.has("TIN")) return "TCID X TIN";
  return normalized;
};

const matchesScopePersonName = (left: unknown, right: unknown) => {
  const leftValue = normalizeScopeValue(left);
  const rightValue = normalizeScopeValue(right);
  if (!leftValue || !rightValue) return false;
  if (leftValue === rightValue) return true;

  const leftParts = leftValue.split(" ");
  const rightParts = rightValue.split(" ");
  return (leftParts.length === 1 && rightParts.includes(leftParts[0]))
    || (rightParts.length === 1 && leftParts.includes(rightParts[0]));
};

const isAllScopeValue = (value: unknown, allValues: string[]) => {
  const normalized = normalizeScopeValue(value);
  return !normalized || allValues.includes(normalized);
};

export const matchesAgentScope = (
  agent: Pick<AgentKPI, "bpo" | "teamLeader" | "name" | "csId">,
  filters: AgentScopeFilters,
) => {
  const selectedBpo = normalizeBpoScope(filters.bpo);
  const selectedTeamLeader = normalizeScopeValue(filters.teamLeader);
  const selectedAgent = normalizeScopeValue(filters.agent);

  const bpoMatches = isAllScopeValue(filters.bpo, ["ALL BPO"])
    || normalizeBpoScope(agent.bpo) === selectedBpo;
  const teamLeaderMatches = isAllScopeValue(filters.teamLeader, ["ALL TL", "ALL TEAM LEADERS"])
    || matchesScopePersonName(agent.teamLeader, selectedTeamLeader);
  const agentMatches = isAllScopeValue(filters.agent, ["ALL AGENTS"])
    || normalizeScopeValue(agent.name) === selectedAgent
    || normalizeScopeValue(agent.csId) === selectedAgent;

  return bpoMatches && teamLeaderMatches && agentMatches;
};

export const getAgentDictionaryForPeriod = (
  periodStart: string | undefined,
  fallbackDictionary?: Record<string, { name: string; bpo: string; teamLeader: string }>,
  dictionariesByMonth?: Record<string, Record<string, { name: string; bpo: string; teamLeader: string }>>,
) => {
  if (!dictionariesByMonth || Object.keys(dictionariesByMonth).length === 0) {
    return fallbackDictionary;
  }

  const [year, month] = String(periodStart || "").split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return fallbackDictionary;

  const monthKey = `${PERIOD_MONTH_CODES[month - 1]}_${year}`;
  return (
    dictionariesByMonth[monthKey]
    || (monthKey === "MAY_2026" ? dictionariesByMonth.legacy : undefined)
    || fallbackDictionary
  );
};

export const applyAgentRoster = (
  agents: AgentKPI[],
  roster?: Record<string, { name: string; bpo: string; teamLeader: string }>,
) => agents.map((agent) => {
  const rosterInfo = roster?.[agent.csId] || roster?.[String(agent.csId || "").trim()];
  if (!rosterInfo) return agent;

  return {
    ...agent,
    name: rosterInfo.name || agent.name,
    bpo: rosterInfo.bpo || agent.bpo,
    teamLeader: rosterInfo.teamLeader || agent.teamLeader,
  };
});

const normalizeQaIdentifier = (value: unknown) =>
  String(value || "").trim().toLowerCase();

export const isBadCsatQaEntry = (entry: Pick<QAEntry, "systemCheckingType" | "mistakeLevel">) => {
  const checkingType = normalizeQaIdentifier(entry.systemCheckingType).toUpperCase();
  const mistakeLevel = normalizeQaIdentifier(entry.mistakeLevel).toUpperCase();

  return (
    checkingType === "CSAT" &&
    mistakeLevel !== "" &&
    !mistakeLevel.includes("NO MISTAKE")
  );
};

export const getCsatBadRatingCount = (agent: Pick<AgentKPI, "qaHistory">) => {
  const seenCases = new Set<string>();

  return agent.qaHistory.reduce((count, entry) => {
    if (!isBadCsatQaEntry(entry)) return count;

    const primaryCaseId = [entry.ticketId, entry.chatId, entry.uid, entry.caseDate]
      .map(normalizeQaIdentifier)
      .find(Boolean);
    const fallbackCaseId = [
      entry.normDate || entry.date,
      entry.qcName,
      entry.mistakeLevel,
      entry.category,
    ].map(normalizeQaIdentifier).join("|");
    const caseKey = primaryCaseId || fallbackCaseId;

    if (seenCases.has(caseKey)) return count;
    seenCases.add(caseKey);
    return count + 1;
  }, 0);
};

export const getOfficialCsatAggregate = (data: AgentKPI[]) => {
  let points = 0;
  let respondents = 0;

  data.forEach((agent) => {
    points +=
      agent.csat5Count * 5 +
      agent.csat4Count * 4 +
      agent.csat3Count * 3 +
      agent.csat2Count * 2 +
      agent.csat1Count;
    respondents += agent.csatRespondents;
  });

  return {
    points,
    respondents,
    score: respondents > 0 ? points / respondents : null,
  };
};

// Helpers
export function getPreviousPeriod(startDate: string, endDate: string) {
  if (!startDate || !endDate) return { start: '', end: '' };
  const toLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const start = toLocalDate(startDate);
  const end = toLocalDate(endDate);
  
  // Calculate duration in days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffDays + 1);
  
  return {
    start: toIsoDate(prevStart),
    end: toIsoDate(prevEnd)
  };
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getPreviousMonthDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const previousMonthLastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, previousMonthLastDay));
}

export function getPreviousMonthPeriod(startDate: string, endDate: string) {
  if (!startDate || !endDate) return { start: '', end: '' };

  return {
    start: toIsoDate(getPreviousMonthDate(new Date(startDate))),
    end: toIsoDate(getPreviousMonthDate(new Date(endDate))),
  };
}

/** Full previous calendar month relative to a YYYY-MM-DD reference (used by incentive simulation). */
export function getPreviousCalendarMonthRange(referenceDate: string) {
  if (!referenceDate) return { start: '', end: '' };
  const [yearValue, monthValue] = referenceDate.split('-').map(Number);
  const year = yearValue || new Date().getFullYear();
  const month = monthValue || new Date().getMonth() + 1;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(previousYear, previousMonth, 0).getDate();

  return {
    start: `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`,
    end: `${previousYear}-${String(previousMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

const dateStrCache = new Map<string, string | null>();

export function normalizeDateStr(raw: string): string | null {
  if (!raw) return null;
  const rawKey = String(raw).trim();
  if (dateStrCache.has(rawKey))
    return dateStrCache.get(rawKey) as string | null;

  let result: string | null = null;

  // Try to parse DD MMM YYYY or DD-MMM-YYYY
  const dashMatch = rawKey.match(
    /^(\d{1,2})[-\s]([A-Za-z]+)(?:[-\s](\d{4}))?$/,
  );
  if (dashMatch) {
    const [, day, monthStr, yearStr] = dashMatch;
    const monthMap: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      agu: 8, // id-ID short (Intl)
      sep: 9,
      oct: 10,
      okt: 10, // id-ID short
      nov: 11,
      dec: 12,
      des: 12, // id-ID short
      januari: 1,
      februari: 2,
      maret: 3,
      april: 4,
      mei: 5,
      juni: 6,
      juli: 7,
      agustus: 8,
      september: 9,
      oktober: 10,
      november: 11,
      desember: 12,
    };
    let mNum = monthMap[monthStr.toLowerCase()];
    if (mNum === undefined) {
      for (const [k, v] of Object.entries(monthMap)) {
        if (monthStr.toLowerCase().startsWith(k)) {
          mNum = v;
          break;
        }
      }
    }
    if (mNum !== undefined) {
      const y = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
      result = `${y}-${String(mNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  if (!result) {
    const clean = rawKey.split(" ")[0]; // Take only the date part if there's time
    const parts = clean.split(/[-/]/);

    if (parts.length >= 3) {
      let y = 0,
        m = 0,
        d = 0;
      if (parts[2].length === 4) {
        // Could be DD/MM/YYYY or MM/DD/YYYY
        y = parseInt(parts[2], 10);
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        if (p1 > 12) {
          d = p1;
          m = p2;
        } else if (p2 > 12) {
          m = p1;
          d = p2;
        } else {
          d = p1;
          m = p2;
        }
      } else if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
      }

      if (y > 0 && m > 0 && d > 0 && m <= 12 && d <= 31) {
        result = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }

    // Fallback to JS Date parser (use local Y-M-D to avoid UTC off-by-one)
    if (!result) {
      const dObj = new Date(clean);
      if (!isNaN(dObj.getTime())) {
        result = formatDateLocalYmd(dObj);
      }
    }
  }

  // Final fallback
  if (!result) {
    const dObj2 = new Date(rawKey);
    if (!isNaN(dObj2.getTime())) {
      result = formatDateLocalYmd(dObj2);
    }
  }

  dateStrCache.set(rawKey, result);
  return result;
}

function formatDateLocalYmd(dObj: Date): string {
  return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
}

/** Shift duty / man-day: numeric shift code, HH:MM time, or S (sakit). */
export function isScheduleManDay(statusRaw: string): boolean {
  const status = String(statusRaw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!status) return false;
  if (status === "S") return true;
  if (status === "OFF" || status === "C" || status === "PULLOUT") return false;
  // Pure shift number: 7, 14, 22, 8.0, etc.
  if (/^\d+([.,]\d+)?$/.test(status)) return true;
  // Time-format shift: 07:00, 22:00
  if (/^\d{1,2}:\d{2}/.test(status)) return true;
  return false;
}

export function normalizeScheduleStatus(statusRaw: string): string {
  const status = String(statusRaw || "").trim().toUpperCase();
  if (status.replace(/\s+/g, "") === "PULLOUT") return "PULLOUT";
  return status;
}

function readStarCount(row: unknown[] | undefined, index: number) {
  const raw = cell(row, index);
  if (!raw || isLegacyCsId(raw)) return 0;
  return parseFloat(raw.replace(",", ".")) || 0;
}

function transactionKey(parts: Array<string | number | null | undefined>) {
  const ticket = String(parts[0] || "").trim();
  if (ticket) return `ticket:${ticket.toLowerCase()}`;
  return parts.map((part) => String(part || "").trim().toLowerCase()).join("|");
}

function productivityDataStartRow(data: any[][]) {
  if (data.length <= 1) return data.length;
  const probe = data[1] || [];
  const looksLikeData =
    findLegacyCsIdIndex(probe) >= 0 || !!normalizeDateStr(String(probe[0] || ""));
  return looksLikeData ? 1 : 2;
}

export const processKPIs = (
  prodData: any[][] = [],
  csatData: any[][] = [],
  slaData: any[][] = [],
  schedData: any[][] = [],
  qaData: any[][] = [],
  startDate?: string,
  endDate?: string,
  agentDictionary?: Record<
    string,
    { name: string; bpo: string; teamLeader: string }
  >,
  agentDictionaryByMonth?: Record<
    string,
    Record<string, { name: string; bpo: string; teamLeader: string }>
  >,
): AgentKPI[] => {
  const agents: Record<string, AgentKPI> = {};

  const periodDictionary = getAgentDictionaryForPeriod(
    startDate || endDate,
    agentDictionary,
    agentDictionaryByMonth,
  );

  const isWithin = (dStr: string | null) => {
    if (!startDate && !endDate) return true;
    // Never let a malformed date silently pollute every selected period.
    if (!dStr) return false;
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  const subtractOneDay = (dStr: string) => {
    const parts = dStr.split("-").map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) return dStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    return toIsoDate(d);
  };

  // Keep schedule lookup available even when the previous calendar day is
  // outside the selected KPI range. This matters for overnight shift 22 data
  // landing after midnight on the first day of a period.
  const scheduleStatusByAgentDate = new Map<string, string>();
  const scheduleDateLabelByAgentDate = new Map<string, string>();
  const getScheduleKey = (agentId: string, normDate: string) =>
    `${agentId}|${normDate}`;

  const isShift22Status = (statusRaw: string) => {
    const status = String(statusRaw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(",", ".");
    return status === "22" || status === "22.0" || status === "22:00" || status === "22:00:00";
  };

  const extractTimestampHour = (rawTimestamp: unknown) => {
    const match = String(rawTimestamp || "").match(
      /(?:^|[T\s])(\d{1,2}):\d{2}(?::\d{2})?/,
    );
    if (!match) return -1;

    const hour = Number(match[1]);
    return hour >= 0 && hour < 24 ? hour : -1;
  };

  const getShiftAdjustedDate = (
    agentId: string,
    normDate: string | null,
    hour: number,
  ) => {
    if (!normDate || hour < 0 || hour >= 7) return normDate;

    const previousDate = subtractOneDay(normDate);
    const previousStatus = scheduleStatusByAgentDate.get(
      getScheduleKey(agentId, previousDate),
    );

    return previousStatus && isShift22Status(previousStatus)
      ? previousDate
      : normDate;
  };

  const getScheduleDateLabel = (agentId: string, normDate: string | null) => {
    if (!normDate) return "";

    const scheduleLabel = scheduleDateLabelByAgentDate.get(
      getScheduleKey(agentId, normDate),
    );
    if (scheduleLabel) return scheduleLabel;

    const parts = normDate.split("-");
    return parts.length === 3
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : normDate;
  };

  const getAgent = (id: string) => {
    const cleanId = String(id || "").trim();
    if (
      !cleanId ||
      cleanId === "0" ||
      cleanId === "-" ||
      cleanId.toLowerCase() === "total" ||
      cleanId.toLowerCase() === "currentaccount" ||
      cleanId.toLowerCase() === "cs id"
    )
      return null;
    if (!agents[cleanId]) {
      const dictInfo = periodDictionary?.[cleanId] || {
        name: "",
        bpo: "",
        teamLeader: "",
      };
      agents[cleanId] = {
        csId: cleanId,
        name: dictInfo.name,
        bpo: dictInfo.bpo,
        teamLeader: dictInfo.teamLeader,
        productivityBase: 0,
        productivityTotal: 0,
        productivityAverage: 0,
        targetQuota: 0,
        gap: 0,
        csatRespondents: 0,
        csat5Count: 0,
        csat4Count: 0,
        csat3Count: 0,
        csat2Count: 0,
        csat1Count: 0,
        attendanceDuty: 0,
        attendancePresence: 0,
        attendanceOff: 0,
        attendanceS: 0,
        attendanceC: 0,
        attendancePullout: 0,
        attendanceTotalDays: 0,
        attendanceScore: 0,
        manDays: 0,
        csatAsli: null,
        whu: null,
        csatScFullScore: 0,
        csatScFullCount: 0,
        csatScGoodCount: 0,
        csatScBadCount: 0,
        csatScTotalValid: 0,
        csatScFull: null,
        csatScFairScore: 0,
        csatScFairCount: 0,
        csatScFairGoodCount: 0,
        csatScFairBadCount: 0,
        csatScFairTotalValid: 0,
        csatScFair: null,
        csatScCategoriesFull: {},
        csatScCategoriesFair: {},
        csatScScoreDistribution: {
          "No Survey": {},
          "1": {},
          "2": {},
          "3": {},
          "4": {},
          "5": {},
        },
        csatScBadScoreFullCount: 0,
        csatScBadScoreFairCount: 0,
        rcaAgentAreaCounts: {},
        rcaCustomerAreaCounts: {},
        rcaAkulakuProcessCounts: {},
        rcaTotalCases: 0,
        sla1m: null,
        sla3m: null,
        sla1mCount: 0,
        sla3mCount: 0,
        qaScoreSum: 0,
        qaScoreCount: 0,
        qaHistory: [],
        csatHistory: [],
        hourlyProductivity: new Array(24).fill(0),
        hourlyCategoryCounts: Array.from({ length: 24 }, () => ({})),
        dailyHistory: {
          productivity: [],
          csat: [],
          csatScFull: [],
          csatScFair: [],
          sla1m: [],
          sla3m: [],
          whu: [],
          schedule: [],
        },
      };
    }
    return agents[cleanId];
  };

  if (periodDictionary) {
    Object.keys(periodDictionary).forEach((csId) => {
      getAgent(csId);
    });
  }

  const scheduleColumns = resolveScheduleIdentityColumns(schedData[0] || []);

  if (schedData.length > 1) {
    const scheduleHeaders = schedData[0] || [];
    for (let c = scheduleColumns.firstDateColumn; c < scheduleHeaders.length; c++) {
      const dateLabel = String(scheduleHeaders[c] || "").trim();
      const normDate = dateLabel ? normalizeDateStr(dateLabel) : null;
      if (!normDate) continue;

      for (let r = 1; r < schedData.length; r++) {
        const row = schedData[r];
        const agentId = cell(row, scheduleColumns.csId);
        if (!agentId) continue;

        const status = String(row?.[c] || "").trim().toUpperCase();
        if (!status) continue;

        const key = getScheduleKey(agentId, normDate);
        scheduleStatusByAgentDate.set(key, status);
        scheduleDateLabelByAgentDate.set(key, dateLabel);
      }
    }
  }

  // 0. Schedule Logic
  if (schedData.length > 1) {
    const headers = schedData[0] || [];
    // Date columns start after identity fields (CS ID / Name / TL / BPO).
    for (let c = scheduleColumns.firstDateColumn; c < headers.length; c++) {
      const hd = String(headers[c]).trim();
      if (!hd) continue;

      const normDate = normalizeDateStr(hd);
      // Skip non-date headers and out-of-range dates (avoids ±1 man-day drift)
      if (!normDate || !isWithin(normDate)) continue;

      for (let r = 1; r < schedData.length; r++) {
        const row = schedData[r];
        if (!row) continue;
        const agentId = cell(row, scheduleColumns.csId);
        const agent = getAgent(agentId);
        if (!agent) continue;

        const schedName = cell(row, scheduleColumns.name);
        const schedTL = cell(row, scheduleColumns.teamLeader);
        const schedBPO = cell(row, scheduleColumns.bpo);

        if (schedName && !agent.name) agent.name = schedName;
        if (schedTL && !agent.teamLeader) agent.teamLeader = schedTL;
        if (schedBPO && !agent.bpo) agent.bpo = schedBPO;

        const statusRaw = String(row[c] || "").trim();
        if (!statusRaw) continue;

        const normalizedStatus = normalizeScheduleStatus(statusRaw);
        const isManDay = isScheduleManDay(statusRaw);
        // Presence = on-shift number/time (not sick) or pullout
        const isPresence =
          normalizedStatus === "PULLOUT" ||
          (isManDay && normalizedStatus !== "S");

        // Dedupe by calendar day (normDate), not raw header string —
        // "1/7/2026" vs "01/07/2026" must count as one man-day.
        const existingSched = agent.dailyHistory.schedule.find(
          (s) => s.normDate === normDate || s.date === hd,
        );

        if (!existingSched) {
          agent.attendanceTotalDays += 1;

          if (isManDay || normalizedStatus === "PULLOUT")
            agent.attendanceDuty += 1;
          if (isPresence) agent.attendancePresence += 1;

          if (normalizedStatus === "OFF") agent.attendanceOff += 1;
          if (normalizedStatus === "S") agent.attendanceS += 1;
          if (normalizedStatus === "C") agent.attendanceC += 1;
          if (normalizedStatus === "PULLOUT") agent.attendancePullout += 1;

          agent.dailyHistory.schedule.push({
            date: hd,
            status: normalizedStatus,
            isManDay,
            normDate,
          });

          if (isManDay) {
            agent.manDays += 1;
          }
          continue;
        }

        // Duplicate header for same calendar day: upgrade non-duty → duty
        if (isManDay && !existingSched.isManDay) {
          const prev = existingSched.status;
          const prevWasDuty = prev === "PULLOUT";

          existingSched.status = normalizedStatus;
          existingSched.isManDay = true;
          existingSched.date = hd;

          agent.manDays += 1;
          if (!prevWasDuty) agent.attendanceDuty += 1;
          if (isPresence) agent.attendancePresence += 1;
          if (normalizedStatus === "S") agent.attendanceS += 1;
          if (prev === "OFF") agent.attendanceOff = Math.max(0, agent.attendanceOff - 1);
          if (prev === "C") agent.attendanceC = Math.max(0, agent.attendanceC - 1);
        }
      }
    }
  }

  // 1. Productivity, CSAT Asli, WHU
  let totalProdCsatAsliSum: Record<string, { sum: number; count: number }> = {};
  let totalWhuSum: Record<string, { sum: number; count: number }> = {};
  const seenProductivityEntries = new Set<string>();
  const prodColumns = resolveProductivityColumns(prodData);
  const prodStartRow = productivityDataStartRow(prodData);

  if (prodData.length > prodStartRow) {
    for (let i = prodStartRow; i < prodData.length; i++) {
      const row = prodData[i];
      if (!row || row.length < 2) continue;

      const resolvedId = resolveRowCsId(row, prodColumns.csId);
      if (!resolvedId.id) continue;
      const idIdx = resolvedId.index;

      const dateIdx = pickColumn(prodColumns.date, idIdx > 0 ? 0 : -1);
      const rawDateStr = cell(row, dateIdx);
      let normDate = rawDateStr ? normalizeDateStr(rawDateStr) : null;
      if (!rawDateStr || !normDate) continue;

      let targetDateLabel = rawDateStr;
      const hour = extractTimestampHour(rawDateStr);

      const agentId = resolvedId.id;
      const agent = getAgent(agentId);
      if (!agent) continue;

      normDate = getShiftAdjustedDate(agentId, normDate, hour);
      targetDateLabel = getScheduleDateLabel(agentId, normDate);

      if (!isWithin(normDate)) continue;

      const prodIdx = pickColumn(prodColumns.productivity, idIdx >= 0 ? idIdx + 8 : -1);
      const csatIdx = pickColumn(prodColumns.csatAsli, idIdx >= 0 ? idIdx + 1 : -1);
      const whuIdx = pickColumn(prodColumns.whu, idIdx >= 0 ? idIdx + 15 : -1);

      const prodBase = parseFloat(cell(row, prodIdx).replace(",", ".")) || 0;
      let csatAsliStr = cell(row, csatIdx);
      let whuStr = cell(row, whuIdx);

      if (csatAsliStr.includes("%")) csatAsliStr = csatAsliStr.replace("%", "");
      csatAsliStr = csatAsliStr.replace(",", ".");

      whuStr = whuStr.replace(",", ".");
      const whuNum = parseFloat(whuStr);

      const dVal = readStarCount(row, pickColumn(prodColumns.star5, 3));
      const eVal = readStarCount(row, pickColumn(prodColumns.star4, 4));
      const fVal = readStarCount(row, pickColumn(prodColumns.star3, 5));
      const gVal = readStarCount(row, pickColumn(prodColumns.star2, 6));
      const hVal = readStarCount(row, pickColumn(prodColumns.star1, 7));
      // Consecutive monthly exports commonly overlap at period boundaries.
      // Ignore exact repeated source facts before they reach any aggregate.
      const sourceKey = [
        agentId,
        normDate,
        prodBase,
        csatAsliStr,
        whuStr,
        dVal,
        eVal,
        fVal,
        gVal,
        hVal,
      ].join("|");
      if (seenProductivityEntries.has(sourceKey)) continue;
      seenProductivityEntries.add(sourceKey);
      const totalRes = dVal + eVal + fVal + gVal + hVal;

      agent.csatRespondents += totalRes;
      agent.csat5Count += dVal;
      agent.csat4Count += eVal;
      agent.csat3Count += fVal;
      agent.csat2Count += gVal;
      agent.csat1Count += hVal;

      agent.productivityBase += prodBase;
      let existingProd = agent.dailyHistory.productivity.find(
        (h) => h.normDate === normDate || h.date === targetDateLabel,
      );
      if (existingProd) {
        existingProd.value += prodBase;
        if (!existingProd.normDate) existingProd.normDate = normDate;
      } else {
        agent.dailyHistory.productivity.push({
          date: targetDateLabel,
          normDate,
          value: prodBase,
        });
      }

      const pointsAsli = (dVal * 5) + (eVal * 4) + (fVal * 3) + (gVal * 2) + (hVal * 1);
      const totalResAsli = dVal + eVal + fVal + gVal + hVal;
      
      const csatDaily = totalResAsli > 0 
        ? (pointsAsli / totalResAsli)
        : null;

      if (csatDaily !== null) {
        if (!totalProdCsatAsliSum[agent.csId])
          totalProdCsatAsliSum[agent.csId] = { sum: 0, count: 0 };
        
        // Store sums of points and respondents for overall agent average
        totalProdCsatAsliSum[agent.csId].sum += pointsAsli;
        totalProdCsatAsliSum[agent.csId].count += totalResAsli;

        let existingCsat = agent.dailyHistory.csat.find(
          (h) => h.normDate === normDate || h.date === targetDateLabel,
        );
        if (existingCsat) {
          const existingCount = existingCsat.count || 0;
          const existingSum = existingCsat.sum ?? existingCsat.value * existingCount;
          existingCsat.count = existingCount + totalResAsli;
          existingCsat.sum = existingSum + pointsAsli;
          existingCsat.value = existingCsat.sum / existingCsat.count;
          if (!existingCsat.normDate) existingCsat.normDate = normDate;
        } else {
          agent.dailyHistory.csat.push({
            date: targetDateLabel,
            normDate,
            value: csatDaily,
            count: totalResAsli,
            sum: pointsAsli,
          });
        }
      }

      if (!isNaN(whuNum)) {
        let val = whuNum;
        if (whuStr.includes("%")) {
          val = parseFloat(whuStr.replace("%", ""));
        } else {
          val = whuNum * 100;
        }
        if (!totalWhuSum[agent.csId])
          totalWhuSum[agent.csId] = { sum: 0, count: 0 };
        totalWhuSum[agent.csId].sum += val;
        totalWhuSum[agent.csId].count += 1;

        let existingWhu = agent.dailyHistory.whu.find(
          (h) => h.normDate === normDate || h.date === targetDateLabel,
        );
        if (existingWhu) {
          existingWhu.value = (existingWhu.value + val) / 2;
          if (!existingWhu.normDate) existingWhu.normDate = normDate;
        } else {
          agent.dailyHistory.whu.push({ date: targetDateLabel, normDate, value: val });
        }
      }
    }
  }

  // 2. CSAT SC
  if (csatData.length > 1) {
    const headerRow = csatData[0] || [];
    const csatColumns = resolveCsatScColumns(headerRow);
    const seenCsatScEntries = new Set<string>();
    const seenCsatTickets = new Set<string>();

    for (let i = 1; i < csatData.length; i++) {
      const row = csatData[i];
      if (!row || row.length < 2) continue;

      const resolvedId = resolveRowCsId(row, csatColumns.csId);
      if (!resolvedId.id) continue;
      const idIdx = resolvedId.index;

      const agentId = resolvedId.id;
      const dateIdx = pickColumn(csatColumns.date, idIdx > 0 ? 0 : -1);
      const dateStr = cell(row, dateIdx);
      let normDate = dateStr ? normalizeDateStr(dateStr) : null;
      const timestampIdx = pickColumn(csatColumns.timestamp, 22);
      const timestampStr = cell(row, timestampIdx);
      const hour = extractTimestampHour(timestampStr);
      normDate = getShiftAdjustedDate(agentId, normDate, hour);
      if (dateStr && normDate && !isWithin(normDate)) continue;

      const agent = getAgent(agentId);
      if (!agent) continue;
      const targetDateLabel = dateStr
        ? normDate
          ? getScheduleDateLabel(agentId, normDate)
          : dateStr
        : dateStr;

      const scoreIdx = pickColumn(csatColumns.score, idIdx >= 0 ? idIdx + 11 : -1);
      const categoryIdx = pickColumn(csatColumns.category, idIdx >= 0 ? idIdx + 8 : -1);
      const responseIdx = pickColumn(csatColumns.response, idIdx >= 0 ? idIdx + 15 : -1);
      const ticketIdx = pickColumn(csatColumns.ticketId, idIdx >= 0 ? idIdx + 1 : -1);
      const chatIdx = pickColumn(csatColumns.chatId, idIdx > 0 ? idIdx - 1 : -1);
      const uidIdx = pickColumn(csatColumns.uid, idIdx >= 0 ? idIdx + 5 : -1);

      const scoreStr = cell(row, scoreIdx).replace(",", ".");
      const score = parseFloat(scoreStr);

      const category = cell(row, categoryIdx).toLowerCase();
      const response = cell(row, responseIdx);
      const ticketId = cell(row, ticketIdx);
      const chatId = cell(row, chatIdx);
      const uid = cell(row, uidIdx);

      // Extract hour from timestamp for hourly productivity
      if (timestampStr) {
        if (hour >= 0 && hour < 24) {
             const hr = hour;
             agent.hourlyProductivity[hr] += 1;
             const categoryLabel = category
               ? category.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
               : "Unknown Case";
             agent.hourlyCategoryCounts[hr][categoryLabel] = (agent.hourlyCategoryCounts[hr][categoryLabel] || 0) + 1;
        }
      }

      const rcaAgent = cell(row, csatColumns.rcaAgent);
      const rcaCustomer = cell(row, csatColumns.rcaCustomer);
      const rcaAkulaku = cell(row, csatColumns.rcaAkulaku);

      const csatTicketKey = ticketId
        ? ticketId.toLowerCase()
        : (chatId || uid)
          ? [chatId, uid, normDate || dateStr.trim()].join("|").toLowerCase()
          : "";
      if (csatTicketKey && seenCsatTickets.has(csatTicketKey)) continue;
      if (csatTicketKey) seenCsatTickets.add(csatTicketKey);

      const csatScEntryKey = transactionKey([
        ticketId,
        agentId,
        normDate || dateStr.trim(),
        chatId,
        uid,
        scoreStr,
        category,
        response,
        rcaAgent,
        rcaCustomer,
        rcaAkulaku,
        timestampStr,
      ]);

      if (seenCsatScEntries.has(csatScEntryKey)) continue;
      seenCsatScEntries.add(csatScEntryKey);
      
      const isTakeoutRecord = isCsatTakeoutCategory(category);
      
      if (dateStr) {
         agent.csatHistory.push({
            date: targetDateLabel,
            normDate,
            ticketId,
            chatId,
            uid,
            score: isNaN(score) ? 0 : score,
            category: category.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            response,
            isTakeout: isTakeoutRecord,
            rcaAgent,
            rcaCustomer,
            rcaAkulaku,
            agentName: agent.name,
            csId: agent.csId,
         });
      }

      // Aggregate RCA into agent-level counts
      if (rcaAgent) {
        if (!agent.rcaAgentAreaCounts[rcaAgent]) agent.rcaAgentAreaCounts[rcaAgent] = 0;
        agent.rcaAgentAreaCounts[rcaAgent] += 1;
        agent.rcaTotalCases += 1;
      }
      if (rcaCustomer) {
        if (!agent.rcaCustomerAreaCounts[rcaCustomer]) agent.rcaCustomerAreaCounts[rcaCustomer] = 0;
        agent.rcaCustomerAreaCounts[rcaCustomer] += 1;
        if (!rcaAgent) agent.rcaTotalCases += 1;
      }
      if (rcaAkulaku) {
        if (!agent.rcaAkulakuProcessCounts[rcaAkulaku]) agent.rcaAkulakuProcessCounts[rcaAkulaku] = 0;
        agent.rcaAkulakuProcessCounts[rcaAkulaku] += 1;
        if (!rcaAgent && !rcaCustomer) agent.rcaTotalCases += 1;
      }

      // -- Score Distribution Logic --
      const cleanCatForDist = category
        ? category
            .split(" ")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : "Unknown Case";
      let scoreKey = "No Survey";
      if (!isNaN(score) && score >= 1 && score <= 5) {
        scoreKey = String(score);
      }
      if (!agent.csatScScoreDistribution[scoreKey]) {
        agent.csatScScoreDistribution[scoreKey] = {};
      }
      if (!agent.csatScScoreDistribution[scoreKey][cleanCatForDist]) {
        agent.csatScScoreDistribution[scoreKey][cleanCatForDist] = 0;
      }
      agent.csatScScoreDistribution[scoreKey][cleanCatForDist] += 1;
      // --------------------------------

      if (isValidCsatScScore(score)) {
          // Keep old vars for CsatRoom
          agent.csatScFullScore += score;
          agent.csatScFullCount += 1;

          // New Official Formula
          if (score >= 4) {
            agent.csatScGoodCount += 1;
          } else {
            agent.csatScBadCount += 1;
          }
          agent.csatScTotalValid += 1;


          let fullDay = agent.dailyHistory.csatScFull.find(
            (h) => (normDate && h.normDate === normDate) || h.date === targetDateLabel,
          );
          if (!fullDay) {
            fullDay = { date: targetDateLabel, normDate, score: 0, count: 0 };
            agent.dailyHistory.csatScFull.push(fullDay);
          } else if (!fullDay.normDate && normDate) {
            fullDay.normDate = normDate;
          }
          if (score >= 4) fullDay.score += 1;
          fullDay.count += 1;

          const isTakeout = isCsatTakeoutCategory(category);

          if (!isTakeout) {
            // Keep old vars for CsatRoom
            agent.csatScFairScore += score;
            agent.csatScFairCount += 1;

            // New Official Formula for Fair
            if (score >= 4) {
              agent.csatScFairGoodCount += 1;
            } else {
              agent.csatScFairBadCount += 1;
            }
            agent.csatScFairTotalValid += 1;

            let fairDay = agent.dailyHistory.csatScFair.find(
              (h) => (normDate && h.normDate === normDate) || h.date === targetDateLabel,
            );
            if (!fairDay) {
              fairDay = { date: targetDateLabel, normDate, score: 0, count: 0 };
              agent.dailyHistory.csatScFair.push(fairDay);
            } else if (!fairDay.normDate && normDate) {
              fairDay.normDate = normDate;
            }
            if (score >= 4) fairDay.score += 1; // good count
            fairDay.count += 1; // valid count
          }

          if (score === 1 || score === 2) {
            agent.csatScBadScoreFullCount += 1;
            if (!isTakeout) agent.csatScBadScoreFairCount += 1;

            if (category) {
              const cleanCat = category
                .split(" ")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              if (!agent.csatScCategoriesFull[cleanCat])
                agent.csatScCategoriesFull[cleanCat] = 0;
              agent.csatScCategoriesFull[cleanCat] += 1;

              if (!isTakeout) {
                if (!agent.csatScCategoriesFair[cleanCat])
                  agent.csatScCategoriesFair[cleanCat] = 0;
                agent.csatScCategoriesFair[cleanCat] += 1;
              }
            }
          }
      }
    }
  }

  // 3. SLA (Index starts at 1)
  let sla1mSum: Record<string, { sum: number; count: number }> = {};
  let sla3mSum: Record<string, { sum: number; count: number }> = {};

  if (slaData.length > 1) {
    const seenSlaEntries = new Set<string>();
    const slaColumns = resolveSlaColumns(slaData);
    const seenSlaTickets = new Set<string>();

    for (let i = 1; i < slaData.length; i++) {
      const row = slaData[i];
      if (!row || row.length < 2) continue;

      const resolvedId = resolveRowCsId(row, slaColumns.csId);
      if (!resolvedId.id) continue;
      const idIdx = resolvedId.index;

      const agentId = resolvedId.id;
      const dateIdx = pickColumn(slaColumns.date, idIdx > 0 ? 0 : -1);
      const dateStr = cell(row, dateIdx);
      let normDate = dateStr ? normalizeDateStr(dateStr) : null;
      const hour = extractTimestampHour(dateStr);
      normDate = getShiftAdjustedDate(agentId, normDate, hour);
      if (dateStr && normDate && !isWithin(normDate)) continue;

      const agent = getAgent(agentId);
      if (!agent) continue;
      const targetDateLabel = dateStr
        ? normDate
          ? getScheduleDateLabel(agentId, normDate)
          : dateStr
        : dateStr;

      const parseSla = (val: string) => {
        let clean = val.replace(",", ".").trim();
        if (!clean) return null;
        if (clean.includes("%")) return parseFloat(clean.replace("%", ""));
        const n = parseFloat(clean);
        return isNaN(n) ? null : n * 100;
      };

      const sla1ValueIdx = pickColumn(slaColumns.sla1m, idIdx >= 0 ? idIdx + 11 : -1);
      const sla3ValueIdx = pickColumn(slaColumns.sla3m, idIdx >= 0 ? idIdx + 13 : -1);
      const sla1Raw = cell(row, sla1ValueIdx);
      const sla3Raw = cell(row, sla3ValueIdx);
      const sla1 = parseSla(sla1Raw);
      const sla3 = parseSla(sla3Raw);
      const ticketId = cell(row, slaColumns.ticketId);

      const slaTicketKey = ticketId
        ? ticketId.toLowerCase()
        : '';
      if (slaTicketKey && seenSlaTickets.has(slaTicketKey)) continue;
      if (slaTicketKey) seenSlaTickets.add(slaTicketKey);

      const slaEntryKey = transactionKey([
        ticketId,
        agentId,
        normDate || dateStr.trim(),
        sla1Raw,
        sla3Raw,
      ]);

      if (seenSlaEntries.has(slaEntryKey)) continue;
      seenSlaEntries.add(slaEntryKey);

      if (sla1 !== null && !isNaN(sla1)) {
        if (!sla1mSum[agent.csId]) sla1mSum[agent.csId] = { sum: 0, count: 0 };
        sla1mSum[agent.csId].sum += sla1;
        sla1mSum[agent.csId].count += 1;
        agent.dailyHistory.sla1m.push({ date: targetDateLabel, normDate, value: sla1 });
      }
      if (sla3 !== null && !isNaN(sla3)) {
        if (!sla3mSum[agent.csId]) sla3mSum[agent.csId] = { sum: 0, count: 0 };
        sla3mSum[agent.csId].sum += sla3;
        sla3mSum[agent.csId].count += 1;
        agent.dailyHistory.sla3m.push({ date: targetDateLabel, normDate, value: sla3 });
      }
    }
  }

  // 4. QA Score (Index starts at 1)
  if (qaData.length > 1) {
    const seenQaEntries = new Set<string>();
    const seenQaTickets = new Set<string>();
    const qaColumns = resolveQaColumns(qaData[0] || []);

    for (let i = 1; i < qaData.length; i++) {
      const row = qaData[i];
      if (!row || row.length < 2) continue;

      const resolvedId = resolveRowCsId(row, pickColumn(qaColumns.csId, 0));
      if (!resolvedId.id) continue;
      const agentId = resolvedId.id;

      const dateIdx = pickColumn(qaColumns.date, 13);
      const dateStr = cell(row, dateIdx);
      let normDate = dateStr ? normalizeDateStr(dateStr) : null;
      const hour = extractTimestampHour(dateStr);
      normDate = getShiftAdjustedDate(agentId, normDate, hour);
      if (dateStr && normDate && !isWithin(normDate)) continue;
      const targetDateLabel = dateStr
        ? normDate
          ? getScheduleDateLabel(agentId, normDate)
          : dateStr
        : dateStr;

      const agent = getAgent(agentId);
      if (!agent) continue;

      const ticketId = cell(row, pickColumn(qaColumns.ticketId, 4));
      const uid = cell(row, pickColumn(qaColumns.uid, 5));
      const chatId = cell(row, pickColumn(qaColumns.chatId, 6));
      const caseDate = cell(row, pickColumn(qaColumns.caseDate, 8));
      const systemCheckingType = cell(row, pickColumn(qaColumns.systemCheckingType, 12));
      const qcName = cell(row, pickColumn(qaColumns.qcName, 14));
      const mistakeLevel = cell(row, pickColumn(qaColumns.mistakeLevel, 15));
      const deduction = 0;
      const category = cell(row, pickColumn(qaColumns.category, 30));
      const remarks = cell(row, pickColumn(qaColumns.remarks, 32));
      const feedback = "";
      const crmKode = cell(row, pickColumn(qaColumns.crmKode, 28));

      const scoreStr = cell(row, pickColumn(qaColumns.score, 17)).replace(",", ".");
      let score = Number.NaN;
      if (scoreStr.includes("%")) {
        score = parseFloat(scoreStr.replace("%", ""));
      } else if (scoreStr !== "") {
        score = parseFloat(scoreStr);
      }

      const qaTicketKey = ticketId
        ? ticketId.toLowerCase()
        : (chatId || uid)
          ? [chatId, uid, normDate || dateStr.trim()].join("|").toLowerCase()
          : "";
      if (qaTicketKey && seenQaTickets.has(qaTicketKey)) continue;
      if (qaTicketKey) seenQaTickets.add(qaTicketKey);

      const qaEntryKey = transactionKey([
        ticketId,
        agentId,
        normalizeDateStr(dateStr) || dateStr.trim(),
        uid,
        chatId,
        caseDate,
        systemCheckingType,
        qcName,
        mistakeLevel,
        category,
        remarks,
        crmKode,
        scoreStr,
      ]);

      if (seenQaEntries.has(qaEntryKey)) continue;
      seenQaEntries.add(qaEntryKey);

      if (!isNaN(score)) {
        agent.qaScoreSum += score;
        agent.qaScoreCount += 1;
      }
      
      agent.qaHistory.push({
        date: targetDateLabel,
        normDate,
        systemCheckingType,
        ticketId,
        uid,
        chatId,
        caseDate,
        qcName,
        mistakeLevel,
        category,
        remarks,
        deduction,
        score: isNaN(score) ? 0 : score,
        hasScore: !isNaN(score),
        feedback,
        crmKode,
      });
    }
  }

  // Final Computations
  let resultData = Object.values(agents).map((agent) => {
    agent.productivityTotal = agent.productivityBase;
    if (agent.manDays > 0) {
      agent.productivityAverage = agent.productivityTotal / agent.manDays;
    } else {
      agent.productivityAverage = 0;
    }

    agent.targetQuota = agent.manDays * 100;
    agent.gap = agent.productivityTotal - agent.targetQuota;

    if (agent.attendanceDuty > 0) {
      agent.attendanceScore = Math.min(
        100,
        (agent.attendancePresence / agent.attendanceDuty) * 100,
      );
    } else {
      agent.attendanceScore = 0;
    }

    agent.csatScFull = agent.csatScTotalValid > 0
      ? (agent.csatScGoodCount / agent.csatScTotalValid) * 100
      : null;

    agent.csatScFair = agent.csatScFairTotalValid > 0
      ? (agent.csatScFairGoodCount / agent.csatScFairTotalValid) * 100
      : null;

    if (
      totalProdCsatAsliSum[agent.csId] &&
      totalProdCsatAsliSum[agent.csId].count > 0
    ) {
      agent.csatAsli =
        (totalProdCsatAsliSum[agent.csId].sum /
        totalProdCsatAsliSum[agent.csId].count);
    }
    if (totalWhuSum[agent.csId] && totalWhuSum[agent.csId].count > 0) {
      agent.whu = totalWhuSum[agent.csId].sum / totalWhuSum[agent.csId].count;
    }
    if (sla1mSum[agent.csId] && sla1mSum[agent.csId].count > 0) {
      agent.sla1m = sla1mSum[agent.csId].sum / sla1mSum[agent.csId].count;
      agent.sla1mCount = sla1mSum[agent.csId].count;
    }
    if (sla3mSum[agent.csId] && sla3mSum[agent.csId].count > 0) {
      agent.sla3m = sla3mSum[agent.csId].sum / sla3mSum[agent.csId].count;
      agent.sla3mCount = sla3mSum[agent.csId].count;
    }

    return agent;
  });

  if (periodDictionary && Object.keys(periodDictionary).length > 0) {
    resultData = resultData.filter((a) => !!periodDictionary[a.csId]);
  }

  return resultData.sort((a, b) => a.csId.localeCompare(b.csId));
};
