const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const newTypes = `export interface UserConsent {
  termsVersion: string;
  privacyVersion: string;
  consentVersion: string;
  acceptedAt: number;
  userAgent: string;
  acceptedFromCountry?: string;
}

`;

if (!code.includes('export interface UserConsent')) {
  code = newTypes + code;
}

const target = `export interface UserProfile {`;
const replacement = `export interface UserProfile {
  consent?: UserConsent;`;

if (code.includes(target) && !code.includes('consent?: UserConsent;')) {
  code = code.replace(target, replacement);
}

fs.writeFileSync('src/types.ts', code);
