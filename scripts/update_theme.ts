import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // text colors
  content = content.replace(/text-neutral-[789]00/g, 'text-theme-text');
  content = content.replace(/text-neutral-[456]00/g, 'text-theme-text-sec');
  content = content.replace(/text-neutral-300/g, 'text-theme-border');
  
  // bg colors
  content = content.replace(/bg-white/g, 'bg-theme-card');
  content = content.replace(/bg-neutral-50/g, 'bg-theme-card-sec');
  content = content.replace(/bg-neutral-100/g, 'bg-theme-card-sec');
  content = content.replace(/bg-neutral-700\s+text-white/g, 'bg-theme-text text-theme-bg');

  // borders
  content = content.replace(/border-neutral-[123]00/g, 'border-theme-border');

  // specific theme colors
  content = content.replace(/text-red-[56]00/g, 'text-theme-critical');
  content = content.replace(/bg-red-50/g, 'bg-theme-critical/10');
  content = content.replace(/bg-red-100/g, 'bg-theme-critical/20');
  content = content.replace(/border-red-[15]00/g, 'border-theme-critical');

  content = content.replace(/text-amber-[568]00/g, 'text-theme-warning');
  content = content.replace(/bg-amber-50/g, 'bg-theme-warning/10');
  content = content.replace(/bg-amber-100/g, 'bg-theme-warning/20');
  content = content.replace(/border-amber-[15]00/g, 'border-theme-warning');

  content = content.replace(/text-emerald-[568]00/g, 'text-theme-success');
  content = content.replace(/bg-emerald-50/g, 'bg-theme-success/10');
  content = content.replace(/bg-emerald-100/g, 'bg-theme-success/20');
  content = content.replace(/border-emerald-[15]00/g, 'border-theme-success');

  content = content.replace(/text-green-[567]00/g, 'text-theme-success');
  content = content.replace(/bg-[#39ff14]\/5/g, 'bg-theme-success/10');
  content = content.replace(/border-[#39ff14]\/30/g, 'border-theme-success/30');
  content = content.replace(/border-[#39ff14]/g, 'border-theme-success');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

const walk = (dir: string) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx')) {
      replaceInFile(p);
    }
  }
};

walk('./src/components');
