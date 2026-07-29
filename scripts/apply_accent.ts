import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Replace bg-theme-text text-theme-bg on primary buttons with bg-theme-accent text-white
  content = content.replace(/bg-theme-text text-theme-bg/g, 'bg-theme-accent text-white hover:opacity-90');
  content = content.replace(/bg-theme-text hover:opacity-90 text-theme-bg/g, 'bg-theme-accent hover:opacity-90 text-white');
  content = content.replace(/bg-theme-text hover:opacity-90/g, 'bg-theme-accent hover:opacity-90');

  // Replace emerald references with theme-accent in specific gradient cases
  content = content.replace(/to-emerald-50\/50/g, 'to-theme-accent/10');
  
  // Convert any remaining emerald-600 to theme-accent
  content = content.replace(/bg-emerald-600/g, 'bg-theme-accent text-white');
  content = content.replace(/hover:bg-emerald-700/g, 'hover:bg-theme-accent/90');
  content = content.replace(/text-emerald-300/g, 'text-theme-accent');

  // Replace shadow glows
  content = content.replace(/shadow-neutral-200\/50/g, 'shadow-theme-accent/10');

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
