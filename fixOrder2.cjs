const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

code = code.replace(/sortedReports\.map\(\(report, i\) => \(/g, '[...sortedReports].reverse().map((report, i) => (');
fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
console.log("Replaced sortedReports.map in BiomarkersTab.tsx");
