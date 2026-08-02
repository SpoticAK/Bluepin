const fs = require('fs');
let code = fs.readFileSync('src/lib/derivedMetrics.ts', 'utf8');

code = code.replace(/isFamilyMember = false/g, '');
code = code.replace(/export function getSugarInsights\(history: any\[\], \) \{/g, 'export function getSugarInsights(history: any[]) {');
code = code.replace(/const filterKey = isFamilyMember \? 'type' : 'timing';/g, "const filterKey = 'timing';");
code = code.replace(/const ppKey = isFamilyMember \? 'Post-prandial' : 'Post-Prandial';/g, "const ppKey = 'Post-Prandial';");

fs.writeFileSync('src/lib/derivedMetrics.ts', code);
