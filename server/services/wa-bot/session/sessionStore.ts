/**
 * In-memory session store for pending conversation state.
 *
 * A plain Map is fine here — pending state is short-lived (10 min window).
 * If the server restarts, the user just sends their number again. That is
 * a much better tradeoff than writing incomplete data to the health DB.
 *
 * TODO(prod): If you scale to multiple server instances, replace with Redis.
 */

const PENDING_GLUCOSE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type PendingGlucoseEntry = {
  value: number;
  uid: string | null; // null = phone not linked to a Bluepin account
  expiresAt: number;
};

const pendingGlucose = new Map<string, PendingGlucoseEntry>();

export function setPendingGlucose(
  phone: string,
  value: number,
  uid: string | null,
): void {
  pendingGlucose.set(phone, {
    value,
    uid,
    expiresAt: Date.now() + PENDING_GLUCOSE_TTL_MS,
  });

  // Active cleanup: evict the key after TTL so abandoned sessions don't leak RAM
  setTimeout(() => {
    const entry = pendingGlucose.get(phone);
    if (entry && Date.now() >= entry.expiresAt) {
      pendingGlucose.delete(phone);
    }
  }, PENDING_GLUCOSE_TTL_MS);
}

export function getPendingGlucose(phone: string): PendingGlucoseEntry | null {
  const entry = pendingGlucose.get(phone);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingGlucose.delete(phone);
    return null;
  }
  return entry;
}

export function clearPendingGlucose(phone: string): void {
  pendingGlucose.delete(phone);
}
