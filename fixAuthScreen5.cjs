const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const target = `</p> </div> </div> );}`;
const replacement = `</p> </div> </div> <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} /> </div> );}`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Added LegalDocsModal");
