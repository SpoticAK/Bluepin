const fs = require('fs');
let code = fs.readFileSync('src/lib/biomarkerUtils.ts', 'utf8');

const oldBlock = `
  if (clinicalRefText !== undefined || clinicalMin !== undefined || clinicalMax !== undefined) {
      result.refMin = clinicalMin !== undefined ? clinicalMin : null;
      result.refMax = clinicalMax !== undefined ? clinicalMax : null;
      result.refRangeText = clinicalRefText !== undefined ? clinicalRefText : null;
      
      const fileHasDifferentRange = !isMissingOrZero && (min !== result.refMin || max !== result.refMax);
      
      if (!info) {
          if (isMissingOrZero) {
              info = \`Reference range not provided in report. Using general clinical guidelines\${clinicalReasoning ? ': ' + clinicalReasoning : '.'}\`;
          } else if (fileHasDifferentRange) {
              info = \`Using general clinical guidelines for optimal reference range, which may differ from the laboratory report's reference range\${clinicalReasoning ? '. ' + clinicalReasoning : '.'}\`;
          }
      }
  } else if (isMissingOrZero) {
`;

const newBlock = `
  if (clinicalRefText !== undefined || clinicalMin !== undefined || clinicalMax !== undefined) {
      result.refMin = clinicalMin !== undefined ? clinicalMin : null;
      result.refMax = clinicalMax !== undefined ? clinicalMax : null;
      result.refRangeText = clinicalRefText !== undefined ? clinicalRefText : null;
      
      let fileHasDifferentRange = false;
      if (!isMissingOrZero) {
          if (clinicalMin !== undefined && min !== null && Math.abs(min - clinicalMin) > 0.01) {
              fileHasDifferentRange = true;
          }
          if (clinicalMax !== undefined && max !== null && Math.abs(max - clinicalMax) > 0.01) {
              fileHasDifferentRange = true;
          }
      }
      
      if (!info) {
          if (isMissingOrZero) {
              info = \`Reference range not provided in report. Using general clinical guidelines\${clinicalReasoning ? ': ' + clinicalReasoning : '.'}\`;
          } else if (fileHasDifferentRange) {
              info = \`Using general clinical guidelines for optimal reference range, which may differ from the laboratory report's reference range\${clinicalReasoning ? '. ' + clinicalReasoning : '.'}\`;
          }
      }
  } else if (isMissingOrZero) {
`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/lib/biomarkerUtils.ts', code);
