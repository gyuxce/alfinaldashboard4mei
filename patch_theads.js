import fs from 'fs';

const filesToPatch = [
  { path: 'src/components/DashboardSummary.tsx', theme: 'var(--color-surface)' },
  { path: 'src/components/CsatOfficialMonitor.tsx', theme: 'rgb(var(--kpi-csat-soft))' },
  { path: 'src/components/CsatRoom.tsx', theme: 'rgb(var(--kpi-csat-soft))' },
  { path: 'src/components/SlaWhuMonitor.tsx', theme: 'rgb(var(--kpi-sla-soft))' },
  { path: 'src/components/WhuMonitor.tsx', theme: 'rgb(var(--kpi-whu-soft))' },
  { path: 'src/components/QaAgent360.tsx', theme: 'rgb(var(--kpi-qa-soft))' },
  { path: 'src/components/AttendanceMonitor.tsx', theme: 'var(--color-surface)' },
  { path: 'src/components/ScheduleBoard.tsx', theme: 'var(--color-surface)' },
  { path: 'src/components/Leaderboard.tsx', theme: 'var(--color-surface)' },
];

for (const { path, theme } of filesToPatch) {
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');
  
  content = content.replace(/<thead className="(?:text-text-primary )?bg-card sticky top-0 z-30">/g, 
    `<thead className="text-text-primary sticky top-0 z-30" style={{ backgroundColor: '${theme}' }}>`);
  
  content = content.replace(/<thead className="sticky top-0 z-30 text-text-primary bg-card">/g, 
    `<thead className="text-text-primary sticky top-0 z-30" style={{ backgroundColor: '${theme}' }}>`);

  // Target th tags inside thead
  const theadBlockRegex = /(<thead[^>]*>)([\s\S]*?)(<\/thead>)/g;
  content = content.replace(theadBlockRegex, (match, openTag, ths, closeTag) => {
    let replacedThs = ths.replace(/bg-card/g, 'bg-inherit')
                         .replace(/bg-surface-muted\/50/g, 'bg-inherit')
                         .replace(/bg-surface-muted/g, 'bg-inherit');
                         
    return `${openTag}${replacedThs}${closeTag}`;
  });

  fs.writeFileSync(path, content, 'utf8');
  console.log(`Updated ${path}`);
}
