import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";

/**
 * Daily glucose limits and user-local day/time resolution.
 *
 * Self-contained — no dependency on the legacy server/services/whatsapp module.
 */

/** Max glucose readings a user may log in a UTC day. */
const GLUCOSE_DAILY_LIMIT = 10;

function getUtcDay(d = new Date()) {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Resolves the user's local date (YYYY-MM-DD) and time (HH:mm) from their phone
 * country code, so a reading logged at 11pm is filed under the right day.
 *
 * APP_TIMEZONE overrides the inferred zone when set.
 */
export function getFormattedUserTime(
  senderPhone: string,
  dateObj = new Date(),
): { dateStr: string; timeStr: string } {
  let timeZone = "Asia/Kolkata";
  if (senderPhone.startsWith("1")) timeZone = "America/New_York";
  else if (senderPhone.startsWith("44")) timeZone = "Europe/London";
  else if (senderPhone.startsWith("971")) timeZone = "Asia/Dubai";
  else if (senderPhone.startsWith("65")) timeZone = "Asia/Singapore";
  else if (senderPhone.startsWith("61")) timeZone = "Australia/Sydney";
  if (process.env.APP_TIMEZONE) timeZone = process.env.APP_TIMEZONE;

  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    dateObj,
  ); // YYYY-MM-DD
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj); // HH:mm

  return { dateStr, timeStr };
}

/**
 * Reads today's glucose counter and computes the write for this reading.
 *
 * Returns `allowed: false` when the cap is already reached. Callers must still
 * write `limitsRef` with `limitUpdate` inside the same batch as the reading, so
 * the counter and the record cannot drift apart.
 */
export async function checkGlucoseDailyLimit(
  uid: string,
  now = new Date(),
): Promise<{
  allowed: boolean;
  limitsRef: DocumentReference;
  limitUpdate: { gYear: number; gMonth: number; gDay: number; gCount: number };
}> {
  const db = getAdminFirestore();
  const limitsRef = db.doc(`users/${uid}/stats/limits`);
  const limitsSnap = await limitsRef.get();
  const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

  const { year, month, day } = getUtcDay(now);
  const isNewDay =
    limitsData.gYear !== year ||
    limitsData.gMonth !== month ||
    limitsData.gDay !== day;
  const gCount = isNewDay ? 1 : (limitsData.gCount || 0) + 1;

  return {
    allowed: gCount <= GLUCOSE_DAILY_LIMIT,
    limitsRef,
    limitUpdate: { gYear: year, gMonth: month, gDay: day, gCount },
  };
}
