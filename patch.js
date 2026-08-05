const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

code = code.replace(
  /if \(hba1cBiomarker && !isNaN\(parseFloat\(hba1cBiomarker.value\)\)\) \{\n\s*const val = parseFloat\(hba1cBiomarker.value\);/,
  \`if (hba1cBiomarker && typeof hba1cBiomarker.value === 'number') {
         const val = hba1cBiomarker.value;\`
);

fs.writeFileSync('src/store.tsx', code);
