const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

// The file seems to have minified-like whitespace
// 1. handleEmailAuth
code = code.replace(
  /const handleEmailAuth = async \(e: React\.FormEvent\) => \{ e\.preventDefault\(\); setLoading\(true\); setError\(''\);/,
  `const handleEmailAuth = async (e: React.FormEvent) => { e.preventDefault(); if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setLoading(true); setError('');`
);

// 2. handleGoogleAuth
code = code.replace(
  /const handleGoogleAuth = async \(\) => \{\s*setError\(''\);/,
  `const handleGoogleAuth = async () => { if (!isLogin && !canSignUp) { setShowConsentError(true); return; } setShowConsentError(false); setError('');`
);

// 3. submit button message
code = code.replace(
  /<\/div> <button  type="submit" disabled=\{loading\} className="w-full py-3 bg-theme-accent text-white/g,
  `</div>
{showConsentError && !isLogin && !canSignUp && (
  <p className="text-xs text-theme-critical font-medium mb-3">* Please give the required consents in the section below.</p>
)}
<button type="submit" disabled={loading} className="w-full py-3 bg-theme-accent text-white`
);

// Write back
fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Replaced stuff");
