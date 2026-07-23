import React, { useState, useMemo } from 'react';
import { AgentKPI } from '../../lib/dataProcessor';
import { formatNum } from '../../lib/utils';
import { Search, Users, Activity, HeartPulse, UserMinus } from 'lucide-react';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';
import { PeriodDelta } from '../ui/PeriodDelta';

export const AttendanceMonitor: React.FC<{ data: AgentKPI[]; previousData?: AgentKPI[] }> = ({ data, previousData = [] }) => {
  const [search, setSearch] = useState('');
  const isComparisonEnabled = useStore(state => state.isComparisonEnabled);
  const comparisonMode = useStore(state => state.comparisonMode);
  
  // Filter active agents only (those with duty or presence) to avoid listing empty records from dict
  const activeData = useMemo(() => {
    return data.filter(a => a.attendanceDuty > 0 || a.attendancePresence > 0 || a.attendanceS > 0 || a.attendanceC > 0 || a.attendancePullout > 0);
  }, [data]);

  const tableData = useMemo(() => {
    return activeData.filter(a => a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase()));
  }, [activeData, search]);

  const { avgTeamAttendance, totalSick, totalPullout, totalOff, totalC, prevAvg, prevSick, prevPullout, prevOff, prevC } = useMemo(() => {
    const calc = (dataset: AgentKPI[]) => {
      const active = dataset.filter(a => a.attendanceDuty > 0 || a.attendancePresence > 0 || a.attendanceS > 0 || a.attendanceC > 0 || a.attendancePullout > 0);
      let totDuty = 0;
      let totPresence = 0;
      let sick = 0;
      let pullout = 0;
      let offDays = 0;
      let leaveDays = 0;
      active.forEach(a => {
         totDuty += a.attendanceDuty;
         totPresence += a.attendancePresence;
         sick += a.attendanceS;
         pullout += a.attendancePullout;
         offDays += a.attendanceOff;
         leaveDays += a.attendanceC;
      });
      return {
        avg: totDuty > 0 ? Math.min(100, (totPresence / totDuty) * 100) : 0,
        sick, pullout, offDays, leaveDays,
      };
    };
    const curr = calc(data);
    const prev = calc(previousData);
    return {
      avgTeamAttendance: curr.avg,
      totalSick: curr.sick,
      totalPullout: curr.pullout,
      totalOff: curr.offDays,
      totalC: curr.leaveDays,
      prevAvg: prev.avg,
      prevSick: prev.sick,
      prevPullout: prev.pullout,
      prevOff: prev.offDays,
      prevC: prev.leaveDays,
    };
  }, [data, previousData]);

  const deltaLabel = comparisonMode === 'mom' ? 'vs MoM' : 'vs WoW';
  const showDelta = isComparisonEnabled && previousData.length > 0;

  const under95Agents = useMemo(() => {
    return activeData
      .filter((a) => a.attendanceDuty > 0 && a.attendanceScore < 95)
      .sort((a, b) => a.attendanceScore - b.attendanceScore);
  }, [activeData]);

  const bpoAttendance = useMemo(() => {
    const map: Record<string, { duty: number; presence: number; agents: number }> = {};
    activeData.forEach((a) => {
      const bpo = (a.bpo || '-').toUpperCase();
      if (!map[bpo]) map[bpo] = { duty: 0, presence: 0, agents: 0 };
      map[bpo].duty += a.attendanceDuty;
      map[bpo].presence += a.attendancePresence;
      map[bpo].agents += 1;
    });
    return Object.entries(map)
      .map(([bpo, s]) => ({
        bpo,
        agents: s.agents,
        avg: s.duty > 0 ? Math.min(100, (s.presence / s.duty) * 100) : 0,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [activeData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Attendance Monitor</h1>
          <p className="text-xs text-text-muted mt-1">Based on Schedule data mapping.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search CS ID or Name..." 
            className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:border-primary focus:outline-none w-full md:w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      {/* WIDGETS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <div className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
               <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest z-10">Avg Team Attendance</div>
               <div className="w-7 h-7 rounded-full bg-primary-soft flex items-center justify-center z-10 shrink-0">
                 <Users className="w-3.5 h-3.5 text-primary" />
               </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-primary z-10">{formatNum(avgTeamAttendance, 1)}%</div>
            {showDelta && (
              <PeriodDelta current={avgTeamAttendance} previous={prevAvg} suffix="%" label={deltaLabel} className="mt-1" />
            )}
         </div>
         <div className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
               <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest z-10">Total OFF</div>
               <div className="w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center z-10 shrink-0">
                 <Activity className="w-3.5 h-3.5 text-text-muted" />
               </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text-primary z-10">{formatNum(totalOff, 0)}</div>
            {showDelta && (
              <PeriodDelta current={totalOff} previous={prevOff} digits={0} lowerIsBetter label={deltaLabel} className="mt-1" />
            )}
         </div>
         <div className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
               <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest z-10">Total Cuti (C)</div>
               <div className="w-7 h-7 rounded-full bg-warning-soft flex items-center justify-center z-10 shrink-0">
                 <HeartPulse className="w-3.5 h-3.5 text-warning" />
               </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text-primary z-10">{formatNum(totalC, 0)}</div>
            {showDelta && (
              <PeriodDelta current={totalC} previous={prevC} digits={0} lowerIsBetter label={deltaLabel} className="mt-1" />
            )}
         </div>
         <div className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
               <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest z-10">Total Sick (S)</div>
               <div className="w-7 h-7 rounded-full bg-danger-soft flex items-center justify-center z-10 shrink-0">
                 <HeartPulse className="w-3.5 h-3.5 text-danger" />
               </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text-primary z-10">{formatNum(totalSick, 0)}</div>
            {showDelta && (
              <PeriodDelta current={totalSick} previous={prevSick} digits={0} lowerIsBetter label={deltaLabel} className="mt-1" />
            )}
         </div>
         <div className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-border p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
               <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest z-10">Total PULLOUT</div>
               <div className="w-7 h-7 rounded-full bg-success-soft flex items-center justify-center z-10 shrink-0">
                 <UserMinus className="w-3.5 h-3.5 text-success" />
               </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text-primary z-10">{formatNum(totalPullout, 0)}</div>
            {showDelta && (
              <PeriodDelta current={totalPullout} previous={prevPullout} digits={0} lowerIsBetter label={deltaLabel} className="mt-1" />
            )}
         </div>
      </div>

      {bpoAttendance.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted text-[11px] font-bold uppercase tracking-widest text-text-secondary">
            Attendance by BPO
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-0 divide-x divide-y divide-border">
            {bpoAttendance.map((b) => (
              <div key={b.bpo} className="p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted truncate">{b.bpo}</div>
                <div className={`text-lg font-black ${b.avg >= 95 ? 'text-success' : 'text-danger'}`}>
                  {formatNum(b.avg, 1)}%
                </div>
                <div className="text-[10px] text-text-muted">{formatNum(b.agents, 0)} agents</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {under95Agents.length > 0 && (
        <div className="bg-card border border-danger/30 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-danger/5 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-danger">Exception: Attendance &lt; 95%</div>
              <div className="text-xs text-text-muted mt-0.5">{under95Agents.length} agent perlu dicek</div>
            </div>
          </div>
          <div className="max-h-[220px] overflow-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-surface text-text-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10 text-center">#</th>
                  <th className="p-2">Agent</th>
                  <th className="p-2">BPO</th>
                  <th className="p-2">TL</th>
                  <th className="p-2 text-center">Duty</th>
                  <th className="p-2 text-center">Presence</th>
                  <th className="p-2 text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {under95Agents.map((a, idx) => (
                  <tr key={a.csId} className="border-b border-border hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted">{idx + 1}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => useStore.getState().setSelectedAgentFor360(a.csId)}
                        className="font-semibold text-kpi-neutral-text hover:underline"
                      >
                        {a.name || a.csId}
                      </button>
                    </td>
                    <td className="p-2 uppercase text-text-secondary">{a.bpo || '-'}</td>
                    <td className="p-2 text-text-secondary">{a.teamLeader || '-'}</td>
                    <td className="p-2 text-center">{a.attendanceDuty}</td>
                    <td className="p-2 text-center">{a.attendancePresence}</td>
                    <td className="p-2 text-center font-bold text-danger">{formatNum(a.attendanceScore, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 max-h-[calc(100vh-280px)]">
          <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
            <thead className="bg-surface text-text-secondary sticky top-0 z-30">
              <tr>
                <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                <th className="p-2 font-bold  md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]">Name / CS ID</th>
                <th className="p-2 font-bold  md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]">BPO</th>
                <th className="p-2 font-bold  md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]">Team Leader</th>
                <th className="p-2 font-bold text-center  bg-surface">Duty</th>
                <th className="p-2 font-bold text-center  bg-surface">Presence</th>
                <th className="p-2 font-bold text-center  bg-surface">OFF</th>
                <th className="p-2 font-bold text-center  bg-surface">C</th>
                <th className="p-2 font-bold text-center  bg-surface">S</th>
                <th className="p-2 font-bold text-center  bg-surface">PULL OUT</th>
                <th className="p-2 font-bold text-center  bg-surface">Total Days</th>
                <th className="p-2 font-bold text-center bg-surface">Attendance %</th>
              </tr>
            </thead>
            <tbody className="">
              {tableData.map((agent, index) => {
                 let colorScore = 'text-text-primary';
                 if (agent.attendanceScore >= 100) colorScore = 'text-success';
                 else if (agent.attendanceScore < 100) colorScore = 'text-danger';
                 
                 const totalDays = agent.attendanceTotalDays;
                 const displayName = agent.name || agent.csId;

                 return (
                  <tr key={agent.csId} className="border-b border-border transition-colors group hover:bg-surface-muted">
                    <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[60px] max-w-[60px]">{index + 1}</td>
                    <td className="p-2 font-medium md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[250px] max-w-[250px] truncate">
                      <button 
                        onClick={() => useStore.getState().setSelectedAgentFor360(agent.csId)}
                        className="text-kpi-neutral-text hover:underline font-semibold"
                      >
                        {displayName}
                      </button>
                      <div className="text-[9px] text-text-muted font-normal mt-0.5">{agent.csId}</div>
                    </td>
                    <td className="p-2 font-medium text-text-primary uppercase truncate md:sticky md:left-[310px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[80px] max-w-[80px]">{agent.bpo || '-'}</td>
                    <td className="p-2 font-medium text-text-primary truncate md:sticky md:left-[390px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[120px] max-w-[120px]">{agent.teamLeader || '-'}</td>
                    <td className="p-2 text-center font-bold text-[11px] text-text-primary z-10 relative">{agent.attendanceDuty}</td>
                    <td className="p-2 text-center font-bold text-[11px] text-primary z-10 relative">{agent.attendancePresence}</td>
                    <td className="p-2 text-center text-text-muted z-10 relative">{agent.attendanceOff || '-'}</td>
                    <td className="p-2 text-center text-text-muted z-10 relative">{agent.attendanceC || '-'}</td>
                    <td className="p-2 text-center text-text-muted z-10 relative">{agent.attendanceS || '-'}</td>
                    <td className="p-2 text-center font-bold text-[11px] text-success z-10 relative">{agent.attendancePullout || '-'}</td>
                    <td className="p-2 text-center font-bold text-[11px] text-text-primary z-10 relative">{totalDays}</td>
                    <td className={`p-2 text-center font-bold text-[11px] z-10 relative ${colorScore}`}>
                      {formatNum(agent.attendanceScore, 1)}%
                    </td>
                  </tr>
                );
              })}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-4 z-10 relative">
                    <EmptyState
                      title="Tidak ada data attendance"
                      description="Jika belum sync, buka File Center lalu klik Sync Now. Jika sudah sync, coba ubah search atau range tanggal."
                      variant="filter"
                      className="border-0 bg-transparent py-6"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
};
