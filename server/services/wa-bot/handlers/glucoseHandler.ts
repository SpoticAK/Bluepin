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
} from "../wa-client";
import type { TimingLabel } from "../types";

const GLUCOSE_MIN = 1;
const GLUCOSE_MAX = 800;

const VALID_TIMING_IDS = new Set<string>(["fasting", "random", "post-prandial"]);

/**
 * Smartly extracts a probable glucose reading from text.
 * Matches:
 * 1. Just a number: "126"
 * 2. Number + mg/dl: "126 mg/dl", "126mg/dL"
 * 3. Conversational: "my glucose is 126", "reading 126"
 */
export function extractGlucoseValue(text: string): number | null {
  // 1. Strict match: string is ONLY a number, possibly with mg/dl at the end
  let m = text.match(/^\s*(\d{1,3})\s*(?:mg\/?dl)?\s*$/i);
  if (m && m[1]) return parseInt(m[1], 10);

  // 2. Contains "mg/dl" anywhere, grab the number right before it
  m = text.match(/\b(\d{1,3})\s*mg\/?dl\b/i);
  if (m && m[1]) return parseInt(m[1], 10);

  // 3. Contains keywords followed by a number
  m = text.match(/\b(?:glucose|sugar|reading|level)\s*(?:is\s*|=|:)?\s*(\d{1,3})\b/i);
  if (m && m[1]) return parseInt(m[1], 10);

  return null;
}

/**
 * Validates the extracted glucose range, stores it in session, and prompts for timing.
 */
export async function handleGlucoseText(
  sender: string,
  num: number,
): Promise<void> {
  if (isNaN(num) || num < GLUCOSE_MIN || num > GLUCOSE_MAX) {
    await sendInvalidGlucoseResponse(sender);
    return;
  }

  setPendingGlucose(sender, num);
  await sendGlucoseTimingPrompt(sender, num);
}

/**
 * Handles the interactive button reply after the timing prompt.
 * Reads the pending glucose value from session and logs the complete entry.
 */
export async function handleGlucoseTimingReply(
  sender: string,
  buttonId: string,
): Promise<void> {
  if (!VALID_TIMING_IDS.has(buttonId)) return;

  const glucoseValue = getPendingGlucose(sender);

  if (glucoseValue === null) {
    await sendNoPendingReadingResponse(sender);
    return;
  }

  clearPendingGlucose(sender);

  await sendGlucoseLogConfirmation(sender, glucoseValue, buttonId as TimingLabel);

  // TODO: persist to DB
  // await glucoseService.saveReading(sender, glucoseValue, buttonId as TimingLabel);
  console.log(
    `[glucose] Logged ${glucoseValue} mg/dL | timing: ${buttonId} | user: ${sender}`,
  );
}
