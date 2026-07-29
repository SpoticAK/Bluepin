const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = `        </div>
      </div>

      </div>
      </div>
      )}
 {/* Timeline Content */}`;

const replaceStr = `        </div>
      </div>
      </div>
      )}
 {/* Timeline Content */}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Fixed divs.');
} else {
  console.log('Could not find target strings.');
}
