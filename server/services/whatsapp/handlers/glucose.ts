import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";
import { extractGlucoseFromBase64 } from "../../glucoseService";
import {
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  sendWhatsAppCtaUrl,
} from "../client";
import { createWhatsAppMagicLoginUrl, getDashboardUrl } from "../auth";
import { getFormattedUserTime, checkGlucoseDailyLimit } from "../utils";
import { GlucoseTiming, InteractiveButton } from "../types";

/**
 * Single source of truth for the timing prompt.
 *
 * The plaintext fallback renders these in this exact order and asks the user to
 * reply with the option name, never a number, so it cannot collide with the
 * 1/2/3 reminder prompt.
 */
export const TIMING_BUTTONS: InteractiveButton[] = [
  { id: "timing_fasting", title: "Fasting (>8h)" },
  { id: "timing_random", title: "Random (2–8h)" },
  { id: "timing_pp", title: "Post meal (<2h)" },
];

const TIMING_BY_BUTTON_ID: Record<string, GlucoseTiming> = {
  timing_fasting: "Fasting",
  timing_random: "Random",
  timing_pp: "Post-Prandial",
};

const sendNotAReading = (senderPhone: string): Promise<boolean> =>
  sendWhatsAppMessage(
    senderPhone,
    "That number is outside the range of a real glucose reading, so I have not logged it. 🤔\n" +
      "Send me the number like 126, or a photo of your glucometer.\n\n" +
      "Type help if you need anything.",
  );

/** Maps a positional reply (1-based, matching the button order) to a timing. */
export const timingFromPosition = (position: number): GlucoseTiming | null => {
  const button = TIMING_BUTTONS[position - 1];
  return button ? TIMING_BY_BUTTON_ID[button.id] ?? null : null;
};

export const timingFromButtonId = (buttonId: string): GlucoseTiming | null =>
  TIMING_BY_BUTTON_ID[buttonId] ?? null;

/**
 * Sends the meal-timing prompt. The fallback hint is keyword-based on purpose:
 * the reminder prompt also offers 1/2/3, so numeric hints would be ambiguous.
 */
async function sendTimingPrompt(
  senderPhone: string,
  readingLabel: string,
): Promise<void> {
  const promptText =
    `I got ${readingLabel}.\n\n` +
    `One more thing: when was this taken relative to your last meal or sugary drink?\n` +
    `Type help if you need anything.`;

  await sendWhatsAppButtons(
    senderPhone,
    promptText,
    TIMING_BUTTONS,
    "\n\nReply with *fasting*, *random*, or *post meal*.",
  );
}


/**
 * Handles user selecting a timing (Fasting, Post-Prandial, or Random) for a pending glucometer reading.
 */
export async function handleTimingSelection(
  senderPhone: string,
  timingChoice: GlucoseTiming,
): Promise<boolean> {
  const db = getAdminFirestore();
  const pendingRef = db.doc(`whatsapp_pending_glucose/${senderPhone}`);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    return false;
  }

  const pendingData = pendingSnap.data()!;
  const { uid, readingId, value, unit, time } = pendingData;

  // 1. Update the glucose reading in Firestore
  if (uid && readingId) {
    await db.doc(`users/${uid}/glucoseReadings/${readingId}`).update({
      timing: timingChoice,
    });
  }

  // 2. Clear pending state
  await pendingRef.delete();

  // 3. Send confirmation with 1-click magic login CTA button
  const magicUrl = uid
    ? await createWhatsAppMagicLoginUrl(uid)
    : getDashboardUrl();
  let displayTiming = timingChoice === "Post-Prandial" ? "post-meal" : timingChoice.toLowerCase();
  await sendWhatsAppCtaUrl(
    senderPhone,
    `Got it. I have logged ${value} ${unit} as a ${displayTiming} reading.\n` +
    `Your health profile is up to date.\n\n` +
    `Type help if you need anything.`,
    "View health profile",
    magicUrl,
  );

  return true;
}

/**
 * Parses and saves manual glucose readings sent via WhatsApp text.
 */
export async function handleTextGlucoseLogging(
  uid: string,
  senderPhone: string,
  text: string,
): Promise<void> {
  const db = getAdminFirestore();

  // Pattern: "110", "110 fasting", "145 pp", "145 post-meal", "5.6 mmol/l"
  const regex =
    /^(?:glucose\s*:?\s*)?(\d{1,3}(?:\.\d+)?)\s*(mg\/?dl|mmol\/?l)?\s*(fasting|fast|pp|post-?prandial|post-?meal|random|bedtime|after-?meal|before-?meal)?$/i;
  const match = text.match(regex);

  if (!match) {
    // If it's a known non-glucose word that shouldn't trigger this?
    // Wait, any text goes here. If we can't parse it as glucose, it could be unsupported text.
    // Let's use Guideline 3 here, as they tried to send text but it wasn't valid glucose.
    await sendWhatsAppMessage(
      senderPhone,
      "I could not find a glucose reading in that. 🤔\n" +
      "Send me the number, like 126, or a photo of your glucometer and I will take it from there.\n\n" +
      "Type help if you need anything.",
    );
    return;
  }

  const rawValue = parseFloat(match[1]);
  if (isNaN(rawValue) || rawValue <= 0 || rawValue > 1000) {
    await sendWhatsAppMessage(
      senderPhone,
      "I could not find a glucose reading in that. 🤔\n" +
        "Send me the number, like 126, or a photo of your glucometer and I will take it from there.\n\n" +
        "Type help if you need anything.",
    );
    return;
  }

  let unit = match[2]
    ? match[2].toUpperCase().replace("/", "/")
    : rawValue < 30
      ? "mmol/L"
      : "mg/dL";
  if (unit === "MG/DL") unit = "mg/dL";

  // Guard against menu keystrokes and typos landing in the health record.
  // Anything outside a survivable range is far more likely a mis-key than a reading.
  if (unit === "mmol/L") {
    if (rawValue < 0.5 || rawValue > 40) {
      await sendNotAReading(senderPhone);
      return;
    }
  } else if (rawValue < 15 || rawValue > 700) {
    await sendNotAReading(senderPhone);
    return;
  }


  const hasExplicitTiming = Boolean(match[3]);
  const rawTiming = (match[3] || "Random").toLowerCase();
  let timing: GlucoseTiming = "Random";
  if (rawTiming.includes("fast")) {
    timing = "Fasting";
  } else if (
    rawTiming.includes("pp") ||
    rawTiming.includes("post") ||
    rawTiming.includes("after")
  ) {
    timing = "Post-Prandial";
  }

  const now = new Date();
  const limitCheck = await checkGlucoseDailyLimit(uid, now);

  if (!limitCheck.allowed) {
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ You have reached the daily limit of 10 glucose readings for today.",
    );
    return;
  }

  const readingId = crypto.randomUUID();
  const { dateStr, timeStr } = getFormattedUserTime(senderPhone, now);

  const batch = db.batch();
  batch.set(limitCheck.limitsRef, limitCheck.limitUpdate, { merge: true });
  batch.set(db.doc(`users/${uid}/glucoseReadings/${readingId}`), {
    id: readingId,
    value: rawValue,
    unit,
    timing,
    source: "Manual",
    date: dateStr,
    time: timeStr,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (!hasExplicitTiming) {
    // Store pending timing selection state so buttons can tag timing
    batch.set(db.doc(`whatsapp_pending_glucose/${senderPhone}`), {
      uid,
      readingId,
      value: rawValue,
      unit,
      date: dateStr,
      time: timeStr,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  if (!hasExplicitTiming) {
    await sendTimingPrompt(senderPhone, `${rawValue} ${unit}`);
  } else {
    let displayTiming = timing === "Post-Prandial" ? "post-meal" : timing.toLowerCase();
    const magicUrl = await createWhatsAppMagicLoginUrl(uid);
    await sendWhatsAppCtaUrl(
      senderPhone,
      `Got it. I have logged ${rawValue} ${unit} as a ${displayTiming} reading.\n` +
      `Your health profile is up to date.\n\n` +
      `Type help if you need anything.`,
      "View health profile",
      magicUrl,
    );
  }
}

/**
 * Attempts glucometer OCR on an image buffer and prompts for meal timing if successful.
 */
export async function handleGlucometerImage(
  uid: string,
  senderPhone: string,
  buffer: Buffer,
  mimeType: string,
): Promise<boolean> {
  const base64Data = buffer.toString("base64");
  try {
    const result = await extractGlucoseFromBase64(base64Data, mimeType);

    if (result.success && result.value) {
      const now = new Date();
      const limitCheck = await checkGlucoseDailyLimit(uid, now);

      if (!limitCheck.allowed) {
        await sendWhatsAppMessage(
          senderPhone,
          "⚠️ You have reached the daily limit of 10 glucose readings for today.",
        );
        return true;
      }

      const db = getAdminFirestore();
      const readingId = crypto.randomUUID();
      const { dateStr: fallbackDate, timeStr: fallbackTime } =
        getFormattedUserTime(senderPhone, now);
      const dateStr = result.readingDate || fallbackDate;
      const timeStr = result.readingTime || fallbackTime;

      const batch = db.batch();
      batch.set(limitCheck.limitsRef, limitCheck.limitUpdate, { merge: true });
      batch.set(db.doc(`users/${uid}/glucoseReadings/${readingId}`), {
        id: readingId,
        value: result.value,
        unit: result.unit || "mg/dL",
        timing: "Random", // Default until user selects
        source: "OCR",
        date: dateStr,
        time: timeStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Store pending timing selection state
      batch.set(db.doc(`whatsapp_pending_glucose/${senderPhone}`), {
        uid,
        readingId,
        value: result.value,
        unit: result.unit || "mg/dL",
        date: dateStr,
        time: timeStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      await sendTimingPrompt(senderPhone, `${result.value} ${result.unit || "mg/dL"}`);
      return true;
    }
  } catch {
    // OCR failed or threw; allow caller to handle fallback
  }

  return false;
}
