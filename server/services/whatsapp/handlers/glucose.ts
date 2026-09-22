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
import { GlucoseTiming } from "../types";

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
  await sendWhatsAppCtaUrl(
    senderPhone,
    `✅ *Timing Updated to ${timingChoice}!* 🩸\n\n` +
      `• *Reading:* ${value} ${unit}\n` +
      `• *Timing:* ${timingChoice}\n` +
      `• *Time:* ${time}`,
    "Open Dashboard",
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
    await sendWhatsAppMessage(
      senderPhone,
      "🤔 I didn't recognize that reading format.\n\nTry sending: `120 Fasting`, `145 PP`, or just `110`. Send `HELP` for more options.",
    );
    return;
  }

  const rawValue = parseFloat(match[1]);
  if (isNaN(rawValue) || rawValue <= 0 || rawValue > 1000) {
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ Please enter a valid glucose number between 20 and 800.",
    );
    return;
  }

  let unit = match[2]
    ? match[2].toUpperCase().replace("/", "/")
    : rawValue < 30
      ? "mmol/L"
      : "mg/dL";
  if (unit === "MG/DL") unit = "mg/dL";

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

  await batch.commit();

  const magicUrl = await createWhatsAppMagicLoginUrl(uid);
  await sendWhatsAppCtaUrl(
    senderPhone,
    `✅ *Glucose Logged Successfully!*\n\n` +
      `• *Reading:* ${rawValue} ${unit}\n` +
      `• *Timing:* ${timing}\n` +
      `• *Logged:* Today at ${timeStr}`,
    "Open Dashboard",
    magicUrl,
  );
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

      const promptText =
        `📸 *Glucometer Reading Extracted: ${result.value} ${result.unit || "mg/dL"}*\n` +
        `• *Detected Time:* ${dateStr} ${timeStr}\n\n` +
        `How long after eating or drinking was this reading taken?`;

      await sendWhatsAppButtons(senderPhone, promptText, [
        { id: "timing_pp", title: "Post-Meal (<2h)" },
        { id: "timing_random", title: "Random (2–8h)" },
        { id: "timing_fasting", title: "Fasting (>8h)" },
      ]);
      return true;
    }
  } catch {
    // OCR failed or threw; allow caller to handle fallback
  }

  return false;
}
