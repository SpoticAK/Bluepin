import { useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCustomToken,
  type UserCredential,
  getAdditionalUserInfo,
  deleteUser,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface UseFirebaseAuthResult {
  loading: boolean;
  googleLoading: boolean;
  phoneLoading: boolean;
  error: string | null;
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
  sendPhoneOtp: (phoneNumber: string) => Promise<boolean>;
  verifyPhoneOtp: (otp: string) => Promise<{
    result: UserCredential;
    isNewUser: boolean;
  } | null>;
  resetPhoneAuth: () => void;
  abandonUnconsentedGoogleSignup: () => Promise<void>;
  clearError: () => void;
}

export function useFirebaseAuth(): UseFirebaseAuthResult {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhone, setActivePhone] = useState<string | null>(null);

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

  const sendPhoneOtp = useCallback(async (phoneNumber: string) => {
    setPhoneLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send WhatsApp verification code.");
        return false;
      }
      setActivePhone(phoneNumber);
      return true;
    } catch (err: any) {
      console.error("[WhatsApp Auth] sendPhoneOtp error:", err);
      setError("Network error. Please check your internet connection.");
      return false;
    } finally {
      setPhoneLoading(false);
    }
  }, []);

  const verifyPhoneOtp = useCallback(
    async (otp: string) => {
      if (!activePhone) {
        setError("Please request an OTP first.");
        return null;
      }
      setPhoneLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/whatsapp/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: activePhone, otp }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid verification code.");
          if (data.code === "auth/code-expired" || data.code === "auth/too-many-requests") {
            setActivePhone(null);
          }
          return null;
        }

        // Authenticate into Firebase with custom token
        const result = await signInWithCustomToken(auth, data.customToken);
        const isNewUser = !!data.isNewUser;
        return { result, isNewUser };
      } catch (err: any) {
        console.error("[WhatsApp Auth] verifyPhoneOtp error:", err);
        setError("Failed to sign in. Please try again.");
        return null;
      } finally {
        setPhoneLoading(false);
      }
    },
    [activePhone],
  );

  const resetPhoneAuth = useCallback(() => {
    setActivePhone(null);
    setError(null);
  }, []);

  const abandonUnconsentedGoogleSignup = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteUser(user);
    } catch {
      await signOut(auth);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    googleLoading,
    phoneLoading,
    error,
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
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    default:
      return import.meta.env.DEV && rawMsg
        ? `${rawMsg} (${code || "unknown"})`
        : "Something went wrong. Please try again.";
  }
}
