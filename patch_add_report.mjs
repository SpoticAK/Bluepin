import fs from 'fs';
let code = fs.readFileSync('src/components/AddReportFlow.tsx', 'utf8');

code = code.replace(
  "const chunkSize = 500 * 1024;",
  "const chunkSize = 8 * 1024 * 1024;"
);

fs.writeFileSync('src/components/AddReportFlow.tsx', code);
