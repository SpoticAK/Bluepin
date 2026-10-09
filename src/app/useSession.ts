import { useState, useEffect } from "react";
import { onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export function useSession() {
  const [sessionUser, setSessionUser] = useState<any>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  // True while a ?wa_t= magic-login exchange is in flight. Initialised
  // synchronously from the URL so the very first render already knows not to
  // flash the login screen before the exchange resolves.
  const [isExchangingMagicLink, setIsExchangingMagicLink] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("wa_t");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Tracks the magic-login exchange within this effect's closure so the
    // auth callback below can ignore the transient `null` user while the
    // exchange is in flight (avoids flashing AuthScreen before auto-login).
    // Note: tokens are single-use (consumed server-side), so a failed
    // exchange surfaces an error rather than retrying the same token.
    let exchangeInFlight = false;
    let exchangeError: string | null = null;

    // Handle WhatsApp Magic Login Token (wa_t)
    const urlParams = new URLSearchParams(window.location.search);
    const waToken = urlParams.get("wa_t");
    if (waToken) {
      exchangeInFlight = true;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("wa_t");
      window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ""),
      );

      fetch("/api/whatsapp/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: waToken }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.success && data.customToken) {
            const { signInWithCustomToken } = await import("firebase/auth");
            await signInWithCustomToken(auth, data.customToken);
            // Success path resolves via onAuthStateChanged below, which
            // clears the exchanging flag.
          } else {
            exchangeInFlight = false;
            exchangeError =
              data.error ||
              "This WhatsApp login link is invalid or expired. Please tap the dashboard link in WhatsApp again to get a fresh one.";
            setIsExchangingMagicLink(false);
            setAuthError(exchangeError);
            // Leave sessionUser as undefined so the error card renders
            // (with Retry / Continue to Sign In) instead of AuthScreen.
          }
        })
        .catch((err) => {
          console.error("WhatsApp magic login failed:", err);
          exchangeInFlight = false;
          exchangeError =
            "Could not complete WhatsApp login. Please check your connection and tap the dashboard link in WhatsApp again.";
          setIsExchangingMagicLink(false);
          setAuthError(exchangeError);
          // Leave sessionUser as undefined so the error card renders.
        });
    }

    // Handle redirect sign-in results (e.g. mobile standalone PWA)
    getRedirectResult(auth).catch((err) => {
      if (err.code !== "auth/redirect-cancelled-by-user") {
        console.error("Redirect result error:", err);
      }
    });

    const timer = setTimeout(() => {
      setAuthTimedOut(true);
    }, 8000);

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        clearTimeout(timer);
        setAuthTimedOut(false);
        setAuthError(exchangeError);
        if (u) {
          exchangeInFlight = false;
          setIsExchangingMagicLink(false);
          try {
            localStorage.setItem("bluepin_welcome_seen", "true");
          } catch {}
          let isOnboarded = false;
          let fetchSuccess = false;

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const docRef = doc(db, "users", u.uid);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                fetchSuccess = true;
                const data = docSnap.data();
                isOnboarded = Boolean(data?.name);
                break;
              } else {
                fetchSuccess = true;
                isOnboarded = false;
                break;
              }
            } catch (e: any) {
              console.warn(
                `Firestore user doc fetch attempt ${attempt + 1} failed:`,
                e?.message || e,
              );
              // Wait 250ms before retrying to allow auth token propagation to Firestore client
              await new Promise((res) => setTimeout(res, 250));
            }
          }

          if (fetchSuccess) {
            setNeedsOnboarding(!isOnboarded);
          } else {
            // If all fetch attempts failed, do not trap an existing user in onboarding
            setNeedsOnboarding(false);
          }
        } else if (exchangeInFlight) {
          // Transient null while the magic-link exchange is still running —
          // stay on the splash instead of flashing the login screen.
          return;
        } else if (exchangeError) {
          // Exchange already failed: keep the error card (sessionUser stays
          // undefined) instead of dropping to the login screen, so the user
          // sees why the link didn't work.
          return;
        }
        setSessionUser(u);
      },
      (error) => {
        clearTimeout(timer);
        setAuthError(error.message || "Failed to initialize authentication.");
        setSessionUser(null);
      },
    );

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return {
    sessionUser,
    setSessionUser,
    needsOnboarding,
    setNeedsOnboarding,
    authError,
    authTimedOut,
    setAuthTimedOut,
    isExchangingMagicLink,
  };
}
