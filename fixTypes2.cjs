const fs = require('fs');

// src/types.ts
let typesCode = fs.readFileSync('src/types.ts', 'utf8');
typesCode = typesCode.replace(`  consentVersion: string;\n`, '');
fs.writeFileSync('src/types.ts', typesCode);

// src/lib/consentManager.ts
let cmCode = fs.readFileSync('src/lib/consentManager.ts', 'utf8');
cmCode = cmCode.replace(`export const CURRENT_CONSENT_VERSION = "1.0.0";\n`, '');
cmCode = cmCode.replace(`\n    consentVersion: CURRENT_CONSENT_VERSION,`, '');
fs.writeFileSync('src/lib/consentManager.ts', cmCode);
console.log("Updated types and consentManager");
