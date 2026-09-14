import CheckSvg from "../CheckSvg";
import { CONSENT_KEYS, ConsentState } from "./types";
import { LegalDocType } from "../../lib/consentManager";
import { Sparkles } from "lucide-react";

interface ConsentSectionProps {
  consent: ConsentState;
  onChange: (key: keyof ConsentState, value: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  error?: string;
  onOpenLegalDoc?: (doc: LegalDocType) => void;
}

export default function ConsentSection({
  consent,
  onChange,
  onSelectAll,
  error,
  onOpenLegalDoc,
}: ConsentSectionProps) {
  const getConsentCopy = (key: keyof ConsentState): React.ReactNode => {
    switch (key) {
      case "termsRead":
        return (
          <>
            I have read and agree to the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenLegalDoc?.("terms");
              }}
              className="text-theme-accent font-medium hover:underline"
            >
              Terms of Service
            </button>
            .
          </>
        );
      case "privacyRead":
        return (
          <>
            I have read the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenLegalDoc?.("privacy");
              }}
              className="text-theme-accent font-medium hover:underline"
            >
              Privacy Policy
            </button>
            .
          </>
        );
      case "legalConsent":
        return (
          <>
            I consent to Bluepin collecting, storing and processing my personal and health information as described in the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenLegalDoc?.("health-consent");
              }}
              className="text-theme-accent font-medium hover:underline cursor-pointer"
            >
              Health Data Consent Notice
            </button>
            .
          </>
        );
    }
  };
  const allSelected = CONSENT_KEYS.every((key) => consent[key]);

  return (
    <div className="space-y-3 mb-4 bg-theme-card p-4 sm:p-5 rounded-2xl border border-theme-border shadow-xs">
      <p className="text-xs font-bold text-theme-text mb-3">
        Required Consents
      </p>

      {CONSENT_KEYS.map((key) => (
        <label
          key={key}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={consent[key]}
              onChange={(e) => onChange(key, e.target.checked)}
            />
            <div className="w-4 h-4 rounded border-2 border-theme-border bg-theme-bg group-hover:border-theme-text-sec peer-checked:border-blue-600 peer-checked:bg-blue-600 dark:peer-checked:border-blue-500 dark:peer-checked:bg-blue-500 transition-all" />
            <CheckSvg />
          </div>
          <span className="text-xs text-theme-text-sec leading-snug select-none">
            {getConsentCopy(key)}
          </span>
        </label>
      ))}

      <label className="flex items-start gap-3 cursor-pointer group pt-1 border-t border-theme-border/60">
        <div className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
          <div className="w-4 h-4 rounded border-2 border-theme-border bg-theme-bg group-hover:border-theme-text-sec peer-checked:border-blue-600 peer-checked:bg-blue-600 dark:peer-checked:border-blue-500 dark:peer-checked:bg-blue-500 transition-all" />
          <CheckSvg />
        </div>
        <span className="text-xs text-theme-text-sec font-medium select-none">
          Select All Required
        </span>
      </label>

      {/* AI Processing Disclosure */}
      <div className="p-3.5 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20 text-xs text-theme-text-sec">
        <div className="flex items-start gap-2">
          <Sparkles size={15} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-theme-text">AI Processing Disclosure: </span>
            Bluepin Intelligence uses automated AI processing to analyze health data, powered by Google Gemini for insight generation.{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenLegalDoc?.("ai-disclaimer");
              }}
              className="text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
            >
              AI Output Disclaimer &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Optional Marketing Consent */}
      <div className="pt-2 border-t border-theme-border/60">
        <p className="text-xs font-bold text-theme-text mb-2">
          Optional Communications
        </p>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={!!consent.marketingConsent}
              onChange={(e) => onChange("marketingConsent", e.target.checked)}
            />
            <div className="w-4 h-4 rounded border-2 border-theme-border bg-theme-bg group-hover:border-theme-text-sec peer-checked:border-blue-600 peer-checked:bg-blue-600 dark:peer-checked:border-blue-500 dark:peer-checked:bg-blue-500 transition-all" />
            <CheckSvg />
          </div>
          <div className="flex flex-col text-xs leading-snug select-none">
            <span className="text-theme-text font-medium">
              I agree to receive promotional and educational communications from Bluepin by email or WhatsApp.
            </span>
            <span className="text-theme-text-sec text-[11px] mt-0.5">
              Includes product updates, educational tips, and offers. You can opt out at any time.
            </span>
          </div>
        </label>
      </div>

      {error && (
        <p className="text-xs text-theme-critical font-medium mb-3">{error}</p>
      )}
    </div>
  );
}
