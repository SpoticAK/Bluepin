const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = `      })()}
      </div>
      )}
 {/* Delete Confirmation Modal */}`;

const replaceStr = `      })()}

      {/* Section 2: Highlights */}
      {keyFindings.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-theme-text mb-4">Highlights</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {keyFindings.map((finding, idx) => (
              <div key={idx} 
                   onClick={() => {
                       const history = getHistoryForBiomarker(finding.biomarkerId || finding.name);
                       setSelectedBiomarker({ biomarker: finding, history });
                   }}
                   className="bg-theme-card border border-theme-border p-4 rounded-2xl hover:border-theme-accent/50 transition-colors cursor-pointer group shadow-sm hover:shadow-md">
                 <div className="flex items-start justify-between mb-2">
                   <div>
                     <p className="font-bold text-theme-text group-hover:text-theme-accent transition-colors truncate pr-2" title={finding.name}>{finding.name}</p>
                     <p className="text-[11px] text-theme-text-sec uppercase tracking-wider">{finding.category || 'General'}</p>
                   </div>
                   <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0", 
                       finding.status === 'Healthy' ? "bg-emerald-500/10 text-emerald-500" : 
                       finding.status === 'Borderline' ? "bg-amber-500/10 text-amber-500" : 
                       "bg-red-500/10 text-red-500"
                   )}>
                     {finding.status}
                   </div>
                 </div>
                 <div className="flex items-baseline gap-1 mt-3">
                   <span className="text-2xl font-bold text-theme-text">{finding.value}</span>
                   <span className="text-xs text-theme-text-sec font-medium">{finding.unit}</span>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Parameters */}
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
      </div>

      </div>
      )}
 {/* Delete Confirmation Modal */}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Successfully inserted Section 2 and Section 3.');
} else {
  console.log('Could not find target string to replace.');
}
