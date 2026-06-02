import React from "react";
import { formatNum } from "../../lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";

interface DashboardChartsProps {
  stats: any;
  dailyTrend: any[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ stats, dailyTrend }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 min-w-0">
      {/* KPI Comparison Chart */}
      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
            KPI Comparison (vs Target) <span className="text-[10px] text-text-muted font-normal">ⓘ</span>
          </h2>
          <div className="flex items-center gap-4 text-xs font-semibold text-text-primary">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-1.5 rounded-full bg-[#111827]"></div>
              <span className="text-[#111827]">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-1.5 rounded-full bg-[#EF4444]"></div>
              <span className="text-[#EF4444]">Target</span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <div className="h-[280px] min-w-[700px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'CSAT Official', actual: parseFloat(((stats.csat / 5) * 100 || 0).toFixed(2)), target: 75, color: '#F59E0B', isCsat: true, rawVal: stats.csat || 0 },
                  { name: 'CSAT SC Full', actual: parseFloat((stats.csatScFull || 0).toFixed(2)), target: 75, color: '#F59E0B' },
                  { name: 'CSAT SC Takeout', actual: parseFloat((stats.csatScFair || 0).toFixed(2)), target: 92, color: '#F59E0B' },
                  { name: 'QA Score', actual: parseFloat(stats.qa.toFixed(2)), target: 92, color: '#F59E0B' },
                  { name: 'Avg Attendance', actual: parseFloat(stats.attendance.toFixed(2)), target: 95, color: '#3B82F6' },
                  { name: 'WHU (%)', actual: parseFloat(stats.whu.toFixed(2)), target: 96, color: '#22C55E' },
                  { name: 'SLA 1 Menit', actual: parseFloat(stats.sla1m.toFixed(2)), target: 92, color: '#22C55E' },
                  { name: 'SLA 3 Menit', actual: parseFloat(stats.sla3m.toFixed(2)), target: 96, color: '#22C55E' }
                ]}
                margin={{ top: 30, right: 50, left: -20, bottom: 45 }}
                barGap="-100%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickMargin={20}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const words = payload.value.split(" ");
                    return (
                      <g transform={`translate(${x},${y + 18})`}>
                        <text x={0} y={0} textAnchor="middle" fill="var(--color-text-muted)" fontSize={10} fontWeight={600}>
                          {words.length > 2 ? (
                            <>
                              <tspan x={0} dy="0">{words.slice(0, 2).join(" ")}</tspan>
                              <tspan x={0} dy="14">{words.slice(2).join(" ")}</tspan>
                            </>
                          ) : (
                            <tspan x={0} dy="0">{payload.value}</tspan>
                          )}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  domain={[0, 110]}
                  tickFormatter={(val) => `${val}%`}
                />
                <RechartsTooltip cursor={{ fill: 'var(--color-surface-muted)', opacity: 0.5 }} content={() => null} />
                <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  <LabelList 
                    dataKey="actual" 
                    position="top" 
                    fill="var(--color-text-primary)" 
                    fontSize={11} 
                    fontWeight={700} 
                    formatter={(val: unknown) => {
                      const num = Number(val);
                      return num > 0 ? `${num}%` : "";
                    }} 
                  />
                  {
                    [
                      { color: '#F59E0B' },
                      { color: '#F59E0B' },
                      { color: '#F59E0B' },
                      { color: '#F59E0B' },
                      { color: '#3B82F6' },
                      { color: '#22C55E' },
                      { color: '#22C55E' },
                      { color: '#22C55E' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))
                  }
                </Bar>
                <Bar 
                  dataKey="target" 
                  maxBarSize={32}
                  shape={(props: any) => {
                    const { x, y, width, payload } = props;
                    if (payload.isBlank) return <g></g>;
                    return (
                      <g>
                        <line 
                          x1={x + width + 2} 
                          y1={y} 
                          x2={x + width + 10} 
                          y2={y} 
                          stroke="#EF4444" 
                          strokeWidth={2} 
                        />
                        <rect 
                          x={x + width + 10} 
                          y={y - 8} 
                          width={28} 
                          height={16} 
                          rx={4} 
                          fill="#FEE2E2" 
                        />
                        <text 
                          x={x + width + 24} 
                          y={y} 
                          textAnchor="middle" 
                          fill="#EF4444" 
                          fontSize={9} 
                          fontWeight={700}
                          dy={3}
                        >
                          {payload.target}%
                        </text>
                      </g>
                    );
                  }} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-sm font-bold text-text-primary">
            Daily Performance Trend <span className="text-text-muted font-medium text-xs ml-1">(Total Productivity)</span>
          </h2>
        </div>

        <div className="w-full h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dailyTrend}
              margin={{ top: 40, right: 30, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="colorProd"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#EF4444"
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor="#EF4444"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)", fontWeight: 500 }}
                dy={10}
                minTickGap={30}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                domain={[0, "auto"]}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  backgroundColor: "var(--color-card)",
                  color: "var(--color-text-primary)",
                  padding: "8px 12px"
                }}
                labelStyle={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}
                itemStyle={{ fontWeight: "700", fontSize: "11px", padding: 0 }}
                formatter={(value: any, name: string) => [formatNum(value, 0), name === 'productivity' ? 'Current Period' : 'Previous Period']}
              />
              
              <Area
                type="monotone"
                dataKey="prevProductivity"
                stroke="#94A3B8"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="transparent"
                animationDuration={500}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#94A3B8" }}
              />

              <Area
                type="monotone"
                dataKey="productivity"
                stroke="#EF4444"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorProd)"
                animationDuration={500}
                dot={(props: any) => {
                   const { cx, cy, index } = props;
                   const isLast = index === dailyTrend.length - 1;
                   return (
                      <circle 
                         key={`dot-${index}`}
                         cx={cx} 
                         cy={cy} 
                         r={isLast ? 5 : 4} 
                         fill={isLast ? "#EF4444" : "var(--color-card)"} 
                         stroke="#EF4444" 
                         strokeWidth={2}
                      />
                   );
                }}
                activeDot={{ r: 6, strokeWidth: 0, fill: "#EF4444" }}
              >
                {dailyTrend.length <= 14 && (
                  <LabelList 
                    dataKey="productivity" 
                    position="top" 
                    offset={10}
                    fill="var(--color-text-primary)" 
                    fontSize={11} 
                    fontWeight={700} 
                    formatter={(val: number) => formatNum(val, 0)} 
                  />
                )}
              </Area>

            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
