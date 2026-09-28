import { useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type UserCredential,
  getAdditionalUserInfo,
  deleteUser,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

interface UseFirebaseAuthResult {
  loading: boolean;
  googleLoading: boolean;
  phoneLoading: boolean;
  error: string | null;
  confirmationResult: ConfirmationResult | null;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<UserCredential | null>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<UserCredential | null>;
  signInWithGoogle: () => Promise<{
    result: UserCredential;
    isNewUser: boolean;
  } | null>;
  sendPhoneOtp: (phoneNumber: string, containerId?: string) => Promise<boolean>;
  verifyPhoneOtp: (otp: string) => Promise<{
    result: UserCredential;
    isNewUser: boolean;
  } | null>;
  resetPhoneAuth: () => void;
  abandonUnconsentedGoogleSignup: () => Promise<void>;
  clearError: () => void;
}

function cleanupRecaptcha(containerId = "recaptcha-container") {
  if (typeof window === "undefined") return;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Could not clear recaptchaVerifier:", e);
    }
    window.recaptchaVerifier = undefined;
  }

  const containerEl = document.getElementById(containerId);
  if (containerEl && containerEl.parentNode) {
    const fresh = document.createElement("div");
    fresh.id = containerId;
    containerEl.parentNode.replaceChild(fresh, containerEl);
  }
}

export function useFirebaseAuth(): UseFirebaseAuthResult {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  const runEmailAuth = useCallback(
    async (
      fn: typeof signInWithEmailAndPassword,
      email: string,
      password: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        return await fn(auth, email, password);
      } catch (err) {
        setError(mapFirebaseError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      runEmailAuth(signInWithEmailAndPassword, email, password),
    [runEmailAuth],
  );

  const signUpWithEmail = useCallback(
    (email: string, password: string) =>
      runEmailAuth(createUserWithEmailAndPassword, email, password),
    [runEmailAuth],
  );

  const signInWithGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
      return { result, isNewUser };
    } catch (err) {
      setError(mapFirebaseError(err));
      return null;
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const getOrCreateRecaptcha = (
    containerId: string = "recaptcha-container",
  ) => {
    if (typeof window === "undefined") return null;

    // Reuse existing verifier if available (prevents "reCAPTCHA already rendered" on Resend OTP)
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }

    const containerEl = document.getElementById(containerId);
    if (!containerEl) {
      throw new Error(`reCAPTCHA container #${containerId} not found in DOM`);
    }

    // Ensure container is a brand new DOM node so grecaptcha doesn't detect previous renders
    const freshContainer = document.createElement("div");
    freshContainer.id = containerId;
    if (containerEl.parentNode) {
      containerEl.parentNode.replaceChild(freshContainer, containerEl);
    }

    const verifier = new RecaptchaVerifier(auth, freshContainer, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved
      },
      "expired-callback": () => {
        setError("reCAPTCHA expired. Please try sending OTP again.");
      },
    });

    window.recaptchaVerifier = verifier;
    return verifier;
  };

  const sendPhoneOtp = useCallback(
    async (phoneNumber: string, containerId = "recaptcha-container") => {
      setPhoneLoading(true);
      setError(null);
      try {
        const verifier = getOrCreateRecaptcha(containerId);
        if (!verifier) throw new Error("Could not initialize reCAPTCHA.");
        const confirmation = await signInWithPhoneNumber(
          auth,
          phoneNumber,
          verifier,
        );
        setConfirmationResult(confirmation);
        return true;
      } catch (err: any) {
        console.error("sendPhoneOtp error:", err);
        setError(mapFirebaseError(err));
        cleanupRecaptcha(containerId);
        return false;
      } finally {
        setPhoneLoading(false);
      }
    },
    [],
  );

  const verifyPhoneOtp = useCallback(
    async (otp: string) => {
      if (!confirmationResult) {
        setError("Please request an OTP first.");
        return null;
      }
      setPhoneLoading(true);
      setError(null);
      try {
        const result = await confirmationResult.confirm(otp);
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
        return { result, isNewUser };
      } catch (err: any) {
        console.error("verifyPhoneOtp error:", err);
        const code = (err as { code?: string })?.code ?? "";
        // If the code/session has expired, reset confirmationResult so user requests a fresh OTP
        if (code === "auth/code-expired" || code === "auth/session-expired") {
          setConfirmationResult(null);
        }
        setError(mapFirebaseError(err));
        return null;
      } finally {
        setPhoneLoading(false);
      }
    },
    [confirmationResult],
  );

  const resetPhoneAuth = useCallback(() => {
    setConfirmationResult(null);
    setError(null);
    cleanupRecaptcha();
  }, []);

  const abandonUnconsentedGoogleSignup = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteUser(user);
    } catch {
      // deleteUser can fail if the session is stale (auth/requires-recent-login) —
      // sign out as a fallback so they aren't left in a half-authed state
      await signOut(auth);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    googleLoading,
    phoneLoading,
    error,
    confirmationResult,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    resetPhoneAuth,
    abandonUnconsentedGoogleSignup,
    clearError,
  };
}

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const rawMsg = (err as { message?: string })?.message ?? "";

  switch (code) {
    case "auth/operation-not-allowed":
      return "Phone sign-in is disabled in Firebase. Please enable 'Phone' under Firebase Console > Authentication > Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Firebase Auth. Add it to Firebase Console > Authentication > Settings > Authorized domains.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/invalid-phone-number":
      return "Invalid phone number. Please enter a valid 10-digit mobile number.";
    case "auth/missing-phone-number":
      return "Please enter your mobile phone number.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for today. Please use Google sign-in or test numbers.";
    case "auth/captcha-check-failed":
      return "Security / reCAPTCHA check failed. Please refresh and try again.";
    case "auth/invalid-verification-code":
      return "Incorrect OTP. Please enter the 6-digit code sent to your phone.";
    case "auth/code-expired":
      return "The OTP code has expired. Please request a new code.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes before trying again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/invalid-app-credential":
      return "Invalid Firebase App configuration for phone auth. Check phone sign-in settings in Firebase.";
    case "auth/internal-error":
      return "Firebase internal error. Please ensure Phone provider is enabled in Firebase Console, and test numbers are configured.";
    default:
      // Don't leak raw internal messages to consumer UI in production
      return import.meta.env.DEV && rawMsg
        ? `${rawMsg} (${code || "unknown"})`
        : "Something went wrong. Please try again.";
  }
}
