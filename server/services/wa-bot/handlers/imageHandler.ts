import { extractGlucoseFromBase64 } from "../../glucoseService";
import { handleGlucoseText } from "./glucoseHandler";
import {
  downloadMediaFromMeta,
  sendInvalidGlucoseResponse,
  sendTextMessage,
  type MediaHint,
} from "../wa-client";

/**
 * Handles an incoming glucometer image.
 *
 * Pipeline:
 *   1. Download raw bytes from Meta
 *   2. Compress + send to Gemini Flash (via existing extractGlucoseFromBase64)
 *   3. If a valid number is extracted → feed into the same glucose text flow
 *      (which checks the daily limit, stores in session, asks for timing)
 *   4. If extraction fails → friendly nudge to try again or send a number manually
 */
export async function handleGlucometerImage(
  sender: string,
  mediaId: string,
  mediaHint?: MediaHint,
): Promise<void> {
  let buffer: Buffer;
  let mimeType: string;

  try {
    ({ buffer, mimeType } = await downloadMediaFromMeta(mediaId, mediaHint));
  } catch (err) {
    console.error("[imageHandler] Failed to download media:", err);
    await sendTextMessage(
      sender,
      "Something went wrong on our side while fetching your photo. " +
        "Please send it again in a minute, or type your reading instead.",
    );
    return;
  }

  const base64Data = buffer.toString("base64");
  const result = await extractGlucoseFromBase64(base64Data, mimeType);

  if (!result.success || result.value == null) {
    // Gemini couldn't find a reading — could be a non-glucometer photo
    await sendInvalidGlucoseResponse(sender);
    return;
  }

  console.log(
    `[imageHandler] OCR extracted ${result.value} ${result.unit ?? "mg/dL"} from image for ${sender}`,
  );

  // Reuse the same flow as a manually typed number
  // (daily limit check → session store → timing prompt)
  await handleGlucoseText(sender, result.value);
}
