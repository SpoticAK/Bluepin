const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  /const \[showConsentError, setShowConsentError\] = useState\(false\);\s*const \[showConsentError, setShowConsentError\] = useState\(false\);/,
  `const [showConsentError, setShowConsentError] = useState(false);`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Removed duplicate useState");
