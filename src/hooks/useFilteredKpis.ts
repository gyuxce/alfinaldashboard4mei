import { useMemo } from 'react';
import {
  applyAgentRoster,
  getAgentDictionaryForPeriod,
  getPreviousCalendarMonthRange,
  matchesAgentScope,
  processKPIs,
  type AgentKPI,
} from '../lib/dataProcessor';
import { isAgentDictionaryPopulated } from '../lib/csid';

type AgentDict = Record<string, { name: string; bpo: string; teamLeader: string }>;

export type FilteredKpis = {
  kpiData: AgentKPI[];
  previousKpiData: AgentKPI[];
  previousKpiData2: AgentKPI[];
  previousKpiData3: AgentKPI[];
  incentiveKpiData: AgentKPI[];
  incentivePeriod: { start: string; end: string };
  tlList: string[];
  agentList: string[];
};

type Args = {
  rawData: AgentKPI[];
  previousRawData: AgentKPI[];
  previousRawData2: AgentKPI[];
  previousRawData3: AgentKPI[];
  activeTab: string;
  startDate: string;
  endDate: string;
  selectedSheetMonth: string;
  selectedBpo: string;
  selectedTL: string;
  selectedGlobalAgent: string;
  productivityData: any[][];
  csatScData: any[][];
  slaData: any[][];
  scheduleData: any[][];
  qaData: any[][];
  agentDictionary: AgentDict;
  agentDictionaryByMonth: Record<string, AgentDict>;
};

/**
 * Roster overlay + scope filter + incentive simulation.
 * Extracted verbatim from the useMemo in App.tsx.
 */
export function useFilteredKpis(args: Args): FilteredKpis {
  const {
    rawData, previousRawData, previousRawData2, previousRawData3,
    activeTab, startDate, endDate, selectedSheetMonth,
    selectedBpo, selectedTL, selectedGlobalAgent,
    productivityData, csatScData, slaData, scheduleData, qaData,
    agentDictionary, agentDictionaryByMonth,
  } = args;

  return useMemo(() => {
    let data = rawData;
    let prevData = previousRawData;
    let prevData2 = previousRawData2;
    let prevData3 = previousRawData3;

    const simulationRange = getPreviousCalendarMonthRange(endDate || startDate || '');
    const currentRoster = getAgentDictionaryForPeriod(
      startDate || endDate,
      agentDictionary,
      agentDictionaryByMonth,
    );
    const selectedMonthRoster = isAgentDictionaryPopulated(agentDictionaryByMonth[selectedSheetMonth])
      ? agentDictionaryByMonth[selectedSheetMonth]
      : currentRoster;
    data = applyAgentRoster(data, selectedMonthRoster);
    const simulationData = activeTab === 'incentive' && simulationRange.start
      ? applyAgentRoster(
          processKPIs(
            productivityData,
            csatScData,
            slaData,
            scheduleData,
            qaData,
            simulationRange.start,
            simulationRange.end,
            agentDictionary,
            agentDictionaryByMonth,
          ),
          selectedMonthRoster,
        )
      : [];
    const filterOptionData = activeTab === 'incentive' ? simulationData : data;

    const applyFilters = (d: AgentKPI[]) => {
      return d.filter(a => matchesAgentScope(a, {
        bpo: selectedBpo,
        teamLeader: selectedTL,
        agent: selectedGlobalAgent,
      }));
    };

    const filteredData = applyFilters(data);
    const filteredPrevData = applyFilters(prevData);
    const filteredPrevData2 = applyFilters(prevData2);
    const filteredPrevData3 = applyFilters(prevData3);
    const filteredIncentiveData = applyFilters(simulationData);

    const bpoScopedData = filterOptionData.filter(a => matchesAgentScope(a, {
      bpo: selectedBpo,
      teamLeader: 'All TL',
      agent: 'All Agents',
    }));

    const agents = new Set<string>();
    bpoScopedData
      .filter(a => matchesAgentScope(a, {
        bpo: selectedBpo,
        teamLeader: selectedTL,
        agent: 'All Agents',
      }))
      .forEach(a => {
        if (a.name && a.name !== '-') agents.add(a.name);
        else agents.add(a.csId);
      });

    const optionTls = new Set<string>();
    bpoScopedData.forEach(a => {
      if (a.teamLeader && a.teamLeader.trim() !== '') optionTls.add(a.teamLeader.trim());
    });

    return {
      kpiData: filteredData,
      previousKpiData: filteredPrevData,
      previousKpiData2: filteredPrevData2,
      previousKpiData3: filteredPrevData3,
      incentiveKpiData: filteredIncentiveData,
      incentivePeriod: simulationRange,
      tlList: Array.from(optionTls).sort((a, b) => a.localeCompare(b)),
      agentList: Array.from(agents).sort((a, b) => a.localeCompare(b)),
    };
  }, [
    activeTab,
    agentDictionary,
    agentDictionaryByMonth,
    csatScData,
    endDate,
    previousRawData,
    previousRawData2,
    previousRawData3,
    productivityData,
    qaData,
    rawData,
    scheduleData,
    selectedBpo,
    selectedGlobalAgent,
    selectedTL,
    slaData,
    startDate,
    selectedSheetMonth,
  ]);
}
