const fs = require('fs');
let code = fs.readFileSync('src/components/family/FamilyMemberProfile.tsx', 'utf8');

const lines = code.split('\n');
const startIdx = lines.findIndex(l => l.includes('!canGoBack && <div className="w-[26px]"></div>'));
const endIdx = lines.findIndex(l => l.includes('<AlertCircle size={20} className="text-amber-500" /> Incomplete Assessment'));

if (startIdx !== -1 && endIdx !== -1) {
  const newLines = [
    '          {!canGoBack && <div className="w-[26px]"></div>}',
    '        </div>',
    '      </div>',
    '',
    '      <div className="bg-theme-card border border-theme-border border-dashed p-4 sm:p-6 rounded-[32px] shadow-sm">',
    '        <div className="flex items-center justify-between mb-6">',
    '          <h3 className="text-sm font-bold text-theme-text-sec uppercase tracking-wider">Activity Trend</h3>',
    '        </div>',
    '        <div className="h-48 sm:h-64 w-full">',
    '          <ResponsiveContainer width="100%" height="100%">',
    '            <AreaChart data={member.weightHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>',
    '              <defs>',
    '                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">',
    '                  <stop offset="5%" stopColor="var(--color-theme-accent)" stopOpacity={0.3}/>',
    '                  <stop offset="95%" stopColor="var(--color-theme-accent)" stopOpacity={0}/>',
    '                </linearGradient>',
    '              </defs>',
    '              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-border)" vertical={false} />',
    '              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: \'var(--color-theme-text-sec)\'}} dy={10} />',
    '              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: \'var(--color-theme-text-sec)\'}} dx={-10} domain={[\'dataMin - 1\', \'dataMax + 1\']} />',
    '              <Tooltip contentStyle={{ borderRadius: \'16px\', border: \'none\', boxShadow: \'0 4px 20px rgba(0,0,0,0.08)\', backgroundColor: \'var(--color-theme-card)\', color: \'var(--color-theme-text)\' }} />',
    '              <Area type="monotone" dataKey={fitnessGraph} stroke="var(--color-theme-text)" strokeWidth={3} fillOpacity={1} fill="url(#colorMetric)" />',
    '            </AreaChart>',
    '          </ResponsiveContainer>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  )}',
    '',
    '  {isCompletenessPanelOpen && (',
    '    <div className="fixed inset-0 z-[60] bg-theme-text/40 backdrop-blur-sm flex items-center justify-center p-4">',
    '      <div className="bg-theme-card max-w-lg w-full rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">',
    '        <button ',
    '          onClick={() => setIsCompletenessPanelOpen(false)}',
    '          className="absolute top-6 right-6 text-theme-text-sec hover:text-theme-text"',
    '        >',
    '          <X size={20} />',
    '        </button>',
    '        <h3 className="text-xl font-bold text-theme-text mb-2 flex items-center gap-2">',
    '          <AlertCircle size={20} className="text-amber-500" /> Incomplete Assessment'
  ];
  
  const finalCode = [...lines.slice(0, startIdx), ...newLines, ...lines.slice(endIdx + 1)].join('\n');
  fs.writeFileSync('src/components/family/FamilyMemberProfile.tsx', finalCode);
  console.log('Replaced lines successfully.');
} else {
  console.log('Could not find start/end indices.', startIdx, endIdx);
}
