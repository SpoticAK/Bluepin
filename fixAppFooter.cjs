const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `import { ThemeProvider, useTheme } from "./theme";`,
  `import { ThemeProvider, useTheme } from "./theme";\nimport { LegalDocsModal } from './components/LegalDocsModal';\nimport { LegalDocType } from './lib/consentManager';`
);

// Add openLegalDoc state to MainLayout
code = code.replace(
  `const [showProfile, setShowProfile] = useState(false);`,
  `const [showProfile, setShowProfile] = useState(false);\n  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);`
);

// Add footer to MainLayout
const endOfMainStr = `        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}\n      </main>`;
const footerHtml = `
        <footer className="mt-12 pt-8 pb-4 border-t border-theme-border/50 text-center text-xs text-theme-text-sec flex flex-wrap justify-center gap-4">
          <button onClick={() => setOpenLegalDoc('terms')} className="hover:text-theme-text transition-colors">Terms of Service</button>
          <button onClick={() => setOpenLegalDoc('privacy')} className="hover:text-theme-text transition-colors">Privacy Policy</button>
          <button onClick={() => setOpenLegalDoc('consent')} className="hover:text-theme-text transition-colors">Consent to Processing</button>
          <button onClick={() => setOpenLegalDoc('medical_disclaimer')} className="hover:text-theme-text transition-colors">Medical Disclaimer</button>
        </footer>
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      </main>
      <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} />`;

code = code.replace(endOfMainStr, footerHtml);

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx with footer");
