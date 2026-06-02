import React, { useMemo, useState } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { useStore } from '../../store';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

const COLORS = {
  agent: '#f43f5e',
  customer: '#3b82f6',
  akulaku: '#f59e0b',
};

const CustomPieLabel = ({ cx, cy, midAngle, outerRadius, percent }: any) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, fill: 'var(--color-text-primary)' }}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export const CsatRcaMonitor: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
  const { selectedBpo, selectedTL } = useStore();
  const [agentSearch, setAgentSearch] = useState('');

  const hasRcaData = useMemo(() => {
    return data.some(a =>
      Object.keys(a.rcaAgentAreaCounts).length > 0 ||
      Object.keys(a.rcaCustomerAreaCounts).length > 0 ||
      Object.keys(a.rcaAkulakuProcessCounts).length > 0
    );
  }, [data]);

  const { pieData, agentDetailBar, customerDetailBar, akulakuDetailBar, agentRanking, totalAgent, totalCustomer, totalAkulaku } = useMemo(() => {
    const agentTotal: Record<string, number> = {};
    const customerTotal: Record<string, number> = {};
    const akulakuTotal: Record<string, number> = {};
    const agentCaseSummary: Record<string, { agentCases: number; customerCases: number; akulakuCases: number; name: string; tl: string }> = {};

    data.forEach(a => {
      const name = a.name || a.csId;
      if (!agentCaseSummary[a.csId]) {
        agentCaseSummary[a.csId] = { agentCases: 0, customerCases: 0, akulakuCases: 0, name, tl: a.teamLeader };
      }
      Object.entries(a.rcaAgentAreaCounts as Record<string, number>).forEach(([k, v]) => {
        agentTotal[k] = (agentTotal[k] || 0) + v;
        agentCaseSummary[a.csId].agentCases += v;
      });
      Object.entries(a.rcaCustomerAreaCounts as Record<string, number>).forEach(([k, v]) => {
        customerTotal[k] = (customerTotal[k] || 0) + v;
        agentCaseSummary[a.csId].customerCases += v;
      });
      Object.entries(a.rcaAkulakuProcessCounts as Record<string, number>).forEach(([k, v]) => {
        akulakuTotal[k] = (akulakuTotal[k] || 0) + v;
        agentCaseSummary[a.csId].akulakuCases += v;
      });
    });

    const tA = Object.values(agentTotal).reduce((a, b) => a + b, 0);
    const tC = Object.values(customerTotal).reduce((a, b) => a + b, 0);
    const tAk = Object.values(akulakuTotal).reduce((a, b) => a + b, 0);

    const pieData = (tA + tC + tAk) > 0 ? [
      { name: 'Agent Area', value: tA, color: COLORS.agent },
      { name: 'Customer Area', value: tC, color: COLORS.customer },
      { name: 'Akulaku Process', value: tAk, color: COLORS.akulaku },
    ].filter(d => d.value > 0) : [];

    const toBar = (rec: Record<string, number>, color: string) =>
      Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([name, count]) => ({ name, count, fill: color }));

    const agentRanking = Object.values(agentCaseSummary)
      .map(a => ({ ...a, total: a.agentCases + a.customerCases + a.akulakuCases }))
      .filter(a => a.total > 0)
      .sort((a, b) => b.total - a.total);

    return {
      pieData,
      agentDetailBar: toBar(agentTotal, COLORS.agent),
      customerDetailBar: toBar(customerTotal, COLORS.customer),
      akulakuDetailBar: toBar(akulakuTotal, COLORS.akulaku),
      agentRanking,
      totalAgent: tA,
      totalCustomer: tC,
      totalAkulaku: tAk,
    };
  }, [data]);

  const filteredAgentRanking = useMemo(() => {
    if (!agentSearch.trim()) return agentRanking;
    const q = agentSearch.toLowerCase();
    return agentRanking.filter(a => a.name.toLowerCase().includes(q) || a.tl.toLowerCase().includes(q));
  }, [agentRanking, agentSearch]);

  const activeFilterText = [
    selectedBpo && selectedBpo !== 'All BPO' ? `BPO: ${selectedBpo}` : '',
    selectedTL && selectedTL !== 'All TL' ? `TL: ${selectedTL}` : '',
  ].filter(Boolean).join(' | ');

  const grandTotal = totalAgent + totalCustomer + totalAkulaku;

  const legendItems = [
    { key: 'agent', label: 'Agent Area', count: totalAgent, color: COLORS.agent, bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.25)', items: agentDetailBar },
    { key: 'customer', label: 'Customer Area', count: totalCustomer, color: COLORS.customer, bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', items: customerDetailBar },
    { key: 'akulaku', label: 'Akulaku Process', count: totalAkulaku, color: COLORS.akulaku, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', items: akulakuDetailBar },
  ];

  const DetailBarChart = ({ data: barData, color, title }: { data: { name: string; count: number }[]; color: string; title: string }) => {
    const dynamicHeight = Math.max(100, barData.length * 36);
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col">
        <h4 className="text-[11px] font-bold text-text-secondary mb-4 uppercase tracking-widest">{title}</h4>
        {barData.length === 0 ? (
          <EmptyState
            title="Belum ada data RCA"
            description="Tidak ada kasus RCA pada kategori ini untuk filter saat ini."
            variant="data"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ResponsiveContainer width="100%" height={dynamicHeight}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
                formatter={(value: any) => [value, 'Kasus']}
              />
              <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} maxBarSize={20}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: 'var(--color-text-primary)', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-text-primary">CSAT Root Cause Analysis</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Analisa akar masalah berdasarkan kasus after-takeout | {activeFilterText || 'All Data'}
        </p>
      </div>

      {/* Warning if no RCA data */}
      {!hasRcaData && (
        <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-xl p-4">
          <AlertCircle className="text-warning mt-0.5 shrink-0" size={16} />
          <div>
            <p className="text-sm font-semibold text-text-primary">Kolom RCA Belum Terdeteksi</p>
            <p className="text-xs text-text-muted mt-1">
              Pastikan Google Sheet <strong>CSAT SC</strong> sudah memiliki kolom header persis:
              <code className="ml-1 bg-surface px-1 rounded text-[10px]">RCA Agent Area</code>,
              <code className="ml-1 bg-surface px-1 rounded text-[10px]">RCA Customer Area</code>,
              <code className="ml-1 bg-surface px-1 rounded text-[10px]">RCA Akulaku Process</code>. Setelah itu, refresh data.
            </p>
          </div>
        </div>
      )}

      {/* Tier 1: Pie + Legend Cards */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary mb-6 text-center tracking-wide">Distribusi Penyebab Bad CSAT</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">

          {/* Pie chart */}
          <div className="md:col-span-3 h-72 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={68}
                    dataKey="value"
                    paddingAngle={2}
                    labelLine={false}
                    label={CustomPieLabel}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: any) => [`${value} kasus`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Belum ada data RCA"
                description="Pastikan data CSAT SC memiliki kolom RCA dan kasus bad CSAT."
                variant="data"
                className="w-full border-0 bg-transparent py-6"
              />
            )}
          </div>

          {/* Legend cards */}
          <div className="md:col-span-2 flex flex-col gap-3">
            {legendItems.map(item => (
              <div
                key={item.key}
                className="flex items-center gap-4 p-4 rounded-xl border"
                style={{ background: item.bg, borderColor: item.border }}
              >
                <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ background: item.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary">{item.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {grandTotal > 0 ? `${((item.count / grandTotal) * 100).toFixed(1)}%` : '-'} dari total kasus
                  </p>
                </div>
                <span className="text-2xl font-black shrink-0" style={{ color: item.color }}>{item.count}</span>
              </div>
            ))}
            <div className="text-center text-[10px] text-text-muted pt-1">
              Total kasus dianalisa: <strong className="text-text-primary">{grandTotal}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 2: 3 Detail Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DetailBarChart data={agentDetailBar} color={COLORS.agent} title="Top Issue - Agent Area" />
        <DetailBarChart data={customerDetailBar} color={COLORS.customer} title="Top Issue - Customer Area" />
        <DetailBarChart data={akulakuDetailBar} color={COLORS.akulaku} title="Top Issue - Akulaku Process" />
      </div>

      {/* Tier 3: Agent RCA Table */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Profil RCA Per Agent</h3>
            <p className="text-[10px] text-text-muted mt-0.5">Ranking berdasarkan total kasus</p>
          </div>
          <input
            type="text"
            placeholder="Cari nama / TL..."
            value={agentSearch}
            onChange={e => setAgentSearch(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary w-48 transition-colors"
          />
        </div>
        {filteredAgentRanking.length === 0 ? (
          <EmptyState
            title="Belum ada data RCA agent"
            description="Coba ubah pencarian agent/TL atau filter global."
            variant="filter"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-surface/80 text-text-secondary border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 font-bold w-8 text-center">#</th>
                  <th className="px-3 py-2.5 font-bold">Nama Agent</th>
                  <th className="px-3 py-2.5 font-bold">Team Leader</th>
                  <th className="px-3 py-2.5 font-bold text-center" style={{ color: COLORS.agent }}>Agent Area</th>
                  <th className="px-3 py-2.5 font-bold text-center" style={{ color: COLORS.customer }}>Customer Area</th>
                  <th className="px-3 py-2.5 font-bold text-center" style={{ color: COLORS.akulaku }}>Akulaku Process</th>
                  <th className="px-3 py-2.5 font-bold text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgentRanking.map((a, i) => (
                  <tr key={a.name} className="border-b border-border/60 hover:bg-surface/60 transition-colors">
                    <td className="px-3 py-2.5 text-center text-text-muted font-semibold">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary max-w-[160px] truncate" title={a.name}>{a.name}</td>
                    <td className="px-3 py-2.5 text-text-muted max-w-[130px] truncate" title={a.tl}>{a.tl || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {a.agentCases > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shadow-sm" style={{ background: COLORS.agent }}>{a.agentCases}</span>
                        : <span className="text-text-muted text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {a.customerCases > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shadow-sm" style={{ background: COLORS.customer }}>{a.customerCases}</span>
                        : <span className="text-text-muted text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {a.akulakuCases > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shadow-sm" style={{ background: COLORS.akulaku }}>{a.akulakuCases}</span>
                        : <span className="text-text-muted text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-text-primary text-[13px]">{a.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
