import fs from 'fs';
let code = fs.readFileSync('src/store.tsx', 'utf8');

code = code.replace(
  "if (hba1cBiomarker && !isNaN(parseFloat(hba1cBiomarker.value))) {",
  "if (hba1cBiomarker && typeof hba1cBiomarker.value === 'number' && !isNaN(hba1cBiomarker.value)) {"
);
code = code.replace(
  "const val = parseFloat(hba1cBiomarker.value);",
  "const val = hba1cBiomarker.value;"
);

fs.writeFileSync('src/store.tsx', code);
