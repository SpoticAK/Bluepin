const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/const otherMembers = Object.values\(familySummaries\).filter\(\(m: any\) => m.userId !== currentUserId\) as any\[\];\n/g, '');
code = code.replace(/\/\/ --- Family ---\n/g, '');
code = code.replace(/const familyAttention = otherMembers.filter\(m => m.healthScore < 80\);\n/g, '');
code = code.replace(/familySummaries, /g, '');

fs.writeFileSync('src/components/Dashboard.tsx', code);
