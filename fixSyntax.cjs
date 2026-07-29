const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = `      })()}
      </div>

      {/* Section: Parameters */}`;

const replaceStr = `      })()}

      {/* Section: Parameters */}`;

const targetStr2 = `      </div>
      )}
 {/* Timeline Content */}`;

const replaceStr2 = `      </div>
      </div>
      )}
 {/* Timeline Content */}`;

if (code.includes(targetStr) && code.includes(targetStr2)) {
  code = code.replace(targetStr, replaceStr);
  code = code.replace(targetStr2, replaceStr2);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Fixed syntax by moving parameters inside the parent div.');
} else {
  console.log('Could not find target strings.');
}
