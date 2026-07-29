import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  content = content.replace(/hover:bg-neutral-200/g, 'hover:bg-theme-border');
  content = content.replace(/hover:bg-neutral-300/g, 'hover:bg-theme-border/80');
  content = content.replace(/focus:ring-neutral-200/g, 'focus:ring-theme-border');
  content = content.replace(/focus:border-neutral-400/g, 'focus:border-theme-accent');
  content = content.replace(/focus:ring-neutral-900/g, 'focus:ring-theme-accent');
  content = content.replace(/ring-neutral-400/g, 'ring-theme-accent');
  content = content.replace(/bg-neutral-900\/40/g, 'bg-theme-text/40');
  content = content.replace(/bg-neutral-900\/60/g, 'bg-theme-text/60');
  content = content.replace(/bg-neutral-900 text-white/g, 'bg-theme-text text-theme-bg');
  content = content.replace(/bg-neutral-900/g, 'bg-theme-text text-theme-bg'); // Some left?
  content = content.replace(/hover:bg-neutral-800/g, 'hover:opacity-80');
  content = content.replace(/bg-neutral-200/g, 'bg-theme-border');
  content = content.replace(/border-neutral-50/g, 'border-theme-border');

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
