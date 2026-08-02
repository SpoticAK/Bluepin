const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldReminders = `      {/* PENDING REMINDERS FLOATING NOTIFIER */}
      <AnimatePresence>
        {activeReminders.length > 0 && !hasSeenReminders && showNotifierReady && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed left-6 sm:left-8 bottom-24 md:bottom-10 z-40"
          >
            <div className="bg-white/95 dark:bg-[#1a2332]/95 backdrop-blur-md p-2 px-3 rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-theme-border/50 flex flex-col items-center">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK ADD FLOATING BUTTON */}
      <button 
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-24 md:bottom-10 right-6 sm:right-8 w-14 h-14 bg-theme-text text-theme-bg rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>`;

const newLayout = `      {/* FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-24 md:bottom-10 left-6 sm:left-8 right-6 sm:right-8 z-40 flex items-center justify-between pointer-events-none">
        
        {/* PENDING REMINDERS FLOATING NOTIFIER */}
        <div className="flex-1 flex justify-start">
          <AnimatePresence>
            {activeReminders.length > 0 && !hasSeenReminders && showNotifierReady && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="pointer-events-auto"
              >
                <div className="bg-white/95 dark:bg-[#1a2332]/95 backdrop-blur-md p-2 px-3 rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-theme-border/50 flex flex-col items-center">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* QUICK ADD FLOATING BUTTON */}
        <div className="flex-1 flex justify-end">
          <button 
            onClick={() => setShowQuickAdd(true)}
            className="pointer-events-auto w-14 h-14 bg-theme-text text-theme-bg rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={28} />
          </button>
        </div>
      </div>`;

if (code.includes('PENDING REMINDERS FLOATING NOTIFIER')) {
  code = code.replace(oldReminders, newLayout);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Replaced layout successfully.');
} else {
  console.log('Could not find string to replace.');
}
