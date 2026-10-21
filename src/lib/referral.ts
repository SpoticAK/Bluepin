/**
 * Referral Tracking & Attribution Client Helper
 */

const PENDING_REF_KEY = "pending_ref";

/**
 * sessionStorage can throw in privacy modes / blocked-cookie contexts.
 * Always degrade to a no-op rather than breaking signup.
 */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

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
      getStorage()?.setItem(PENDING_REF_KEY, cleanCode);
    }
  } catch (err) {
    console.warn("[Referral] Failed to capture ref code from URL:", err);
  }
}

/**
 * Returns the currently pending referral code, if any.
 */
export function consumeReferralCode(): string | null {
  return getStorage()?.getItem(PENDING_REF_KEY) ?? null;
}

/**
 * Clears the stored referral code once attribution succeeds.
 */
export function clearReferralCode(): void {
  try {
    getStorage()?.removeItem(PENDING_REF_KEY);
  } catch (err) {
    console.warn("[Referral] Failed to clear pending ref code:", err);
  }
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
      return;
    }

    const data = await res.json().catch(() => ({}));

    // Terminal responses mean retrying can never succeed. Transient failures
    // (network, 429, 5xx) keep the code so it can be retried after the next
    // auth state change instead of silently losing the attribution.
    const isTerminal =
      res.status === 400 ||
      res.status === 404 ||
      res.status === 410 ||
      Boolean(data?.alreadyAttributed);

    if (isTerminal) {
      clearReferralCode();
    }
  } catch (err) {
    // Non-blocking fire-and-forget: network errors shouldn't crash the UI
    console.warn("[Referral] Non-blocking attribution attempt failed:", err);
  }
}
