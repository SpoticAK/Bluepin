const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const anchor1 = 'const [hasSeenReminders, setHasSeenReminders] = useState(false);';
const replace1 = anchor1 + '\n  const [showNotifierReady, setShowNotifierReady] = useState(false);\n\n  useEffect(() => {\n    const timer = setTimeout(() => setShowNotifierReady(true), 2000);\n    return () => clearTimeout(timer);\n  }, []);';
code = code.replace(anchor1, replace1);

const anchor2 = '{activeReminders.length > 0 && !hasSeenReminders && (';
const replace2 = '{activeReminders.length > 0 && !hasSeenReminders && showNotifierReady && (';
code = code.replace(anchor2, replace2);

fs.writeFileSync('src/components/Dashboard.tsx', code);
