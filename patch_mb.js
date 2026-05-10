import fs from 'fs';

const filesToPatch = [
  'src/components/CsatRoom.tsx',
  'src/components/QaAgent360.tsx',
  'src/components/SlaWhuMonitor.tsx',
];

for (const file of filesToPatch) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/gap-4 mb-2/g, 'gap-4 mb-4');
  fs.writeFileSync(file, content, 'utf8');
}
