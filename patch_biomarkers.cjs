const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const oldParametersSection = `      {/* Section: Parameters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-theme-text">Parameters</h3>
        </div>
        <div className="space-y-4">
          {CATEGORIES.map(category => {
            const categoryBiomarkers = allBiomarkersLatest.filter((b: any) => (b.category || 'Others') === category);
            if (categoryBiomarkers.length === 0) return null;
            return (
              <CategoryGroup 
                key={category} 
                category={category} 
                biomarkers={categoryBiomarkers} 
                getHistory={getHistoryForBiomarker}
                onSelectBiomarker={(b, h) => setSelectedBiomarker({ biomarker: b, history: h })}
              />
            );
          })}
          
          {(() => {
            const otherBiomarkers = allBiomarkersLatest.filter((b: any) => !b.category || !CATEGORIES.includes(b.category));
            if (otherBiomarkers.length === 0) return null;
            return (
              <CategoryGroup 
                key="Others"
                category="Others" 
                biomarkers={otherBiomarkers} 
                getHistory={getHistoryForBiomarker}
                onSelectBiomarker={(b, h) => setSelectedBiomarker({ biomarker: b, history: h })}
              />
            );
          })()}
        </div>
      </div>`;

const newParametersSection = `      {/* Section: Parameters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-theme-text">Parameters</h3>
        </div>
        <div className="bg-theme-card rounded-[24px] border border-theme-border overflow-hidden shadow-sm divide-y divide-theme-border/50 flex flex-col">
          {CATEGORIES.map(category => {
            const categoryBiomarkers = allBiomarkersLatest.filter((b: any) => (b.category || 'Others') === category);
            if (categoryBiomarkers.length === 0) return null;
            return (
              <CategoryGroup 
                key={category} 
                category={category} 
                biomarkers={categoryBiomarkers} 
                getHistory={getHistoryForBiomarker}
                onSelectBiomarker={(b, h) => setSelectedBiomarker({ biomarker: b, history: h })}
              />
            );
          })}
          
          {(() => {
            const otherBiomarkers = allBiomarkersLatest.filter((b: any) => !b.category || !CATEGORIES.includes(b.category));
            if (otherBiomarkers.length === 0) return null;
            return (
              <CategoryGroup 
                key="Others"
                category="Others" 
                biomarkers={otherBiomarkers} 
                getHistory={getHistoryForBiomarker}
                onSelectBiomarker={(b, h) => setSelectedBiomarker({ biomarker: b, history: h })}
              />
            );
          })()}
        </div>
      </div>`;

code = code.replace(oldParametersSection, newParametersSection);

const oldCategoryGroup = `function CategoryGroup({ category, biomarkers, getHistory, onSelectBiomarker }: { key?: React.Key, category: string, biomarkers: Biomarker[], getHistory: (name: string) => any[], onSelectBiomarker: (b: Biomarker, h: any[]) => void }) {
 const [isOpen, setIsOpen] = useState(false);
 
 const highLowCount = biomarkers.filter(b => b.status === "Needs Attention").length;
 const borderlineCount = biomarkers.filter(b => b.status === 'Borderline').length;
 const optimalCount = biomarkers.length - highLowCount - borderlineCount;

 return (
 <div className="bg-theme-card rounded-3xl border border-theme-border overflow-hidden shadow-sm transition-all">
 <button 
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between p-5 bg-theme-card hover:bg-theme-card-sec transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <h3 className="font-bold text-theme-text text-lg">{category}</h3>
 {!isOpen && (
 <div className="flex gap-2">
 {borderlineCount > 0 && (
 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-bold transition-colors bg-theme-warning/10 border-theme-warning/30 text-theme-warning">
 <span className="w-2.5 h-2.5 rounded-full border-2 relative border-[var(--color-theme-warning)]" />
 {borderlineCount}
 </span>
 )}
 {highLowCount > 0 && (
 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-bold transition-colors bg-theme-critical/10 border-theme-critical text-red-700">
 <span className="w-2.5 h-2.5 rounded-full border-2 relative border-theme-critical" />
 {highLowCount}
 </span>
 )}
 </div>
 )}
 </div>
 {isOpen ? <ChevronUp className="text-theme-text-sec" /> : <ChevronDown className="text-theme-text-sec" />}
 </button>
 
 {isOpen && (
 <div className="flex flex-col gap-2 px-2 pb-2 mt-2">
 {biomarkers.map((b, i) => {
 const history = getHistory(b.biomarkerId || b.name);
 return <BiomarkerRow key={i} biomarker={b} history={history} onSelectBiomarker={onSelectBiomarker} />
 })}
 </div>
 )}
 </div>
 );
}`;

const newCategoryGroup = `function CategoryGroup({ category, biomarkers, getHistory, onSelectBiomarker }: { key?: React.Key, category: string, biomarkers: Biomarker[], getHistory: (name: string) => any[], onSelectBiomarker: (b: Biomarker, h: any[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const highLowCount = biomarkers.filter(b => b.status === "Needs Attention").length;
  const borderlineCount = biomarkers.filter(b => b.status === 'Borderline').length;

  return (
    <div className="flex flex-col">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 bg-transparent hover:bg-theme-card-sec transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-theme-text text-[15px]">{category}</h3>
          {!isOpen && (
            <div className="flex items-center gap-3">
              {borderlineCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-theme-warning shadow-[0_0_8px_var(--color-theme-warning)]" />
                  <span className="text-xs font-bold text-theme-warning">{borderlineCount}</span>
                </div>
              )}
              {highLowCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-theme-critical shadow-[0_0_8px_var(--color-theme-critical)]" />
                  <span className="text-xs font-bold text-theme-critical">{highLowCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <ChevronDown 
          className={cn(
            "text-theme-text-sec transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )} 
          size={18}
        />
      </button>
      
      <div 
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 px-2 pb-4">
            {biomarkers.map((b, i) => {
              const history = getHistory(b.biomarkerId || b.name);
              return <BiomarkerRow key={i} biomarker={b} history={history} onSelectBiomarker={onSelectBiomarker} />
            })}
          </div>
        </div>
      </div>
    </div>
  );
}`;

code = code.replace(oldCategoryGroup, newCategoryGroup);

const oldBiomarkerRow = `function BiomarkerRow({ biomarker, history, onSelectBiomarker }: { key?: React.Key, biomarker: Biomarker, history: any[], onSelectBiomarker: (b: Biomarker, h: any[]) => void }) {
 const isTier1 = TIER_1.includes(biomarker.name.toLowerCase().trim());
 const canShowGraph = isTier1 || history.length > 1;
 const canOpenModal = canShowGraph || !!biomarker.info;

 let finalStatus = biomarker.status; 
 if (!['Healthy', 'Needs Attention', 'Borderline'].includes(finalStatus as string)) {
 finalStatus = 'Healthy'; 
 }
 
 let diffString = null;
 let diffPrefix = '';
 if (history.length > 1) {
 const prevVal = Number(history[history.length - 2].value);
 const curVal = Number(biomarker.value);
 if (!isNaN(prevVal) && !isNaN(curVal)) {
 const diff = curVal - prevVal;
 if (diff !== 0) {
 diffPrefix = diff > 0 ? '↑' : '↓';
 diffString = \`\${diffPrefix} \${Math.abs(diff).toFixed(diff % 1 !== 0 ? 1 : 0)}\`;
 }
 }
 }

 return (
 <div 
 onClick={() => { if (canOpenModal) onSelectBiomarker(biomarker, history) }}
 className={cn(
 "p-3 sm:p-4 mx-2 rounded-2xl flex flex-row items-center justify-between group transition-colors mb-1", 
 finalStatus === 'Healthy' ? "bg-transparent hover:bg-theme-card-sec" : 
 finalStatus === 'Needs Attention' ? "bg-theme-critical/5 hover:bg-theme-critical/10" : 
 "bg-theme-warning/5 hover:bg-theme-warning/10",
 canOpenModal ? "cursor-pointer" : "cursor-default"
 )}
 >
 <div className="flex-1 flex flex-col justify-center">
 <h4 className="font-bold text-theme-text text-sm sm:text-base leading-tight flex items-center gap-2">
 {biomarker.name}
 {biomarker.info && (
 <div className="group/info relative flex items-center" onClick={(e) => { e.stopPropagation(); if (!canOpenModal) { /* do nothing */ } else { onSelectBiomarker(biomarker, history); } }}>
 <Sparkles size={14} className="text-blue-500 shrink-0 cursor-help" />
 <div className="invisible group-hover/info:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 sm:w-64 p-3 bg-theme-card border border-theme-border rounded-xl shadow-xl text-xs text-theme-text text-center z-50 normal-case font-medium leading-relaxed">
 {biomarker.info}
 <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-theme-border" />
 </div>
 </div>
 )}
 </h4>
 {(biomarker.refRangeText || (biomarker.refMin != null || biomarker.refMax != null)) && (
 <span className="text-xs font-medium text-theme-text-sec mt-0.5">
 Ref: {biomarker.refRangeText || (biomarker.refMin === 0 && biomarker.refMax === 0 ? 'Not specified' : \`\${biomarker.refMin ?? '?'} - \${biomarker.refMax ?? '?'}\`)}
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
 {diffString && (
 <div className={cn("text-xs sm:text-sm font-bold flex items-center gap-0.5", finalStatus === 'Healthy' ? "text-theme-text-sec" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>
 {diffString}
 </div>
 )}
 <div className="flex items-baseline gap-1 min-w-[3rem] justify-end">
 <span className={cn("text-lg sm:text-xl font-bold tracking-tight", finalStatus === 'Healthy' ? "text-theme-text" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>{biomarker.value}</span>
 <span className="text-xs sm:text-sm font-medium text-theme-text-sec hidden sm:inline-block">{biomarker.unit}</span>
 </div>
 
 {canOpenModal ? (
 <ChevronRight size={18} className="text-theme-border group-hover:text-theme-text-sec transition-colors shrink-0" />
 ) : (
 <div className="w-[18px] shrink-0" />
 )}
 </div>
 </div>
 );
}`;

const newBiomarkerRow = `function BiomarkerRow({ biomarker, history, onSelectBiomarker }: { key?: React.Key, biomarker: Biomarker, history: any[], onSelectBiomarker: (b: Biomarker, h: any[]) => void }) {
  const isTier1 = TIER_1.includes(biomarker.name.toLowerCase().trim());
  const canShowGraph = isTier1 || history.length > 1;
  const canOpenModal = canShowGraph || !!biomarker.info;

  let finalStatus = biomarker.status; 
  if (!['Healthy', 'Needs Attention', 'Borderline'].includes(finalStatus as string)) {
    finalStatus = 'Healthy'; 
  }
  
  let dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  if (finalStatus === 'Needs Attention') {
    dotColor = "bg-theme-critical shadow-[0_0_8px_var(--color-theme-critical)]";
  } else if (finalStatus === 'Borderline') {
    dotColor = "bg-theme-warning shadow-[0_0_8px_var(--color-theme-warning)]";
  }
  
  let diffString = null;
  let diffPrefix = '';
  if (history.length > 1) {
    const prevVal = Number(history[history.length - 2].value);
    const curVal = Number(biomarker.value);
    if (!isNaN(prevVal) && !isNaN(curVal)) {
      const diff = curVal - prevVal;
      if (diff !== 0) {
        diffPrefix = diff > 0 ? '↑' : '↓';
        diffString = \`\${diffPrefix} \${Math.abs(diff).toFixed(diff % 1 !== 0 ? 1 : 0)}\`;
      }
    }
  }

  return (
    <div 
      onClick={() => { if (canOpenModal) onSelectBiomarker(biomarker, history) }}
      className={cn(
        "p-3 rounded-xl flex flex-row items-center justify-between group transition-colors", 
        "bg-transparent hover:bg-theme-card-sec",
        canOpenModal ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex-1 flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <div className="flex flex-col justify-center">
          <h4 className="font-bold text-theme-text text-[14px] sm:text-[15px] leading-tight flex items-center gap-2">
            {biomarker.name}
            {biomarker.info && (
              <div className="group/info relative flex items-center" onClick={(e) => { e.stopPropagation(); if (!canOpenModal) { /* do nothing */ } else { onSelectBiomarker(biomarker, history); } }}>
                <Sparkles size={13} className="text-blue-500 shrink-0 cursor-help" />
              </div>
            )}
          </h4>
          {(biomarker.refRangeText || (biomarker.refMin != null || biomarker.refMax != null)) && (
            <span className="text-[12px] font-medium text-theme-text-sec mt-0.5">
              Ref: {biomarker.refRangeText || (biomarker.refMin === 0 && biomarker.refMax === 0 ? 'Not specified' : \`\${biomarker.refMin ?? '?'} - \${biomarker.refMax ?? '?'}\`)}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0 text-right">
        {diffString && (
          <div className={cn("text-[13px] font-bold flex items-center", finalStatus === 'Healthy' ? "text-theme-text-sec" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>
            {diffString}
          </div>
        )}
        <div className="flex flex-col items-end min-w-[3rem] justify-center">
          <div className="flex items-baseline gap-1">
            <span className={cn("text-[15px] font-bold tracking-tight", finalStatus === 'Healthy' ? "text-theme-text" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>{biomarker.value}</span>
            <span className="text-[12px] font-medium text-theme-text-sec">{biomarker.unit}</span>
          </div>
        </div>
        
        {canOpenModal ? (
          <ChevronRight size={16} className="text-theme-border group-hover:text-theme-text-sec transition-colors shrink-0" />
        ) : (
          <div className="w-[16px] shrink-0" />
        )}
      </div>
    </div>
  );
}`;

code = code.replace(oldBiomarkerRow, newBiomarkerRow);

fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
console.log('Patched BiomarkersTab.tsx successfully.');
