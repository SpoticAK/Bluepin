import React, { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LegalDocsModal } from "./LegalDocsModal";
import { getConsentPayload, LegalDocType } from "../lib/consentManager";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeConsent, setAgreeConsent] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);
  const [showConsentError, setShowConsentError] = useState(false);
  const canSignUp = agreeTerms && agreePrivacy && agreeConsent;

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const userCred = await getRedirectResult(auth);
        if (userCred) {
          const additionalInfo = getAdditionalUserInfo(userCred);
          if (additionalInfo?.isNewUser) {
            await setDoc(
              doc(db, "users", userCred.user.uid),
              {
                consent: getConsentPayload(navigator.userAgent),
              },
              { merge: true },
            );
          }
        }
      } catch (err: any) {
        if (err.code !== "auth/redirect-cancelled-by-user") {
          setError(err.message || "An error occurred during authentication.");
        }
      }
    };
    checkRedirect();
  }, []);

  const handleToggleMode = () => {
    setIsLogin((prev) => !prev);
    setError("");
    setShowConsentError(false);
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeConsent(false);
    setPassword("");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !canSignUp) {
      setShowConsentError(true);
      return;
    }
    setShowConsentError(false);
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await setDoc(
          doc(db, "users", userCred.user.uid),
          {
            consent: getConsentPayload(navigator.userAgent),
          },
          { merge: true },
        );
      }
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError(
          'This email is already registered. If you previously signed in with Google, please use the "Sign in with Google" button below.',
        );
      } else if (err.code === "auth/invalid-credential") {
        setError(
          'Invalid email or password. If you previously signed in with Google, please use the "Sign in with Google" button below. Otherwise, check your password.',
        );
      } else {
        if (err.code === "auth/popup-blocked") {
          setError(
            "Popup blocked by browser. Please open the app in a new tab (using the button in the top right) to sign in with Google, or allow popups.",
          );
        } else {
          setError(err.message || "An error occurred during authentication.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        // Do not set googleLoading to false, as the page will redirect
      } else {
        const userCred = await signInWithPopup(auth, provider);
        const additionalInfo = getAdditionalUserInfo(userCred);
        if (additionalInfo?.isNewUser) {
          // Record DPDP compliant consent automatically upon Google sign-up
          await setDoc(
            doc(db, "users", userCred.user.uid),
            {
              consent: getConsentPayload(navigator.userAgent),
            },
            { merge: true },
          );
        }
        setGoogleLoading(false);
      }
    } catch (err: any) {
      if (err.code === "auth/popup-blocked") {
        setError(
          'Popup blocked by your browser. Please click the "Open in new tab" button (top right of the preview) to use Google Sign-In, or allow popups for this site.',
        );
      } else if (
        err.code === "auth/cancelled-popup-request" ||
        err.code === "auth/popup-closed-by-user"
      ) {
        setError(
          "Google Sign-In popup was closed or cancelled. If you are in the preview, try opening the app in a new tab (top right icon) to use Google Sign-In.",
        );
      } else {
        setError(err.message || "An error occurred during authentication.");
      }
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-card flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-2">
          <div
            className="flex items-center gap-2"
            style={{ animation: "float 5s ease-in-out infinite" }}
          >
            <img
              src="/Bluepin.png"
              alt="Bluepin Logo"
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-5xl font-display tracking-tight text-theme-text">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
        </div>
        <div className="text-center mb-8">
          <p
            className="text-[20px] md:text-[21px] text-black leading-tight"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Managing{" "}
            <span className="bg-linear-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent font-medium">
              diabetes
            </span>{" "}
            just got simpler.
          </p>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-theme-critical bg-theme-critical/10 rounded-xl border border-theme-critical text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
          <div>
            <label className="block text-xs font-bold text-black mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-black mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-black"
            />
          </div>
          {!isLogin && (
            <div className="space-y-3 mb-4 bg-theme-bg p-4 rounded-xl border border-theme-border">
              <p className="text-xs font-bold text-theme-text mb-3">
                Required Consents
              </p>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 rounded border-2 border-theme-border peer-checked:border-theme-accent peer-checked:bg-theme-accent transition-all"></div>
                  <svg
                    className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="text-xs text-theme-text-sec leading-snug select-none">
                  I have read and agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenLegalDoc("terms");
                    }}
                    className="text-theme-accent font-medium hover:underline"
                  >
                    Terms of Service
                  </button>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 rounded border-2 border-theme-border peer-checked:border-theme-accent peer-checked:bg-theme-accent transition-all"></div>
                  <svg
                    className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="text-xs text-theme-text-sec leading-snug select-none">
                  I have read the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenLegalDoc("privacy");
                    }}
                    className="text-theme-accent font-medium hover:underline"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeConsent}
                    onChange={(e) => setAgreeConsent(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 rounded border-2 border-theme-border peer-checked:border-theme-accent peer-checked:bg-theme-accent transition-all"></div>
                  <svg
                    className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="text-xs text-theme-text-sec leading-snug select-none">
                  I consent to Bluepin collecting, storing and processing my
                  personal and health information to provide the services
                  described in the Privacy Policy and Terms of Service.
                </span>
              </label>
            </div>
          )}
          {showConsentError && !isLogin && !canSignUp && (
            <p className="text-xs text-theme-critical font-medium mb-3">
              * Please give the required consents above.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center mb-4">
          <div className="flex-1 border-t border-theme-border"></div>
          <p className="px-4 text-xs text-theme-text-sec font-bold">or</p>
          <div className="flex-1 border-t border-theme-border"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading || googleLoading}
          className="w-full py-3 px-4 bg-theme-card border border-theme-border hover:bg-theme-card-sec text-theme-text font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm mb-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {googleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <p className="text-[11px] text-theme-text-sec text-center leading-relaxed px-1 mb-6">
          By continuing, you agree to our{" "}
          <button
            type="button"
            onClick={() => setOpenLegalDoc("terms")}
            className="text-theme-accent hover:underline font-medium"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setOpenLegalDoc("privacy")}
            className="text-theme-accent hover:underline font-medium"
          >
            Privacy Policy
          </button>
          , and consent to personal and health data processing.
        </p>

        <p className="text-center text-sm text-theme-text-sec">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={handleToggleMode}
            className="font-bold text-theme-text hover:underline"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>{" "}
      <LegalDocsModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        defaultTab={openLegalDoc || "terms"}
      />{" "}
    </div>
  );
}
