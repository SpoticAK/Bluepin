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
 * Resolves the local date (YYYY-MM-DD) and time (HH:mm) for a reading, so one
 * logged at 11pm is filed under the right day.
 *
 * Bluepin is India-only, so this is always IST — and it has to stay in step
 * with the IST assumption in server/routes/cron.ts. Cron compares this `date`
 * against the day it fires in; if the two ever disagree on the calendar day,
 * cron concludes a user who already logged has not, and re-nudges them.
 *
 * The zone is deliberately NOT inferred from the sender's country code. That
 * mapped Meta's `1…` test number to America/New_York, which sits 10.5 hours
 * behind IST, so readings were filed under a different day than cron checked
 * whenever the IST clock was between midnight and 05:30.
 *
 * APP_TIMEZONE overrides the zone when set. `senderPhone` is retained so call
 * sites keep reading naturally, but it no longer influences the result.
 */
export function getFormattedUserTime(
  _senderPhone: string,
  dateObj = new Date(),
): { dateStr: string; timeStr: string } {
  const timeZone = process.env.APP_TIMEZONE || "Asia/Kolkata";

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
