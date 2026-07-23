import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AgentKPI, normalizeDateStr } from '../../lib/dataProcessor';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';

export const ScheduleBoard: React.FC<{ data: AgentKPI[] }> = ({ data }) => {
  const [search, setSearch] = useState('');
  const { startDate, endDate, setDateRange } = useStore();

  const tableData = data.filter(a => a.csId.toLowerCase().includes(search.toLowerCase()) || (a.name || '').toLowerCase().includes(search.toLowerCase()));

  // One column per calendar day (avoid duplicate labels like 1/7/2026 vs 01/07/2026)
  const byNorm = new Map<string, string>();
  data.forEach((d) => {
    d.dailyHistory.schedule.forEach((x) => {
      const nd = x.normDate || normalizeDateStr(x.date);
      if (nd && !byNorm.has(nd)) byNorm.set(nd, x.date);
    });
  });
  const uniqueDates = Array.from(byNorm.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, date]) => date);

  const getBackgroundColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'S') return 'text-danger font-bold'; // Sakit
    if (/^\d+([.,]\d+)?$/.test(s) || /^\d{1,2}:\d{2}/.test(s)) return 'text-success font-bold'; // Shift
    if (s === 'OFF' || s === 'C') return 'text-text-muted'; // Cuti / OFF
    if (s === 'PULLOUT') return 'text-text-muted italic'; // Pullout
    return 'text-text-primary';
  };

  return (
    <div className="space-y-4 max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between mx-4">
        <h1 className="text-lg font-bold text-text-primary">Schedule Board</h1>
        
        <div className="flex gap-4">
           <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1.5 text-text-muted" />
             <input
               type="text"
               placeholder="Search CS ID or Name..."
               className="pl-9 pr-4 py-1.5 border border-border rounded-lg text-xs w-64 focus:outline-none focus:ring-1 focus:ring-primary bg-card text-text-primary"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>
        </div>
      </div>

      <div className="relative w-full overflow-auto bg-card border text-sm border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl transition-all flex-1 mx-4 max-h-[calc(100vh-280px)]">
          <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse">
            <thead className="bg-surface text-text-secondary sticky top-0 z-30">
              <tr>
                <th className="p-2 font-bold text-center  md:sticky md:left-0 z-40 bg-surface min-w-[60px] max-w-[60px]">No</th>
                <th className="p-2 font-bold  md:sticky md:left-[60px] z-40 bg-surface min-w-[250px] max-w-[250px]">Name / CS ID</th>
                <th className="p-2 font-bold  md:sticky md:left-[310px] z-40 bg-surface min-w-[80px] max-w-[80px]">BPO</th>
                <th className="p-2 font-bold  md:sticky md:left-[390px] z-40 bg-surface min-w-[120px] max-w-[120px]">Team Leader</th>
                {uniqueDates.map(date => (
                  <th key={date} className="p-2 font-bold text-center text-text-muted bg-surface ">
                    {date}
                  </th>
                ))}
                <th className="p-2 font-bold text-center text-text-primary  bg-surface shrink-0 z-30 relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                  Total Man-Days
                </th>
              </tr>
            </thead>
            <tbody className="">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={5 + uniqueDates.length} className="p-4 z-10 relative">
                    <EmptyState
                      title="Tidak ada data schedule"
                      description="Jika belum sync, buka File Center lalu klik Sync Now. Jika sudah sync, coba ubah search atau range tanggal."
                      variant="filter"
                      className="border-0 bg-transparent py-6"
                    />
                  </td>
                </tr>
              ) : tableData.map((agent, idx) => {
                const displayName = agent.name || agent.csId;

                return (
                <tr key={agent.csId} className="border-b border-border transition-colors group hover:bg-surface-muted">
                  <td className="p-2 text-center text-text-muted font-medium md:sticky md:left-0 z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[60px] max-w-[60px]">{idx + 1}</td>
                  <td className="p-2 font-medium md:sticky md:left-[60px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[250px] max-w-[250px] truncate">
                    <button 
                      onClick={() => useStore.getState().setSelectedAgentFor360(agent.csId)}
                      className="text-kpi-neutral-text hover:underline font-semibold"
                    >
                      {displayName}
                    </button>
                    <div className="text-[9px] text-text-muted font-normal mt-0.5">{agent.csId}</div>
                  </td>
                  <td className="p-2 font-medium text-text-primary uppercase md:sticky md:left-[310px] z-20 bg-card group-hover:bg-surface-muted min-w-[80px] max-w-[80px] truncate">
                    {agent.bpo || '-'}
                  </td>
                  <td className="p-2 font-medium text-text-primary md:sticky md:left-[390px] z-20 bg-card group-hover:bg-surface-muted transition-colors min-w-[120px] max-w-[120px] truncate">{agent.teamLeader || '-'}</td>
                  
                  {uniqueDates.map(date => {
                    const dateNorm = normalizeDateStr(date);
                    const sched = agent.dailyHistory.schedule.find(
                      (s) =>
                        s.date === date ||
                        (dateNorm != null && s.normDate === dateNorm),
                    );
                    const status = sched ? sched.status : '-';
                    const bgClass = getBackgroundColor(status);
                    
                    return (
                      <td key={date} className={`p-2 text-center  z-10 transition-colors  `}>
                         <span className={`px-2 py-0.5 rounded w-full inline-block font-bold text-[10px] ${bgClass}`}>{status}</span>
                      </td>
                    );
                  })}
                  
                  <td className="p-2 text-center font-bold text-text-primary shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                    {agent.manDays}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
      </div>
    </div>
  );
};
