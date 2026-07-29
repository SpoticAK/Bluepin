const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/<\/div>\s*<\/div>\s*\);\s*\}/, `</div> <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} /> </div> );}`);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Added LegalDocsModal");
