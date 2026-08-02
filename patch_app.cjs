const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/import FitnessTab from "\.\/components\/FitnessTab";\n/g, '');
code = code.replace(/import FamilyTab from "\.\/components\/FamilyTab";\n/g, '');

code = code.replace(/type TabType = "dashboard" \| "family" \| "glucose" \| "biomarkers" \| "fitness";/g, 'type TabType = "dashboard" | "glucose" | "biomarkers";');

const fitnessNavItemRegex = /<NavItem\s*icon={<Flame \/>}\s*label="Fitness"[\s\S]*?\/>\s*/;
code = code.replace(fitnessNavItemRegex, '');

const familyNavItemRegex = /<NavItem\s*icon={<Users \/>}\s*label="Family"[\s\S]*?\/>\s*/;
code = code.replace(familyNavItemRegex, '');

const fitnessMobileRegex = /<MobileNavItem\s*icon={<Flame size=\{20\} \/>}\s*label="Fitness"[\s\S]*?\/>\s*/;
code = code.replace(fitnessMobileRegex, '');

const familyMobileRegex = /<MobileNavItem\s*icon={<Users size=\{20\} \/>}\s*label="Family"[\s\S]*?\/>\s*/;
code = code.replace(familyMobileRegex, '');

const fitnessRenderRegex = /\{activeTab === "fitness" && <FitnessTab \/>\}\s*/;
code = code.replace(fitnessRenderRegex, '');

const familyRenderRegex = /\{activeTab === "family" && \(\s*<FamilyTab onNavigate=\{\(tab: TabType\) => setActiveTab\(tab\)\} \/>\s*\)\}\s*/;
code = code.replace(familyRenderRegex, '');

fs.writeFileSync('src/App.tsx', code);
