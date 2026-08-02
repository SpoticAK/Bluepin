const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

if (!code.includes("WeightCard")) {
  code = code.replace(/import \{ AddWeightModal \} from '\.\/AddWeightModal';/g, "import { AddWeightModal } from './AddWeightModal';\nimport { WeightCard } from './WeightCard';");
}

const glucoseSectionRegex = /\{\/\* GLUCOSE DASHBOARD CARDS \*\/\}([\s\S]*?)<\/section>\s*\)\}/g;

code = code.replace(glucoseSectionRegex, (match) => {
  return match + "\n\n        {/* WEIGHT CARD */}\n        <WeightCard />";
});

fs.writeFileSync('src/components/Dashboard.tsx', code);
