const fs = require('fs');
let code = fs.readFileSync('src/components/family/FamilyMemberProfile.tsx', 'utf8');

code = code.replace(/displayReports\.map\(\(report, i\) => \(/g, '[...displayReports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((report, i) => (');
fs.writeFileSync('src/components/family/FamilyMemberProfile.tsx', code);
console.log("Replaced displayReports.map in FamilyMemberProfile.tsx");
