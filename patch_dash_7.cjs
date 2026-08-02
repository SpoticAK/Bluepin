const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldBlock = `<button
              onClick={() => {
                remindersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(251,191,36,0.4)] animate-bounce border-2 border-white dark:border-[#0f172a]">
                <AlertCircle size={20} className="text-white dark:text-[#0f172a]" />
              </div>
              <ChevronDown size={16} className="text-amber-500 dark:text-amber-400 -mt-2 animate-bounce" style={{ animationDelay: '0.1s' }} />
            </button>`;

const newBlock = `<div className="bg-white/95 dark:bg-[#1a2332]/95 backdrop-blur-md p-2 px-3 rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-theme-border/50 flex flex-col items-center">
              <button
                onClick={() => {
                  remindersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform pt-1"
              >
                <div className="w-10 h-10 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(251,191,36,0.4)] animate-bounce border-2 border-white dark:border-[#1a2332]">
                  <AlertCircle size={20} className="text-white dark:text-[#0f172a]" />
                </div>
                <ChevronDown size={16} className="text-amber-500 dark:text-amber-400 -mt-2 animate-bounce" style={{ animationDelay: '0.1s' }} />
              </button>
            </div>`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('src/components/Dashboard.tsx', code);
