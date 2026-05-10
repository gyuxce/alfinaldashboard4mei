const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/\bsticky left-0\b/g, "md:sticky md:left-0");
  content = content.replace(/\bsticky left-\[/g, "md:sticky md:left-[");

  fs.writeFileSync(filePath, content);
});

console.log("Patched sticky classes.");
