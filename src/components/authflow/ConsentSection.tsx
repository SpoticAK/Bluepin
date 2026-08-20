import CheckSvg from "../CheckSvg";
import { CONSENT_KEYS, ConsentState } from "./types";

interface ConsentSectionProps {
  consent: ConsentState;
  onChange: (key: keyof ConsentState, value: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  error?: string;
}

const CONSENT_COPY: Record<keyof ConsentState, React.ReactNode> = {
  termsRead: (
    <>
      I have read and agree to the{" "}
      <button
        type="button"
        className="text-theme-accent font-medium hover:underline"
      >
        Terms of Service
      </button>
      .
    </>
  ),
  privacyRead: (
    <>
      I have read the{" "}
      <button
        type="button"
        className="text-theme-accent font-medium hover:underline"
      >
        Privacy Policy
      </button>
      .
    </>
  ),
  legalConsent:
    "I consent to Bluepin collecting, storing and processing my personal and health information to provide the services described in the Privacy Policy and Terms of Service.",
};

export default function ConsentSection({
  consent,
  onChange,
  onSelectAll,
  error,
}: ConsentSectionProps) {
  const allSelected = CONSENT_KEYS.every((key) => consent[key]);

  return (
    <div className="space-y-3 mb-4 bg-theme-bg p-4 rounded-xl border border-theme-border">
      <p className="text-xs font-bold text-theme-text mb-3">
        Required Consents
      </p>

      {CONSENT_KEYS.map((key) => (
        <label
          key={key}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={consent[key]}
              onChange={(e) => onChange(key, e.target.checked)}
            />
            <div className="w-4 h-4 rounded border-2 border-theme-border peer-checked:border-theme-accent peer-checked:bg-theme-accent transition-all" />
            <CheckSvg />
          </div>
          <span className="text-xs text-theme-text-sec leading-snug select-none">
            {CONSENT_COPY[key]}
          </span>
        </label>
      ))}

      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
          <div className="w-4 h-4 rounded border-2 border-theme-border peer-checked:border-theme-accent peer-checked:bg-theme-accent transition-all" />
          <CheckSvg />
        </div>
        <span className="text-xs text-theme-text-sec select-none">
          Select All
        </span>
      </label>

      {error && (
        <p className="text-xs text-theme-critical font-medium mb-3">{error}</p>
      )}
    </div>
  );
}
