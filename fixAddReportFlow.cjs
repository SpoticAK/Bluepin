const fs = require('fs');
let code = fs.readFileSync('src/components/AddReportFlow.tsx', 'utf8');

const strToReplace = `<div className="mt-8">`;
const replaceWith = `<div className="mt-8 space-y-4">
                <div className="bg-theme-bg p-3 rounded-lg border border-theme-border/50">
                  <p className="text-[11px] text-theme-text-sec leading-relaxed text-center">
                    By uploading this report, you confirm that you have the right to upload it and consent to its processing in accordance with our Privacy Policy.
                  </p>
                </div>`;

if (code.includes(strToReplace)) {
  code = code.replace(strToReplace, replaceWith);
  fs.writeFileSync('src/components/AddReportFlow.tsx', code);
  console.log("Updated AddReportFlow.tsx");
} else {
  console.log("Target not found in AddReportFlow");
}
