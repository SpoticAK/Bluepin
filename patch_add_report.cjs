const fs = require('fs');
const file = 'src/components/AddReportFlow.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `          ) : errorMsg ? (
            <div className="p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
              <h3 className="text-xl font-bold text-theme-text mb-2">Upload Failed</h3>`;

const replacement = `          ) : errorMsg ? (
            <div className="p-8 text-center min-h-[300px] flex flex-col items-center justify-center relative">
              <button onClick={onClose} className="absolute top-4 right-4 p-2 text-theme-text-sec hover:text-theme-text transition-colors">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-theme-text mb-2">Upload Failed</h3>`;

code = code.replace(target, replacement);

fs.writeFileSync(file, code);
