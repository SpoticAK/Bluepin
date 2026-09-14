# Bluepin Signup Consent Copy

**Version:** 1.0  
**Effective Date:** 14 September 2026

This document contains the recommended consent and acknowledgement copy for the Bluepin signup experience.

It is designed to keep required service consent, health-data consent, and optional marketing consent separate.

---

## 1. Signup Screen — Required Account Terms

### Checkbox

**☐ I agree to the Bluepin Terms of Service and acknowledge the Bluepin Privacy Policy.**

**Links:**
- Terms of Service
- Privacy Policy

### Supporting text

By creating a Bluepin account, you agree to the Terms of Service and acknowledge how Bluepin processes your personal information as described in the Privacy Policy.

---

## 2. Health Data Consent

Because Bluepin processes health and medical information, health-data consent should be presented separately from the Terms of Service and Privacy Policy acknowledgement.

### Checkbox

**☐ I consent to Bluepin collecting and processing my health and medical information as described in the Health Data Consent Notice.**

**Link:**
- Health Data Consent Notice

### Supporting text

This may include information such as glucose readings, medical reports, laboratory results, weight, biomarkers, and other health information you choose to provide.

Bluepin processes this information to provide features such as health tracking, report analysis, biomarker organization, comparisons, trends, Health Highlights, Health Score, Health Canvas, and Bluepin Intelligence.

---

## 3. AI Processing Disclosure

Where the signup or feature flow requires consent for health-data processing that includes AI processing, the user should be clearly informed that Bluepin currently uses a third-party AI service for certain Bluepin Intelligence functionality.

### Disclosure

**Bluepin Intelligence uses automated AI processing to analyze certain health information. Bluepin's current implementation uses Google Gemini for applicable insight-generation features.**

**Link:**
- AI Output Disclaimer

### Supporting text

AI-generated information may be inaccurate or incomplete and is provided for informational purposes only. It is not a medical diagnosis or a substitute for professional medical advice.

---

## 4. Optional Marketing Consent

Marketing consent must be separate from required account and health-data consent.

### Checkbox

**☐ I agree to receive promotional and educational communications from Bluepin by email or WhatsApp.**

### Supporting text

These communications may include product updates, educational information, offers, and other promotional content.

You can withdraw your marketing consent or opt out of promotional communications at any time, subject to applicable requirements.

**Do not pre-check this checkbox.**

Marketing consent does not authorize Bluepin to use health information for targeted advertising.

---

## 5. Recommended Signup Layout

The signup experience should present the choices in this order:

### Required

**☐ I agree to the Bluepin Terms of Service and acknowledge the Bluepin Privacy Policy.**

### Required for health-data features

**☐ I consent to Bluepin collecting and processing my health and medical information as described in the Health Data Consent Notice.**

### Optional

**☐ I agree to receive promotional and educational communications from Bluepin by email or WhatsApp.**

The three choices should not be combined into one checkbox.

---

## 6. Google Sign-In

Bluepin currently uses **Google Sign-In** for user authentication.

Recommended button:

**Continue with Google**

The signup experience should not state that Apple Sign-In or another authentication provider is available unless that authentication method is actually implemented.

---

## 7. Age / Eligibility

The current Bluepin Terms of Service and Privacy Policy do **not** establish an explicit 18+ eligibility requirement.

Therefore, the signup experience should **not** currently include language such as:

- “I confirm that I am 18 years or older.”
- “Bluepin is only available to users aged 18+.”
- “By signing up, I confirm that I am at least 18.”

Do not add an 18+ consent or date-of-birth gate unless Bluepin intentionally adopts that eligibility requirement and implements it in the product.

---

## 8. Account Creation

The user should not be required to provide health information merely to create an account unless the product intentionally makes health-data submission a condition of account creation.

If Bluepin allows account creation before health information is entered, the health-data consent should be presented when the user first submits health information or otherwise activates a health-data feature.

---

## 9. Consent Recording

Bluepin should retain an appropriate record of required consent and acknowledgement decisions.

The record should, where technically feasible, include:

- user/account identifier;
- consent or acknowledgement type;
- accepted or declined status;
- date and time;
- version of the relevant document;
- application/version information where relevant; and
- withdrawal information where applicable.

The consent record should not prevent deletion of the underlying user data when deletion is required.

---

## 10. Important Implementation Rule

This document is **consent copy**, not evidence that these controls currently exist in the application.

Before publishing or relying on this copy, Bluepin should implement and verify:

1. the Terms/Privacy acknowledgement;
2. the separate health-data consent;
3. the optional marketing consent;
4. the consent-recording mechanism; and
5. the corresponding withdrawal/deletion behavior.

The final UI text should match the controls that are actually implemented.

---

## 11. Related Documents

This signup copy should be used together with:

- Bluepin Terms of Service
- Bluepin Privacy Policy
- Bluepin Health Data Consent Notice
- Bluepin Medical / Health Disclaimer
- Bluepin AI Output Disclaimer
- Bluepin Cookie & Tracking Policy
