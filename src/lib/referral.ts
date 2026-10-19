/**
 * Referral Tracking & Attribution Client Helper
 */

const PENDING_REF_KEY = "pending_ref";

/**
 * Captures referral parameters from URL search query on application load.
 * Stores normalized code in sessionStorage to preserve it across sign-up steps in the tab.
 */
export function captureReferralCode(): void {
  if (typeof window === "undefined" || !window.location) return;

  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && typeof ref === "string" && ref.trim()) {
      const cleanCode = ref.trim().toUpperCase();
      sessionStorage.setItem(PENDING_REF_KEY, cleanCode);
    }
  } catch (err) {
    console.warn("[Referral] Failed to capture ref code from URL:", err);
  }
}

/**
 * Returns the currently pending referral code, if any.
 */
export function consumeReferralCode(): string | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  return sessionStorage.getItem(PENDING_REF_KEY);
}

/**
 * Clears the stored referral code once attribution succeeds.
 */
export function clearReferralCode(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  sessionStorage.removeItem(PENDING_REF_KEY);
}

/**
 * Dispatches an attribution request to the server in a non-blocking manner.
 * Call right after a new user signup is confirmed (isNewUser === true).
 */
export async function attributeReferral(idToken: string): Promise<void> {
  const code = consumeReferralCode();
  if (!code || !idToken) return;

  try {
    const res = await fetch("/api/referrals/attribute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ refCode: code }),
    });

    if (res.ok) {
      clearReferralCode();
    } else {
      const data = await res.json().catch(() => ({}));
      // If already attributed or account not new, clear code so we don't retry endlessly
      if (data?.alreadyAttributed || data?.code === "ACCOUNT_NOT_NEW") {
        clearReferralCode();
      }
    }
  } catch (err) {
    // Non-blocking fire-and-forget: network errors shouldn't crash the UI
    console.warn("[Referral] Non-blocking attribution attempt failed:", err);
  }
}
