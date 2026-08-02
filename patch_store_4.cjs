const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const regexToRemovetypes = /loadMemberDetailedData: \(memberId: string\) => Promise<Partial<AppState>>;\n/g;
code = code.replace(regexToRemovetypes, '');

const regexToRemoveFunctions = /const loadMemberDetailedData = async \(memberId: string\) => \{[\s\S]*?return \{\};\n\s*\}\n\s*\};\n/g;
code = code.replace(regexToRemoveFunctions, '');

fs.writeFileSync('src/store.tsx', code);
