export const CURRENT_TERMS_VERSION = "1.0.0";
export const CURRENT_PRIVACY_VERSION = "2.0";
export const CURRENT_HEALTH_CONSENT_VERSION = "2.0";

export type LegalDocType = 'terms' | 'privacy' | 'cookies' | 'ai-disclaimer' | 'medical' | 'health-consent';

export function getConsentPayload(userAgent: string, marketingConsent: boolean = false) {
  return {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    healthConsentVersion: CURRENT_HEALTH_CONSENT_VERSION,
    marketingConsent,
    acceptedAt: Date.now(),
    userAgent,
    acceptedFromCountry: 'Unknown' // Could be updated later via an API
  };
}
