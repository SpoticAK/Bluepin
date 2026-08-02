const fs = require('fs');
let code = fs.readFileSync('src/lib/biomarkerUtils.ts', 'utf8');

const oldBlock = `
      if (def.calculateStatus) {
        clinicalStatus = def.calculateStatus(value);
      }
`;

const newBlock = `
      if (def.calculateStatus) {
        clinicalStatus = def.calculateStatus(value);
      } else {
          if (!isNaN(value)) {
              if (clinicalMin !== undefined && clinicalMax !== undefined) {
                  if (value >= clinicalMin && value <= clinicalMax) clinicalStatus = 'Healthy';
                  else {
                      const range = clinicalMax - clinicalMin;
                      const margin = range * 0.15;
                      if ((value >= clinicalMin - margin && value < clinicalMin) || (value <= clinicalMax + margin && value > clinicalMax)) {
                          clinicalStatus = 'Borderline';
                      } else {
                          clinicalStatus = 'Needs Attention';
                      }
                  }
              } else if (clinicalMin !== undefined) {
                  if (value >= clinicalMin) clinicalStatus = 'Healthy';
                  else if (value >= clinicalMin * 0.85) clinicalStatus = 'Borderline';
                  else clinicalStatus = 'Needs Attention';
              } else if (clinicalMax !== undefined) {
                  if (value <= clinicalMax) clinicalStatus = 'Healthy';
                  else if (value <= clinicalMax * 1.15) clinicalStatus = 'Borderline';
                  else clinicalStatus = 'Needs Attention';
              }
          }
      }
`;

code = code.replace(oldBlock.trim(), newBlock.trim());
fs.writeFileSync('src/lib/biomarkerUtils.ts', code);
