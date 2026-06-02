import React, { useMemo, useState } from "react";
import { useStore } from "../../store";
import { processKPIs } from "../../lib/dataProcessor";
import { Trophy, Users, User, ArrowRight } from "lucide-react";
import { formatNum, getKpiColor } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { KpiTicker, TickerItem } from '../ui/KpiTicker';
import { EmptyState } from '../ui/EmptyState';
import { calculateAgentCompositeScore, calculateCompositeScore } from "../../lib/kpiScoring";

interface AgentKpiRowProps {
  label: string;
  weight: string;
  value: number | null;
  maxValue: number;
  formatFn?: (v: number) => string;
  suffix?: string;
  isMaxCapped?: boolean;
}

const AgentKpiRow = ({
  label, weight, value, maxValue, formatFn, suffix, isMaxCapped
}: AgentKpiRowProps) => {
  const fmt = formatFn || ((v: number) => v.toFixed(1) + (suffix || '%'));
  const safeValue = value !== null ? value : 0;
  
  const percentage = Math.min((safeValue / maxValue) * 100, 100);

  let colorClass = "bg-danger";
  let textColorClass = "text-danger-text";
  if (value !== null) {
    if (value >= 95) { colorClass = "bg-success"; textColorClass = "text-success-text"; }
    else if (value >= 85) { colorClass = "bg-warning"; textColorClass = "text-warning-text"; }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">
            {label} ({weight})
          </span>
        </div>
        <div className={`text-sm font-semibold ${textColorClass}`}>
          {value !== null ? fmt(value) : '-'}
          {isMaxCapped && (
            <span className="text-success-text text-xs ml-1 font-bold">Max</span>
          )}
        </div>
      </div>
      
      <div className="relative h-2 bg-border rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-text-disabled';
  if (score >= 95) return 'text-success font-bold text-[11px]';
  return 'text-danger font-bold text-[11px]';
};

export const Leaderboard: React.FC = () => {
  const [toggleMode, setToggleMode] = useState<"tl" | "agent">("agent");
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAgent(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const {
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
  } = useStore();

  const handleOpenFiles = () => {
    const navButtons = document.querySelectorAll("nav button");
    const fileBtn = Array.from(navButtons).find((el) =>
      el.textContent?.includes("File Center"),
    );
    if (fileBtn) {
      (fileBtn as HTMLButtonElement).click();
    }
  };

  const hasData =
    productivityData.length > 0 ||
    csatScData.length > 0 ||
    slaData.length > 0 ||
    scheduleData.length > 0 ||
    qaData.length > 0;

  const { agentRows, tlRows } = useMemo(() => {
    // We always compute the unfiltered data for the leaderboard
    if (!hasData) return { agentRows: [], tlRows: [] };

    const rawData = processKPIs(
      productivityData,
      csatScData,
      slaData,
      scheduleData,
      qaData,
      "",
      "",
      agentDictionary,
    );

    // Prepare Agent List
    const aList: any[] = [];

    // Prepare TL aggregations
    const tlMap: Record<
      string,
      {
        agents: Set<string>;
        qaPctSum: number;
        qaPctCount: number;
        prodPctSum: number;
        prodPctCount: number;
        csatPctSum: number;
        csatPctCount: number;
        qaOrigSum: number;
        qaOrigCount: number;
        prodOrigSum: number;
        prodOrigCount: number;
        csatOrigSum: number;
        csatOrigCount: number;
      }
    > = {};

    rawData.forEach((agent) => {
      const composite = calculateAgentCompositeScore(agent);

      if (composite.score !== null) {
        aList.push({
          csId: agent.csId,
          name: agent.name || agent.csId,
          tl: agent.teamLeader || "-",
          score: composite.score,
          qa: composite.qaOriginal,
          qa_pct: composite.qaPct,
          prod: composite.productivityOriginal,
          prod_pct: composite.productivityPct,
          csat: composite.csatOriginal,
          csat_pct: composite.csatPct,
          train: 5,
          quiz: 5,
        });
      }

      // Aggregate for TL
      const tl = agent.teamLeader;
      if (tl && tl.trim() !== "") {
        if (!tlMap[tl]) {
          tlMap[tl] = {
            agents: new Set(),
            qaPctSum: 0,
            qaPctCount: 0,
            prodPctSum: 0,
            prodPctCount: 0,
            csatPctSum: 0,
            csatPctCount: 0,
            qaOrigSum: 0,
            qaOrigCount: 0,
            prodOrigSum: 0,
            prodOrigCount: 0,
            csatOrigSum: 0,
            csatOrigCount: 0,
          };
        }
        tlMap[tl].agents.add(agent.csId);

        if (composite.qaPct !== null) {
          tlMap[tl].qaPctSum += composite.qaPct;
          tlMap[tl].qaPctCount++;
          tlMap[tl].qaOrigSum += composite.qaOriginal!;
          tlMap[tl].qaOrigCount++;
        }
        if (composite.productivityPct !== null) {
          tlMap[tl].prodPctSum += composite.productivityPct;
          tlMap[tl].prodPctCount++;
          tlMap[tl].prodOrigSum += composite.productivityOriginal!;
          tlMap[tl].prodOrigCount++;
        }
        if (composite.csatPct !== null) {
          tlMap[tl].csatPctSum += composite.csatPct;
          tlMap[tl].csatPctCount++;
          tlMap[tl].csatOrigSum += composite.csatOriginal!;
          tlMap[tl].csatOrigCount++;
        }
      }
    });

    // Compute TL composite scores
    const tList: any[] = [];
    Object.entries(tlMap).forEach(([tlName, stats]) => {
      if (stats.agents.size < 3) return; // Fair filter: min 3 agents

      const tl_qa_pct =
        stats.qaPctCount > 0 ? stats.qaPctSum / stats.qaPctCount : null;
      const tl_prod_pct =
        stats.prodPctCount > 0 ? stats.prodPctSum / stats.prodPctCount : null;
      const tl_csat_pct =
        stats.csatPctCount > 0 ? stats.csatPctSum / stats.csatPctCount : null;

      const tl_qa_orig =
        stats.qaOrigCount > 0 ? stats.qaOrigSum / stats.qaOrigCount : null;
      const tl_prod_orig =
        stats.prodOrigCount > 0
          ? stats.prodOrigSum / stats.prodOrigCount
          : null;
      const tl_csat_orig =
        stats.csatOrigCount > 0
          ? stats.csatOrigSum / stats.csatOrigCount
          : null;

      const composite = calculateCompositeScore({
        qaPct: tl_qa_pct,
        productivityPct: tl_prod_pct,
        csatPct: tl_csat_pct,
      });

      if (composite.score !== null) {
        tList.push({
          name: tlName,
          score: composite.score,
          qa: tl_qa_orig,
          qa_pct: tl_qa_pct,
          prod: tl_prod_orig,
          prod_pct: tl_prod_pct,
          csat: tl_csat_orig,
          csat_pct: tl_csat_pct,
          train: 5,
          quiz: 5,
        });
      }
    });

    aList.sort((a, b) => b.score - a.score);
    tList.sort((a, b) => b.score - a.score);

    return { agentRows: aList, tlRows: tList };
  }, [
    hasData,
    productivityData,
    csatScData,
    slaData,
    scheduleData,
    qaData,
    agentDictionary,
  ]);

  const tickerItems: TickerItem[] = useMemo(() => {
    const topAgents = agentRows.slice(0, 5);
    const topTls = tlRows.slice(0, 5);
    const topAgentAvg = topAgents.length > 0
      ? topAgents.reduce((acc, curr) => acc + curr.score, 0) / topAgents.length
      : 0;
    const topTlAvg = topTls.length > 0
      ? topTls.reduce((acc, curr) => acc + curr.score, 0) / topTls.length
      : 0;
    
    const globalAgentAvg = agentRows.length > 0 ? (agentRows.reduce((sum, a) => sum + a.score, 0) / agentRows.length) : 0;

    return [
      { label: 'Overall Weighted Avg Score', value: `${formatNum(globalAgentAvg, 2)}`, colorType: 'primary', isSeparator: false, hasDotRight: true },
      { label: 'Top 5 Agents Avg', value: `${formatNum(topAgentAvg, 2)}`, colorType: 'success', hasDotRight: true },
      { label: 'Top 5 TLs Avg', value: `${formatNum(topTlAvg, 2)}`, colorType: 'success' },
    ];
  }, [agentRows, tlRows]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full mt-10">
        <Trophy className="w-16 h-16 text-text-muted mb-4 stroke-1" />
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Belum Ada Data
        </h2>
        <p className="text-sm text-text-secondary mb-6 max-w-sm text-center">
          Buka File Center, pilih bulan data, lalu klik Sync Now untuk melihat ranking Leaderboard.
        </p>
        <button
          onClick={handleOpenFiles}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-text font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-sm"
        >
          Buka File Center <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const getRankEmoji = (rank: number) => {
    return rank.toString();
  };

  const getRowClass = (rank: number) => {
    if (rank === 1) return "bg-success-soft/30 hover:bg-success-soft/50";
    return "hover:bg-surface-muted";
  };

  const activeData = toggleMode === "tl" ? tlRows : agentRows;

  const renderVal = (val: number | null, kpiType: "whu" | "qa") => {
    if (val === null) return <span className="text-text-disabled">-</span>;
    return (
      <span className={`font-bold text-[11px] ${getKpiColor(val, kpiType)}`}>
        {formatNum(val, 1)}%
      </span>
    );
  };

  const renderNeutral = (val: number | null) => {
    if (val === null) return <span className="text-text-disabled">-</span>;
    return (
      <span
        className={`font-bold text-[11px] ${getKpiColor(val, "productivity")}`}
      >
        {formatNum(val, 1)}%
      </span>
    );
  };

  const bottomThreeIds = activeData.slice(-3).map(a => a.csId || a.name);
  const isBottomThree = (id: string) => toggleMode === "agent" && bottomThreeIds.includes(id);

  const selectedRank = selectedAgent ? activeData.findIndex((a) => (a.csId || a.name) === (selectedAgent.csId || selectedAgent.name)) + 1 : 0;
  const isSelectedBottomThree = selectedAgent ? isBottomThree(selectedAgent.csId || selectedAgent.name) : false;

  let safeScore = activeData.length > 3 ? activeData[activeData.length - 3].score : 0;
  let scoreGap = 0;
  let targetDesc = "";
  let isRank1 = false;
  
  if (selectedAgent) {
    if (isSelectedBottomThree) {
      scoreGap = safeScore - selectedAgent.score + 0.1;
      targetDesc = "TARGET KELUAR BOTTOM 3:";
    } else if (selectedRank > 1) {
      const nextRankAgent = activeData[selectedRank - 2];
      safeScore = nextRankAgent.score;
      scoreGap = safeScore - selectedAgent.score + 0.1;
      targetDesc = `TARGET NAIK KE RANK #${selectedRank - 1}:`;
    } else {
      isRank1 = true;
    }
  }

  return (
    <div className="flex flex-col gap-6 p-2">
      <div>
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Leaderboard
        </h2>
        <p className="text-[13px] text-text-secondary mt-1">
          Weighted Score: QA 50% &middot; Prod 20% &middot; CSAT 20% &middot; Training 5% &middot; Quiz 5%
        </p>
        <p className="text-[11px] text-text-muted italic mt-0.5">
          Menampilkan data lengkap, tidak mengikuti filter sidebar
        </p>
      </div>

      <KpiTicker items={tickerItems} />

      <div className="inline-flex bg-surface-muted p-1 rounded-lg w-max gap-1">
        <button
          onClick={() => setToggleMode("agent")}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "agent"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <User className="w-4 h-4" /> Agents
        </button>
        <button
          onClick={() => setToggleMode("tl")}
          className={cn(
            "px-4 py-2 rounded-md text-[13px] flex items-center gap-2",
            toggleMode === "tl"
              ? "bg-card text-primary font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border"
              : "bg-transparent text-text-muted font-medium hover:text-text-primary hover:bg-card/50",
          )}
        >
          <Users className="w-4 h-4" /> Team Leaders
        </button>
      </div>

      <div className="relative w-full overflow-auto bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-1 max-h-[calc(100vh-280px)]">
        <table className="w-full text-left text-[10px] whitespace-nowrap min-w-[800px] border-collapse">
          <thead className="bg-surface text-text-secondary sticky top-0 z-30">
            <tr>
              <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">
                #
              </th>
              <th className="p-2 font-bold  md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]">
                Name
              </th>
              {toggleMode === "agent" && (
                <th className="p-2 font-bold  md:sticky md:left-[310px] z-40 bg-surface min-w-[120px] max-w-[120px]">
                  Team Leader
                </th>
              )}
              <th className="p-2 font-bold text-center border-b border-border bg-surface z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                Score
              </th>
              <th className="p-2 font-bold text-center z-30 relative bg-surface">
                QA
              </th>
              <th className="p-2 font-bold text-center z-30 relative bg-surface">
                Prod
              </th>
              <th className="p-2 font-bold text-center z-30 relative bg-surface">
                CSAT
              </th>
              <th className="p-2 font-bold text-center z-30 relative bg-surface">
                Training
              </th>
              <th className="p-2 font-bold text-center z-30 relative bg-surface">
                Quiz
              </th>
            </tr>
          </thead>
          <tbody className="">
            {activeData.map((item, idx) => {
              const rank = idx + 1;
              const isBottom = isBottomThree(item.csId || item.name);
              const stickyClass = isBottom ? "bg-danger-soft/30 group-hover:bg-danger-soft/50" : "bg-card group-hover:bg-surface-muted";
              return (
                <tr
                  key={item.csId || item.name}
                  className={cn(
                    "border-b border-border transition-colors group",
                    isBottom ? "bg-danger-soft/30 hover:bg-danger-soft/50" : "hover:bg-surface-muted"
                  )}
                >
                  <td
                    className={`p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20  min-w-[60px] max-w-[60px] ${stickyClass}`}
                  >
                    {isBottom ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-danger-text">
                          #{rank}
                        </span>
                        <span className="text-[8px] bg-danger-soft text-danger-text px-1 rounded font-semibold whitespace-nowrap">
                          Perlu perhatian
                        </span>
                      </div>
                    ) : (
                      getRankEmoji(rank)
                    )}
                  </td>
                  <td
                    className={`p-2 font-medium md:sticky md:left-[60px] z-20  min-w-[250px] max-w-[250px] truncate ${stickyClass}`}
                  >
                    <button
                      onClick={() => setSelectedAgent(item)}
                      className="text-left hover:underline block"
                    >
                      <span className="font-bold text-kpi-neutral-text">
                        {item.name}
                      </span>
                      {isBottom && (
                        <span className="ml-1 text-[9px] text-danger-text">
                          Tap untuk analisis
                        </span>
                      )}
                    </button>
                    {toggleMode === "agent" && (
                      <div className="text-[9px] text-text-muted font-normal mt-0.5">
                        {item.csId}
                      </div>
                    )}
                  </td>
                  {toggleMode === "agent" && (
                    <td
                      className={`p-2 font-medium md:sticky md:left-[310px] z-20  min-w-[120px] max-w-[120px] truncate ${stickyClass}`}
                    >
                      {item.tl}
                    </td>
                  )}
                  <td className="p-2 text-center z-10 relative">
                    <span
                      className={`text-[11px] ${getScoreColor(item.score)}`}
                    >
                      {formatNum(item.score, 1)}
                    </span>
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    {renderVal(item.qa, "qa")}
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    {renderNeutral(item.prod)}
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    {item.csat === null ? (
                      <span className="text-text-disabled">-</span>
                    ) : item.csat > 5 ? (
                      renderVal(item.csat, "whu")
                    ) : (
                      <span
                        className={`font-bold text-[11px] ${getKpiColor(
                          item.csat_pct,
                          "productivity"
                        )}`}
                      >
                        {formatNum(item.csat, 2)}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    <span className="inline-flex items-center gap-1 font-bold text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-sm">
                      5/5
                    </span>
                  </td>
                  <td className="p-2 text-center z-10 relative">
                    <span className="inline-flex items-center gap-1 font-bold text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-sm">
                      5/5
                    </span>
                  </td>
                </tr>
              );
            })}

            {activeData.length === 0 && (
              <tr>
                <td
                  colSpan={toggleMode === "agent" ? 9 : 8}
                  className="p-4 z-10 relative"
                >
                  <EmptyState
                    title="Tidak ada data leaderboard"
                    description="Jika belum sync, buka File Center lalu klik Sync Now. Jika sudah sync, coba ubah filter global. Untuk mode TL, pastikan TL memiliki minimal 3 agent."
                    variant="filter"
                    className="border-0 bg-transparent py-6"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedAgent && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity"
          onClick={() => setSelectedAgent(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  KPI Analysis
                </h2>
                <p className="text-text-secondary text-xs mt-0.5">
                  {selectedAgent.name} {selectedAgent.csId && `- ${selectedAgent.csId}`}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-text-muted bg-surface-muted px-2 py-0.5 rounded-full border border-border">
                    Rank #{selectedRank}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedAgent.score >= 95 ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text'}`}>
                    Score {selectedAgent.score.toFixed(1)}
                  </span>
                  {isSelectedBottomThree && (
                    <span className="text-[10px] bg-danger-soft text-danger-text px-2 py-0.5 rounded-full font-semibold border border-danger-soft">
                      Bottom 3
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedAgent(null)}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-muted"
                aria-label="Close modal"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: KPI BREAKDOWN */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                    SKOR KPI KAMU
                  </h3>

              <AgentKpiRow
                label="QA Score"
                weight="50%"
                value={selectedAgent.qa_pct}
                maxValue={100}
                isMaxCapped={false}
              />

              <AgentKpiRow
                label="Produktivitas"
                weight="20%"
                value={selectedAgent.prod !== null ? Math.min(selectedAgent.prod, 100) : null}
                maxValue={100}
                isMaxCapped={selectedAgent.prod !== null && selectedAgent.prod >= 100}
              />

              <AgentKpiRow
                label="CSAT Rating"
                weight="20%"
                value={selectedAgent.csat_pct}
                maxValue={100}
                isMaxCapped={false}
                formatFn={(v) => v.toFixed(2)}
                suffix="%"
              />

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Training (5%)
                  </span>
                  <div className="text-sm font-semibold text-success-text">
                    100%
                  </div>
                </div>
                <div className="relative w-full bg-border-strong rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="absolute top-0 h-full rounded-full transition-all bg-success"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic">
                  Auto 100% - pastikan selesaikan modul training tepat waktu
                </p>
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Quiz (5%)
                  </span>
                  <div className="text-sm font-semibold text-success-text">
                    100%
                  </div>
                </div>
                <div className="relative w-full bg-border-strong rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="absolute top-0 h-full rounded-full transition-all bg-success"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic">
                  Auto 100% - pastikan kerjakan kuis sebelum deadline
                </p>
              </div>
            </div>
            </div>
            
            {/* RIGHT COLUMN: REKOMENDASI */}
            <div className="space-y-4 md:border-l md:border-border md:pl-6 md:pt-0 pt-6 border-t border-border md:border-t-0">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Prioritas Peningkatan
                </h3>

              {isRank1 ? (
                <div className="p-3 bg-primary-soft/20 border border-primary-soft/50 rounded-lg text-center">
                  <span className="text-2xl block mb-2">🏆</span>
                  <p className="text-sm font-bold text-primary">Kamu sudah #1!</p>
                  <p className="text-xs text-text-secondary mt-1">Pertahankan performa luar biasa ini.</p>
                </div>
              ) : (() => {
                const qaNeeded = scoreGap / 0.5;
                const prodNeeded = scoreGap / 0.2;
                const csatNeeded = scoreGap / 0.2;

                const currQa = selectedAgent.qa_pct || 0;
                const currProd = selectedAgent.prod || 0;
                const currCsat = selectedAgent.csat_pct || 0;

                const canQa = (currQa + qaNeeded) <= 100;
                const canProd = currProd < 100 && (currProd + prodNeeded) <= 100;
                const canCsat = (currCsat + csatNeeded) <= 100;

                const isAllCapped = currQa >= 100 && currProd >= 100 && currCsat >= 100;

                if (isAllCapped) {
                  return (
                    <div className="p-3 bg-success-soft/20 border border-success-soft/50 rounded-lg text-center mt-2">
                      <p className="text-sm font-bold text-success-text">Semua KPI sudah maksimal (100%).</p>
                      <p className="text-xs text-text-secondary mt-1">Pertahankan! Tidak ada yang perlu ditingkatkan lagi.</p>
                    </div>
                  );
                }

                const options = [
                  { type: 'qa', needed: qaNeeded, can: canQa, current: currQa },
                  { type: 'prod', needed: prodNeeded, can: canProd, current: currProd },
                  { type: 'csat', needed: csatNeeded, can: canCsat, current: currCsat }
                ].filter(opt => opt.can).sort((a, b) => a.needed - b.needed);

                const easiest = options.length > 0 ? options[0].type : "none";

                return (
                  <>
                    <div className="mb-3 px-2">
                      <p className="text-xs font-bold text-text-primary">{targetDesc}</p>
                      {scoreGap < 0.2 ? (
                        <p className="text-xs text-text-secondary mt-0.5">Hampir! Sedikit lagi naik rank.</p>
                      ) : (
                        <p className="text-xs text-text-secondary mt-0.5">Butuh score &gt;= {safeScore.toFixed(1)} | Gap: {scoreGap.toFixed(1)} poin</p>
                      )}
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'qa' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canQa ? (easiest === 'qa' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">QA Score</span>
                          {easiest === 'qa' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {canQa ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{qaNeeded.toFixed(1)}%</span> dari {currQa.toFixed(1)}% ke {(currQa + qaNeeded).toFixed(1)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh naik +{qaNeeded.toFixed(1)}% (melebihi 100%, sangat sulit)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'prod' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canProd ? (easiest === 'prod' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">Produktivitas</span>
                          {easiest === 'prod' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {currProd >= 100 ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Sudah maksimal (100%, di-cap)
                          </div>
                        ) : canProd ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{prodNeeded.toFixed(1)}%</span> dari {currProd.toFixed(1)}% ke {(currProd + prodNeeded).toFixed(1)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh effort besar / akan terkena cap 100%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${easiest === 'csat' ? 'bg-primary-soft/10 border-primary/20' : 'bg-surface-muted border-border'}`}>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${canCsat ? (easiest === 'csat' ? 'bg-danger' : 'bg-warning') : 'bg-success'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">CSAT Rating</span>
                          {easiest === 'csat' && <span className="text-[9px] text-primary bg-primary-soft px-1 rounded font-medium">prioritas utama</span>}
                        </div>
                        {canCsat ? (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Naik <span className="font-bold">+{csatNeeded.toFixed(2)}%</span> dari {currCsat.toFixed(2)}% ke {(currCsat + csatNeeded).toFixed(2)}%<br/>
                            <span className="text-success-text">Cukup untuk mencapai target</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                            Butuh naik +{csatNeeded.toFixed(2)}% (melebihi 100%, sangat sulit)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 bg-primary-soft/20 rounded-lg border border-primary-soft/50">
                      <p className="text-[11px] font-semibold text-primary">
                        Cara paling mudah:
                      </p>
                      {easiest === 'none' ? (
                        <p className="text-[11px] font-medium text-primary mt-1">
                          Sulit untuk mencapai target ini dengan satu KPI saja. Coba tingkatkan semua KPI secara bertahap.
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-primary mt-1 flex items-center gap-1">
                          Naikkan {easiest === 'qa' ? 'QA' : easiest === 'prod' ? 'Prod' : 'CSAT'} <span className="font-bold">+{easiest === 'qa' ? qaNeeded.toFixed(1) : easiest === 'prod' ? prodNeeded.toFixed(1) : csatNeeded.toFixed(2)}%</span> saja sudah cukup!
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
