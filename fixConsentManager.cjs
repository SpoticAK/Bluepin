const fs = require('fs');
let code = fs.readFileSync('src/lib/consentManager.ts', 'utf8');

code = code.replace(
  `export type LegalDocType = 'terms' | 'privacy' | 'consent' | 'medical_disclaimer';`,
  `export type LegalDocType = 'terms' | 'privacy';`
);

fs.writeFileSync('src/lib/consentManager.ts', code);
console.log("Updated consentManager.ts");
