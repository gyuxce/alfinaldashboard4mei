import React from "react";
import { AgentKPI } from "../../lib/dataProcessor";
import { formatNum, getKpiColor } from "../../lib/utils";

interface DashboardAgentTableProps {
  tableData: AgentKPI[];
}

export const DashboardAgentTable: React.FC<DashboardAgentTableProps> = ({ tableData }) => {
  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden mt-6">
      <div className="p-3 border-b border-border">
        <span className="text-sm font-bold text-text-primary">
          Agent Performance Table
        </span>
      </div>
      <div className="relative w-full overflow-auto bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] max-h-[calc(100vh-280px)]">
        <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
          <thead className="bg-surface text-text-secondary sticky top-0 z-30">
            <tr>
              <th className="p-2 font-bold text-center md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px] ">
                No
              </th>
              <th className="p-2 font-bold md:sticky md:left-[60px] z-40 bg-surface min-w-[220px] max-w-[220px] ">
                Name / CS ID
              </th>
              <th className="p-2 font-bold md:sticky md:left-[280px] z-40 bg-surface min-w-[80px] max-w-[80px] ">
                BPO
              </th>
              <th className="p-2 font-bold md:sticky md:left-[360px] z-40 bg-surface min-w-[120px] max-w-[120px] ">
                Team Leader
              </th>
              <th className="p-2 font-bold">Productivity</th>
              <th className="p-2 font-bold">CSAT Asli</th>
              <th className="p-2 font-bold">CSAT SC Full</th>
              <th className="p-2 font-bold">CSAT SC Fair</th>
              <th className="p-2 font-bold">SLA 1m</th>
              <th className="p-2 font-bold">SLA 3m</th>
              <th className="p-2 font-bold">Avg Attendance</th>
              <th className="p-2 font-bold">WHU</th>
              <th className="p-2 font-bold">QA Score</th>
            </tr>
          </thead>
          <tbody className="">
            {tableData.map((agent, i) => (
              <tr
                key={agent.csId}
                className="border-b border-border hover:bg-surface-muted transition-colors group"
              >
                <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted min-w-[60px] max-w-[60px]">
                  {i + 1}
                </td>
                <td className="p-2 font-medium text-text-primary md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted min-w-[220px] max-w-[220px] truncate">
                  {agent.name || agent.csId}
                  <div className="text-[9px] text-text-muted font-normal">
                    {agent.csId}
                  </div>
                </td>
                <td className="p-2 font-medium uppercase md:sticky md:left-[280px] z-20 bg-card group-hover:bg-surface-muted min-w-[80px] max-w-[80px] truncate">
                  {agent.bpo || "-"}
                </td>
                <td className="p-2 font-medium md:sticky md:left-[360px] z-20 bg-card group-hover:bg-surface-muted min-w-[120px] max-w-[120px] truncate">
                  {agent.teamLeader || "-"}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.productivityTotal, "productivity")}`}
                >
                  {formatNum(agent.productivityTotal, 0)}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.csatAsli, "csatOfficial")}`}
                >
                  {formatNum(agent.csatAsli)}
                  {agent.csatAsli !== null ? "" : "-"}
                </td>
                <td className="p-2">
                  {agent.csatScTotalValid > 0 ? (
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold ${getKpiColor(agent.csatScFull || 0, "csatFull")}`}
                      >
                        {formatNum(
                          agent.csatScFull,
                        )}
                        %
                      </span>
                      <span className="text-[9px] text-text-muted font-medium">
                        (
                        {formatNum(
                          agent.csatScTotalValid,
                        )}
                        )
                      </span>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-2">
                  {agent.csatScFairTotalValid > 0 ? (
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold ${getKpiColor(agent.csatScFair || 0, "csatFair")}`}
                      >
                        {formatNum(
                          agent.csatScFair,
                        )}
                        %
                      </span>
                      <span className="text-[9px] text-text-muted font-medium">
                        (
                        {formatNum(
                          agent.csatScFairTotalValid,
                        )}
                        )
                      </span>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.sla1m, "sla1m")}`}
                >
                  {formatNum(agent.sla1m)}
                  {agent.sla1m !== null ? "%" : "-"}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.sla3m, "sla3m")}`}
                >
                  {formatNum(agent.sla3m)}
                  {agent.sla3m !== null ? "%" : "-"}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.attendanceScore, "attendance")}`}
                >
                  {agent.attendanceScore > 0 ? formatNum(agent.attendanceScore) + "%" : "-"}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.whu, "whu")}`}
                >
                  {formatNum(agent.whu)}
                  {agent.whu !== null ? "%" : "-"}
                </td>
                <td
                  className={`p-2 font-bold text-[11px] ${getKpiColor(agent.qaScoreCount > 0 ? agent.qaScoreSum / agent.qaScoreCount : null, "qa")}`}
                >
                  {agent.qaScoreCount > 0
                    ? formatNum(agent.qaScoreSum / agent.qaScoreCount) +
                      "%"
                    : "-"}
                </td>
              </tr>
            ))}
            {tableData.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  className="p-6 text-center text-text-muted font-medium text-sm"
                >
                  Tidak ada data agent untuk ditampilkan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
