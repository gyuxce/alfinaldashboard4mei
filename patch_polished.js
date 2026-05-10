import fs from 'fs';
import path from 'path';

function patchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      patchFiles(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Update shadows 
      content = content.replace(/shadow-sm/g, 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]');
      
      // Update "bg-card rounded-lg" to "bg-card rounded-xl"
      // we already updated SummaryWidgets and StatCards, but let's safely catch others
      // Wait, there are text inputs etc that use rounded-lg. Is that fine to become xl?
      // Let's only target bg-card
      content = content.replace(/bg-card([^"}]*)rounded-lg/g, 'bg-card$1rounded-xl');
      content = content.replace(/bg-card([^"}]*)rounded /g, 'bg-card$1rounded-xl ');

      // search bars with rounded -> rounded-lg
      content = content.replace(/pl-8 pr-3 py-1\.5 border border-border( bg-card text-text-primary)? rounded text-xs/g, 
        'pl-8 pr-3 py-1.5 border border-border$1 rounded-lg text-xs');
      content = content.replace(/pl-8 pr-3 py-1\.5 border border-border rounded text-xs/g, 
        'pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs');

      // Table containers
      content = content.replace(/shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] rounded-2xl/g, 'shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl');
      content = content.replace(/shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] rounded-lg/g, 'shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl');

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

patchFiles('src');
console.log('Polished radii and shadows');
