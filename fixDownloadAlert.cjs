const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');
code = code.replace(/alert\("No file attached to this report."\);/g, `console.warn("No file attached to this report.");`);
fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
