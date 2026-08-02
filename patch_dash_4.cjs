const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/\{\/\* WEIGHT CARD \*\/\}\n\s*<WeightCard \/>\n\s*\{\/\* WEIGHT CARD \*\/\}\n\s*<WeightCard \/>/g, '{/* WEIGHT CARD */}\n        <WeightCard />');

fs.writeFileSync('src/components/Dashboard.tsx', code);
