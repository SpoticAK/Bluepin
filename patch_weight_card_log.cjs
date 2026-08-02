const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldRecentLogsCode = `const recentLogs = reverseSortedEntries.slice(0, 5);`;

const newRecentLogsCode = `const recentLogs = reverseSortedEntries.slice(0, 5);
  console.log('recentLogs', recentLogs);`;

code = code.replace(oldRecentLogsCode, newRecentLogsCode);
fs.writeFileSync('src/components/WeightCard.tsx', code);
