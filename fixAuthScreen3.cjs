const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

// 1. Add showConsentError state
code = code.replace(
  /const \[openLegalDoc, setOpenLegalDoc\] = useState<LegalDocType \| null>\(null\);/g,
  `const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);\n  const [showConsentError, setShowConsentError] = useState(false);`
);

// 2. handleEmailAuth
code = code.replace(
  /const handleEmailAuth = async \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*setLoading\(true\);\s*setError\(''\);/g,
  `const handleEmailAuth = async (e: React.FormEvent) => { e.preventDefault(); if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setLoading(true); setError('');`
);

// 3. handleGoogleAuth
code = code.replace(
  /const handleGoogleAuth = async \(\) => \{\s*setError\(''\);/g,
  `const handleGoogleAuth = async () => { if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setError('');`
);

// 4. submit button message
code = code.replace(
  /<\/div>\s*<button\s*type="submit"\s*disabled=\{loading\}/g,
  `</div>\n{showConsentError && !isLogin && !canSignUp && (<p className="text-xs text-theme-critical font-medium mb-3">* Please give the required consents in the section below.</p>)}\n<button type="submit" disabled={loading}`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Replaced stuff properly");
