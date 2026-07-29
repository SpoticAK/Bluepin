const fs = require('fs');

// 1. App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(`<button onClick={() => setOpenLegalDoc('consent')} className="hover:text-theme-text transition-colors">Consent to Processing</button>\n          <button onClick={() => setOpenLegalDoc('medical_disclaimer')} className="hover:text-theme-text transition-colors">Medical Disclaimer</button>`, '');
fs.writeFileSync('src/App.tsx', appCode);

// 2. ProfileModal.tsx
let profileCode = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');
profileCode = profileCode.replace(`<button onClick={() => setOpenLegalDoc('consent')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Consent to Processing</span>
              </button>
              <button onClick={() => setOpenLegalDoc('medical_disclaimer')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Medical Disclaimer</span>
              </button>`, '');
fs.writeFileSync('src/components/ProfileModal.tsx', profileCode);

// 3. AuthScreen.tsx
let authCode = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');
authCode = authCode.replace(
  `I consent to Bluepin collecting, storing and processing my personal and health information to provide the application's services. (<button type="button" onClick={(e) => { e.preventDefault(); setOpenLegalDoc('consent'); }} className="text-theme-accent font-medium hover:underline">Read more</button>)`,
  `I consent to Bluepin collecting, storing and processing my personal and health information to provide the services described in the Privacy Policy and Terms of Service.`
);
fs.writeFileSync('src/components/AuthScreen.tsx', authCode);

console.log("Updated buttons");
