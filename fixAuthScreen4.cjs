const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  /<\/div> <\/div> \);\}/g,
  `</div> </div> <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} /> );}`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Added LegalDocsModal");
