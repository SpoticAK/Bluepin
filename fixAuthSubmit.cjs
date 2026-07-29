const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  `<button  type="submit" disabled={loading} className="w-full py-3 bg-theme-accent text-white hover:opacity-90 font-medium rounded-xl transition-opacity disabled:opacity-50" >`,
  `<button  type="submit" disabled={loading || (!isLogin && !canSignUp)} className="w-full py-3 bg-theme-accent text-white hover:opacity-90 font-medium rounded-xl transition-opacity disabled:opacity-50" >`
);

code = code.replace(
  `<button  type="button" onClick={handleGoogleAuth} disabled={loading} className="w-full py-3 px-4 bg-theme-card border border-theme-border hover:bg-theme-card-sec text-theme-text font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm mb-6" >`,
  `<button  type="button" onClick={handleGoogleAuth} disabled={loading || (!isLogin && !canSignUp)} className="w-full py-3 px-4 bg-theme-card border border-theme-border hover:bg-theme-card-sec text-theme-text font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm mb-6" >`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Fixed auth submit button disabled state");
