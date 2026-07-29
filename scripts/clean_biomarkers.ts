import fs from 'fs';

let content = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf-8');

// Colors
content = content.replace(/#00ffa3/g, 'var(--color-theme-success)');
content = content.replace(/#4ade80/g, 'var(--color-theme-success)');
content = content.replace(/#facc15/g, 'var(--color-theme-warning)');
content = content.replace(/#fb923c/g, 'var(--color-theme-warning)');
content = content.replace(/#f87171/g, 'var(--color-theme-critical)');
content = content.replace(/rose-500/g, 'theme-critical');
content = content.replace(/yellow-400/g, 'theme-warning');

// Other #39ff14 to theme-success
content = content.replace(/border-\[#39ff14\]\/60/g, 'border-theme-success/60');
content = content.replace(/bg-\[#39ff14\]\/5/g, 'bg-theme-success/10');
content = content.replace(/hover:bg-\[#39ff14\]\/10/g, 'hover:bg-theme-success/20');
content = content.replace(/dot-\[#39ff14\]/g, 'dot-theme-success');
content = content.replace(/shadow-\[0_0_10px_rgba\(57,255,20,0\.3\)\]/g, 'shadow-sm shadow-theme-success/30');
content = content.replace(/border-\[#39ff14\]/g, 'border-theme-success');

content = content.replace(/border-\[#facc15\]/g, 'border-theme-warning');

// Backgrounds
content = content.replace(/bg-neutral-900 text-white/g, 'bg-theme-text text-theme-bg');
content = content.replace(/text-white/g, 'text-theme-text');

fs.writeFileSync('src/components/BiomarkersTab.tsx', content);
