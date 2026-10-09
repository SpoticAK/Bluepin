import type { LegalDocType } from "../../lib/consentManager";

const LEGAL_DOCS: { id: LegalDocType; label: string }[] = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "ai-disclaimer", label: "AI Disclaimer" },
  { id: "medical", label: "Medical Disclaimer" },
  { id: "health-consent", label: "Health Data Consent" },
];

export function AppFooter({ onOpenLegalDoc }: { onOpenLegalDoc: (doc: LegalDocType) => void }) {
  return (
    <footer className="mt-12 pt-8 pb-4 border-t border-theme-border/50 text-center text-xs text-theme-text-sec flex flex-wrap justify-center gap-4">
      {LEGAL_DOCS.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onOpenLegalDoc(doc.id)}
          className="hover:text-theme-text transition-colors cursor-pointer"
        >
          {doc.label}
        </button>
      ))}
    </footer>
  );
}
