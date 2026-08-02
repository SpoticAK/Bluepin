const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

if (!code.includes('AlertCircle')) {
  code = code.replace(/HeartPulse, User, Flame/, 'HeartPulse, User, Flame, AlertCircle');
}

const hookStr = `  const remindersRef = React.useRef<HTMLElement>(null);
  const [hasSeenReminders, setHasSeenReminders] = useState(false);

  useEffect(() => {
    if (!remindersRef.current || activeReminders.length === 0 || hasSeenReminders) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setHasSeenReminders(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    observer.observe(remindersRef.current);

    return () => observer.disconnect();
  }, [activeReminders.length, hasSeenReminders]);
`;

code = code.replace(/const activeReminders = useMemo\(\(\) => \{/, hookStr + "\n  const activeReminders = useMemo(() => {");

code = code.replace(/\{\/\* 4\. CARE REMINDERS \*\/\}\n\s*<section className="mt-8 relative">/g, '{/* 4. CARE REMINDERS */}\n        <section ref={remindersRef} className="mt-8 relative">');

const floatingBtn = `
      {/* PENDING REMINDERS FLOATING NOTIFIER */}
      <AnimatePresence>
        {activeReminders.length > 0 && !hasSeenReminders && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed left-6 sm:left-8 bottom-24 md:bottom-10 z-40"
          >
            <button
              onClick={() => {
                remindersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(251,191,36,0.4)] animate-bounce border-2 border-white dark:border-[#0f172a]">
                <AlertCircle size={20} className="text-white dark:text-[#0f172a]" />
              </div>
              <ChevronDown size={16} className="text-amber-500 dark:text-amber-400 -mt-2 animate-bounce" style={{ animationDelay: '0.1s' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
`;

code = code.replace(/\{\/\* QUICK ADD FLOATING BUTTON \*\/\}/g, floatingBtn + '\n      {/* QUICK ADD FLOATING BUTTON */}');

fs.writeFileSync('src/components/Dashboard.tsx', code);
