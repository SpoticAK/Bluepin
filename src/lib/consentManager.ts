export const CURRENT_TERMS_VERSION = "1.0.0";
export const CURRENT_PRIVACY_VERSION = "1.0.0";

export type LegalDocType = 'terms' | 'privacy';

export function getConsentPayload(userAgent: string) {
  return {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedAt: Date.now(),
    userAgent,
    acceptedFromCountry: 'Unknown' // Could be updated later via an API
  };
}
