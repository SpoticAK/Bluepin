import * as z from "zod";

export interface ConsentState {
  termsRead: boolean;
  privacyRead: boolean;
  legalConsent: boolean;
}

export interface AuthFormValues {
  email: string;
  password: string;
}

export const CONSENT_KEYS: (keyof ConsentState)[] = [
  "termsRead",
  "privacyRead",
  "legalConsent",
];

// Login schema
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Sign-up schema
export const signUpSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AuthSchema = typeof loginSchema | typeof signUpSchema;
