const fs = require('fs');
let code = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');

// Add LegalDocsModal import
code = code.replace(
  `import { cn } from '../lib/utils';`,
  `import { cn } from '../lib/utils';\nimport { LegalDocsModal } from './LegalDocsModal';\nimport { LegalDocType } from '../lib/consentManager';`
);

// Add openLegalDoc state
code = code.replace(
  `const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);`,
  `const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);`
);

// Add the Legal section
const newSection = `
          <div className="pt-0">
            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Legal</h4>
            <div className="px-2">
              <button onClick={() => setOpenLegalDoc('privacy')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Privacy Policy</span>
              </button>
              <button onClick={() => setOpenLegalDoc('terms')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Terms of Service</span>
              </button>
              <button onClick={() => setOpenLegalDoc('consent')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Consent to Processing</span>
              </button>
              <button onClick={() => setOpenLegalDoc('medical_disclaimer')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Medical Disclaimer</span>
              </button>
            </div>
          </div>
`;

code = code.replace(
  `<div className="pt-0">\n            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Account Actions</h4>`,
  newSection + `          <div className="pt-0">\n            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Account Actions</h4>`
);

// Add LegalDocsModal to the end
code = code.replace(
  `</div>\n    </div>\n  );\n}`,
  `</div>\n      <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} />\n    </div>\n  );\n}`
);

fs.writeFileSync('src/components/ProfileModal.tsx', code);
console.log("Updated ProfileModal.tsx");
