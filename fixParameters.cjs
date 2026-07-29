const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = `      })()}
      </div>
      )}
 {/* Timeline Content */}`;

const replaceStr = `      })()}
      </div>

      {/* Section: Parameters */}
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
 {/* Timeline Content */}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Successfully added parameters section.');
} else {
  console.log('Could not find target string to replace parameters.');
}
