const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const regex = /const handleDownloadFile = async \(fileUrl: string, date: string\) => \{[\s\S]*?\n\};/m;
code = code.replace(regex, '');

fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
console.log("Deleted handleDownloadFile from BiomarkersTab.tsx");
