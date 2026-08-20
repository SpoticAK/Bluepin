import { useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type UserCredential,
  getAdditionalUserInfo,
  deleteUser,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface UseFirebaseAuthResult {
  loading: boolean;
  googleLoading: boolean;
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
  abandonUnconsentedGoogleSignup: () => Promise<void>;
  clearError: () => void;
}

export function useFirebaseAuth(): UseFirebaseAuthResult {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    abandonUnconsentedGoogleSignup,
    clearError,
  };
}

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  // const code = (err as any)?.code || "unknown_error";
  // const message = (err as any)?.message || "Something went wrong.";

  // 📱 Shows the exact error code on the mobile screen
  // return `[${code}] ${message}: wholeerror: ${err}`;
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
      return "Something went wrong. Please try again.";
  }
}
