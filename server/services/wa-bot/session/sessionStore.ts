/**
 * In-memory session store for pending conversation state.
 *
 * ponytail: plain Map is fine for single-instance dev.
 * TODO(prod): replace with Redis so state survives restarts and scales horizontally.
 */

const PENDING_GLUCOSE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type PendingGlucoseEntry = {
  glucoseValue: number;
  expiresAt: number;
};

const pendingGlucose = new Map<string, PendingGlucoseEntry>();

export function setPendingGlucose(userId: string, value: number): void {
  pendingGlucose.set(userId, {
    glucoseValue: value,
    expiresAt: Date.now() + PENDING_GLUCOSE_TTL_MS,
  });

  // Active memory cleanup: delete the key after 10 mins so we don't leak memory
  // if the user never taps a button.
  setTimeout(() => {
    const entry = pendingGlucose.get(userId);
    if (entry && Date.now() >= entry.expiresAt) {
      pendingGlucose.delete(userId);
    }
  }, PENDING_GLUCOSE_TTL_MS);
}

export function getPendingGlucose(userId: string): number | null {
  const entry = pendingGlucose.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingGlucose.delete(userId);
    return null;
  }
  return entry.glucoseValue;
}

export function clearPendingGlucose(userId: string): void {
  pendingGlucose.delete(userId);
}
