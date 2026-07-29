import fs from 'fs';

let content = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf-8');

// Replace scorecard bg
content = content.replace('bg-[#0a0a0a]', 'bg-gradient-to-br from-theme-card to-emerald-50/50 dark:from-theme-card dark:to-theme-card');

// Remove border-white/5 from it and use border-theme-border
content = content.replace('border-white/5', 'border-theme-border');

// Replace scorecard shadow
content = content.replace('shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]', 'shadow-xl shadow-neutral-200/50 dark:shadow-none');

// Text colors inside scorecard: text-white -> text-theme-text
// But we need to be careful not to break other stuff
content = content.replace(/text-white font-bold text-\[5rem\]/g, 'text-theme-text font-bold text-[5rem]');
content = content.replace(/text-white text-5xl/g, 'text-theme-text text-5xl');
content = content.replace(/text-white font-bold text-xl leading-none/g, 'text-theme-text font-bold text-xl leading-none');

// Other things like border-white/10 to border-theme-border
content = content.replace(/border-white\/10/g, 'border-theme-border');

// Other things like bg-theme-card/5 to bg-theme-card-sec
content = content.replace(/bg-theme-card\/5/g, 'bg-theme-card-sec');

fs.writeFileSync('src/components/BiomarkersTab.tsx', content);
console.log('Done');
