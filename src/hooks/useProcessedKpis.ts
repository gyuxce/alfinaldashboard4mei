import { useEffect, useRef, useState, startTransition } from 'react';
import { processKPIs, type AgentKPI } from '../lib/dataProcessor';

export type ProcessedKpiBundle = {
  rawData: AgentKPI[];
  previousRawData: AgentKPI[];
  previousRawData2: AgentKPI[];
  previousRawData3: AgentKPI[];
  baseTlList: string[];
};

const EMPTY_BUNDLE: ProcessedKpiBundle = {
  rawData: [],
  previousRawData: [],
  previousRawData2: [],
  previousRawData3: [],
  baseTlList: [],
};

type PeriodRange = { start: string; end: string } | null;

type Args = {
  productivityData: any[][];
  csatScData: any[][];
  slaData: any[][];
  scheduleData: any[][];
  qaData: any[][];
  startDate: string;
  endDate: string;
  agentDictionary: Record<string, { name: string; bpo: string; teamLeader: string }>;
  agentDictionaryByMonth: Record<string, Record<string, { name: string; bpo: string; teamLeader: string }>>;
  needsComparisonData: boolean;
  prev1: PeriodRange;
  prev2: PeriodRange;
  prev3: PeriodRange;
  /** Skip heavy work while bootstrapping empty state */
  enabled?: boolean;
};

const yieldToPaint = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

/**
 * Runs processKPIs off the critical paint path (yield between passes)
 * so loading UI stays responsive instead of freezing/"patah".
 */
export function useProcessedKpis(args: Args): {
  bundle: ProcessedKpiBundle;
  isProcessing: boolean;
} {
  const {
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    startDate,
    endDate,
    agentDictionary,
    agentDictionaryByMonth,
    needsComparisonData,
    prev1,
    prev2,
    prev3,
    enabled = true,
  } = args;

  const [bundle, setBundle] = useState<ProcessedKpiBundle>(EMPTY_BUNDLE);
  const [isProcessing, setIsProcessing] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setBundle(EMPTY_BUNDLE);
      setIsProcessing(false);
      return;
    }

    const gen = ++genRef.current;
    let cancelled = false;
    // Do not render a prior period/filter's KPI while this generation runs.
    // App can show its existing loading panel instead of stale totals.
    setBundle(EMPTY_BUNDLE);
    setIsProcessing(true);

    const run = async () => {
      await yieldToPaint();
      if (cancelled || gen !== genRef.current) return;

      const hasAnySource =
        productivityData.length > 0
        || csatScData.length > 0
        || slaData.length > 0
        || scheduleData.length > 0
        || qaData.length > 0;

      if (!hasAnySource) {
        startTransition(() => {
          if (cancelled || gen !== genRef.current) return;
          setBundle(EMPTY_BUNDLE);
          setIsProcessing(false);
        });
        return;
      }

      const raw = processKPIs(
        productivityData,
        csatScData,
        slaData,
        scheduleData,
        qaData,
        startDate,
        endDate,
        agentDictionary,
        agentDictionaryByMonth,
      );

      await yieldToPaint();
      if (cancelled || gen !== genRef.current) return;

      let previousRawData: AgentKPI[] = [];
      let previousRawData2: AgentKPI[] = [];
      let previousRawData3: AgentKPI[] = [];

      if (needsComparisonData && prev1) {
        previousRawData = processKPIs(
          productivityData,
          csatScData,
          slaData,
          scheduleData,
          qaData,
          prev1.start,
          prev1.end,
          agentDictionary,
          agentDictionaryByMonth,
        );
        await yieldToPaint();
        if (cancelled || gen !== genRef.current) return;
      }

      if (needsComparisonData && prev2) {
        previousRawData2 = processKPIs(
          productivityData,
          csatScData,
          slaData,
          scheduleData,
          qaData,
          prev2.start,
          prev2.end,
          agentDictionary,
          agentDictionaryByMonth,
        );
        await yieldToPaint();
        if (cancelled || gen !== genRef.current) return;
      }

      if (needsComparisonData && prev3) {
        previousRawData3 = processKPIs(
          productivityData,
          csatScData,
          slaData,
          scheduleData,
          qaData,
          prev3.start,
          prev3.end,
          agentDictionary,
          agentDictionaryByMonth,
        );
        await yieldToPaint();
        if (cancelled || gen !== genRef.current) return;
      }

      const tls = new Set<string>();
      raw.forEach((a) => {
        if (a.teamLeader && a.teamLeader.trim() !== '') tls.add(a.teamLeader.trim());
      });

      startTransition(() => {
        if (cancelled || gen !== genRef.current) return;
        setBundle({
          rawData: raw,
          previousRawData,
          previousRawData2,
          previousRawData3,
          baseTlList: Array.from(tls).sort((a, b) => a.localeCompare(b)),
        });
        setIsProcessing(false);
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    startDate,
    endDate,
    agentDictionary,
    agentDictionaryByMonth,
    needsComparisonData,
    prev1,
    prev2,
    prev3,
  ]);

  return { bundle, isProcessing };
}
