const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  `onClick={(e) => { e.preventDefault(); setOpenLegalDoc('terms'); }}`,
  `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenLegalDoc('terms'); }}`
);

code = code.replace(
  `onClick={(e) => { e.preventDefault(); setOpenLegalDoc('privacy'); }}`,
  `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenLegalDoc('privacy'); }}`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
