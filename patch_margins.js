import fs from 'fs';
import path from 'path';

function patchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      patchFiles(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      content = content.replace(/justify-between mb-2 gap-4/g, 'justify-between mb-4 gap-4');
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

patchFiles('src/components');
console.log('Fixed margins');
