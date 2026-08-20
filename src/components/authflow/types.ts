import * as z from "zod";

export interface ConsentState {
  termsRead: boolean;
  privacyRead: boolean;
  legalConsent: boolean;
}

export interface AuthFormValues {
  email: string;
  password: string;
  consent: ConsentState;
}

export const CONSENT_KEYS: (keyof ConsentState)[] = [
  "termsRead",
  "privacyRead",
  "legalConsent",
];

// Login: no consent required
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  consent: z.object({
    termsRead: z.boolean(),
    privacyRead: z.boolean(),
    legalConsent: z.boolean(),
  }),
});

// Sign-up: consent required
export const signUpSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  consent: z
    .object({
      termsRead: z.boolean(),
      privacyRead: z.boolean(),
      legalConsent: z.boolean(),
    })
    .refine((c) => CONSENT_KEYS.every((k) => c[k]), {
      message: "Please give the required consents above.",
      path: ["legalConsent"], // where the error surfaces
    }),
});

export type AuthSchema = typeof loginSchema | typeof signUpSchema;
