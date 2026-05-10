const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace 'sticky left-0' -> 'md:sticky left-auto md:left-0'
  // Or simply 'sticky left-' -> 'md:sticky md:left-'
  // We need to match things like `sticky left-[60px] z-40 bg-surface`
  // A safe regex to replace sticky left on mobile is:
  // change `sticky left-0` to `md:sticky md:left-0`
  // change `sticky left-[px]` to `md:sticky md:left-[px]`
  
  // We should also replace `z-40` and `z-20` if they appear near sticky left, 
  // but it might be easier to just change `sticky left-` to `md:sticky md:left-`, 
  // which will disable horizontal sticky on mobile.
  
  content = content.replace(/\bsticky left-0\b/g, "md:sticky md:left-0");
  content = content.replace(/\bsticky left-\[/g, "md:sticky md:left-[");

  fs.writeFileSync(filePath, content);
});

console.log("Patched sticky classes.");
