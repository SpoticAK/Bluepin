const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const regexToRemoveFunctions = /const createFamily = async[\s\S]*?const leaveFamily = async \(\) => \{[\s\S]*?\}\s*catch \(e: any\) \{[\s\S]*?\}\s*\};\n/g;

code = code.replace(regexToRemoveFunctions, '');

fs.writeFileSync('src/store.tsx', code);
