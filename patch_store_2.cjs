const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const regexToRemoveFunctions = /const createFamily = async[\s\S]*?const loadMemberDetailedData = async[\s\S]*?return \{\};\n\s*\}\n\s*\};\n/g;
// Actually I will just replace the exact text.
code = code.replace(/createFamily, joinFamily, leaveFamily, createInvitation, loadMemberDetailedData/g, '');

fs.writeFileSync('src/store.tsx', code);
