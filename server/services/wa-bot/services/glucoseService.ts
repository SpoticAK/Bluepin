import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";
import {
  checkGlucoseDailyLimit,
  getFormattedUserTime,
} from "./limits";
import type { TimingLabel } from "../types";

const db = () => getAdminFirestore();

const TIMING_MAP: Record<TimingLabel, string> = {
  fasting: "Fasting",
  random: "Random",
  "post-prandial": "Post-Prandial",
};

/**
 * Looks up the Bluepin uid for a given WhatsApp phone number.
 * Returns null if the phone is not linked to any account.
 */
export async function getUidByPhone(phone: string): Promise<string | null> {
  const snap = await db().doc(`whatsapp_users/${phone}`).get();
  if (!snap.exists) return null;
  return snap.data()?.uid ?? null;
}

/**
 * Read-only daily limit check — no writes.
 * Call this before asking the user for timing so we fail fast.
 * Returns false if the user has hit today's 10-reading cap.
 */
export async function isGlucoseAllowed(uid: string): Promise<boolean> {
  const check = await checkGlucoseDailyLimit(uid, new Date());
  return check.allowed;
}

/**
 * Writes a complete glucose reading — value AND timing — in a single atomic batch.
 * Only called after the user confirms timing, so the DB never holds incomplete data.
 *
 * Returns false if the daily limit was hit at write time (edge case: user logged
 * via the app between asking for timing and tapping the button).
 */
export async function saveCompleteGlucoseReading(
  uid: string,
  senderPhone: string,
  value: number,
  timing: TimingLabel,
): Promise<boolean> {
  const now = new Date();
  const limitCheck = await checkGlucoseDailyLimit(uid, now);

  if (!limitCheck.allowed) return false;

  const { dateStr, timeStr } = getFormattedUserTime(senderPhone, now);
  const readingId = crypto.randomUUID();
  // Infer unit from value (same heuristic used across the app)
  const unit = value < 30 ? "mmol/L" : "mg/dL";

  const firestore = db();
  const batch = firestore.batch();

  // Update daily limit counter
  batch.set(limitCheck.limitsRef, limitCheck.limitUpdate, { merge: true });

  // Write the complete, accurate reading — one shot, no patching needed
  batch.set(firestore.doc(`users/${uid}/glucoseReadings/${readingId}`), {
    id: readingId,
    value,
    unit,
    timing: TIMING_MAP[timing],
    source: "Manual",
    date: dateStr,
    time: timeStr,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  console.log(
    `[glucose] Saved: uid=${uid} | value=${value} ${unit} | timing=${TIMING_MAP[timing]} | readingId=${readingId}`,
  );

  return true;
}
