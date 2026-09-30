import {
  setPendingGlucose,
  getPendingGlucose,
  clearPendingGlucose,
} from "../session/sessionStore";
import {
  sendGlucoseTimingPrompt,
  sendGlucoseLogConfirmation,
  sendInvalidGlucoseResponse,
  sendNoPendingReadingResponse,
  sendTextMessage,
} from "../wa-client";
import {
  getUidByPhone,
  isGlucoseAllowed,
  saveCompleteGlucoseReading,
} from "../services/glucoseService";
import type { TimingLabel } from "../types";

const GLUCOSE_MIN = 1;
const GLUCOSE_MAX = 800;

const VALID_TIMING_IDS = new Set<string>([
  "fasting",
  "random",
  "post-prandial",
]);

/**
 * Smartly extracts a probable glucose reading from free-form text.
 * Handles integers (126), decimals (5.4), mg/dL, mmol/L, and conversational text.
 */
// export function extractGlucoseValue(text: string): number | null {
//   // Strip out meaningless punctuation from the end (like trailing periods or commas)
//   const cleanText = text.replace(/[.,!?]+$/, "").trim();

//   // 1. Bare number (with optional decimal): "126", "10.5", "126 mg/dl", "6.2 mmol/l"
//   let m = cleanText.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*(?:mg\/?dl|mmol\/?l)?$/i);
//   if (m && m[1]) return parseFloat(m[1]);

//   // 2. Number + unit explicitly embedded anywhere: "I got 126 mg/dl today"
//   m = cleanText.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:mg\/?dl|mmol\/?l)\b/i);
//   if (m && m[1]) return parseFloat(m[1]);

//   // 3. Conversational trigger: "my glucose is 126", "reading: 10.5"
//   m = cleanText.match(/\b(?:glucose|sugar|reading|level)\s*(?:is\s*|=|:)?\s*(\d{1,3}(?:\.\d{1,2})?)\b/i);
//   if (m && m[1]) return parseFloat(m[1]);

//   return null;
// }

export function extractGlucoseValue(text: string): number | null {
  const regex = /\d+(?:\.\d+)?/;

  const m = text.match(regex); // first number (no g flag needed)
  if (!m) return null;

  return parseFloat(m[0]);
}

/**
 * Step 1 of the glucose flow.
 * Validates range, checks daily limit, stores value in session, asks for timing.
 * Nothing is written to the DB here.
 */
export async function handleGlucoseText(
  sender: string,
  num: number,
): Promise<void> {
  if (isNaN(num) || num < GLUCOSE_MIN || num > GLUCOSE_MAX) {
    await sendInvalidGlucoseResponse(sender);
    return;
  }

  // Look up the linked Bluepin account
  const uid = await getUidByPhone(sender);

  // If linked, do a cheap read-only limit check before asking for timing
  // so we don't put the user through the timing flow only to reject at the end
  if (uid) {
    const allowed = await isGlucoseAllowed(uid);
    if (!allowed) {
      await sendTextMessage(
        sender,
        "⚠️ You have reached the daily limit of 10 glucose readings for today.",
      );
      return;
    }
  }

  // Store value + uid in session — nothing hits the DB yet
  setPendingGlucose(sender, num, uid);
  await sendGlucoseTimingPrompt(sender, num);
}

/**
 * Step 2 of the glucose flow.
 * User has confirmed timing. Now write the complete, accurate reading to DB.
 */
export async function handleGlucoseTimingReply(
  sender: string,
  buttonId: string,
): Promise<void> {
  if (!VALID_TIMING_IDS.has(buttonId)) return;

  const pending = getPendingGlucose(sender);

  if (pending === null) {
    await sendNoPendingReadingResponse(sender);
    return;
  }

  // Claim the session immediately to prevent any double-tap from processing twice
  clearPendingGlucose(sender);

  const timing = buttonId as TimingLabel;

  if (pending.uid) {
    // Linked user — write once with full data
    const saved = await saveCompleteGlucoseReading(
      pending.uid,
      sender,
      pending.value,
      timing,
    );

    if (!saved) {
      // Daily limit hit between step 1 and step 2 (e.g. logged via app in between)
      await sendTextMessage(
        sender,
        "⚠️ You have reached the daily limit of 10 glucose readings for today.",
      );
      return;
    }
  } else {
    // Unlinked phone — log it but skip DB write
    console.log(
      `[glucose] Unlinked phone ${sender} — value=${pending.value} timing=${timing} not persisted`,
    );
  }

  await sendGlucoseLogConfirmation(sender, pending.value, timing);
}
