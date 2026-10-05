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
 * Shown when a glucose reading arrives from a number with no linked account.
 *
 * An unlinked reading has nowhere to go, so the flow stops before the timing
 * prompt. Previously it ran to completion and then sent the success
 * confirmation anyway, telling the user their reading was saved when the
 * write had been skipped.
 */
const LINK_REQUIRED_MESSAGE =
  "To log a glucose reading, your WhatsApp must be linked to a Bluepin account.\n\n" +
  "Open the Bluepin app to link your number, then try again.";

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

  // Refuse before the timing prompt rather than after it. Without a uid there
  // is nowhere to write the reading, so asking the user to pick Fasting or
  // Post-Prandial only sets up a confirmation for data we would discard.
  if (!uid) {
    await sendTextMessage(sender, LINK_REQUIRED_MESSAGE);
    return;
  }

  // Cheap read-only limit check before asking for timing, so we don't put the
  // user through the timing flow only to reject at the end
  const allowed = await isGlucoseAllowed(uid);
  if (!allowed) {
    await sendTextMessage(
      sender,
      "You have reached the daily limit of 10 glucose readings for today.",
    );
    return;
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
        "You have reached the daily limit of 10 glucose readings for today.",
      );
      return;
    }
  } else {
    // Unreachable now that step 1 refuses unlinked senders, but kept as a
    // guard: a pending entry outlives the code change that produced it, and a
    // success confirmation for an unwritten reading is worse than a refusal.
    console.log(
      `[glucose] Pending entry for unlinked phone ${sender} — value=${pending.value} timing=${timing} not persisted`,
    );
    await sendTextMessage(sender, LINK_REQUIRED_MESSAGE);
    return;
  }

  await sendGlucoseLogConfirmation(sender, pending.value, timing);
}
