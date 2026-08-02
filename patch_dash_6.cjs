const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const effectBlock = `  const remindersRef = React.useRef<HTMLElement>(null);
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

code = code.replace(effectBlock, '');

// Place it right after activeReminders declaration
const activeRemindersDecl = `    });
  }, [score, isGlucoseTracking, glucoseReadings, weightEntries, labReports]);`;

code = code.replace(activeRemindersDecl, activeRemindersDecl + "\n\n" + effectBlock);

fs.writeFileSync('src/components/Dashboard.tsx', code);
