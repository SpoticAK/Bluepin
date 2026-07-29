const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

// 1. Add showConsentError state
code = code.replace(
  `const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);`,
  `const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);\n  const [showConsentError, setShowConsentError] = useState(false);`
);

// 2. Modify handleEmailAuth
code = code.replace(
  `const handleEmailAuth = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setError('');`,
  `const handleEmailAuth = async (e: React.FormEvent) => { e.preventDefault(); if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setLoading(true); setError('');`
);

// 3. Modify handleGoogleAuth
code = code.replace(
  `const handleGoogleAuth = async () => {    setError('');`,
  `const handleGoogleAuth = async () => {    if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setError('');`
);

// 4. Modify the buttons (remove disabled={... || (!isLogin && !canSignUp)})
code = code.replace(
  `type="submit" disabled={loading || (!isLogin && !canSignUp)}`,
  `type="submit" disabled={loading}`
);
code = code.replace(
  `onClick={handleGoogleAuth} disabled={loading || (!isLogin && !canSignUp)}`,
  `onClick={handleGoogleAuth} disabled={loading}`
);

// 5. Add the error message just before the submit button
code = code.replace(
  `<button  type="submit" disabled={loading}`,
  `{showConsentError && !isLogin && !canSignUp && (
  <p className="text-xs text-theme-critical font-medium mb-3">* Please give the required consents in the section below.</p>
)}
 <button  type="submit" disabled={loading}`
);

// 6. Fix the LegalDoc links so they stop propagation (prevent clicking the label)
code = code.replace(
  /onClick=\{\(e\) => \{ e\.preventDefault\(\); setOpenLegalDoc\('terms'\); \}\}/g,
  `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenLegalDoc('terms'); }}`
);

code = code.replace(
  /onClick=\{\(e\) => \{ e\.preventDefault\(\); setOpenLegalDoc\('privacy'\); \}\}/g,
  `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenLegalDoc('privacy'); }}`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Updated AuthScreen.tsx");
