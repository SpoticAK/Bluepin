const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// The block to replace:
// from `        {/* WEEKLY ACTIVITY STRIP */}` to `      </section>` corresponding to Family section.
// Actually, let's just use regex.

const startIndex = code.indexOf('        {/* WEEKLY ACTIVITY STRIP */}');
const endIndex = code.indexOf('      {/* QUICK ADD FLOATING BUTTON */}');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Patched');
} else {
  console.error('Could not find boundaries');
}

