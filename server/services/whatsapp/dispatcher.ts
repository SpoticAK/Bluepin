import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../firebase";
import {
  sendWhatsAppMessage,
  sendWhatsAppCtaUrl,
  downloadWhatsAppMedia,
  sendWhatsAppButtons,
  sendWhatsAppMainMenu,
  maskPhone,
} from "./client";
import {
  linkWhatsAppAccount,
  createWhatsAppMagicLoginUrl,
} from "./auth";
import {
  handleTimingSelection,
  handleTextGlucoseLogging,
  handleGlucometerImage,
  timingFromPosition,
  timingFromButtonId,
} from "./handlers/glucose";
import {
  handleDocumentReport,
  processMedicalReportBuffer,
} from "./handlers/reports";
import { MetaMessageObject, MetaMediaObject, GlucoseTiming } from "./types";

const db = () => getAdminFirestore();

/**
 * Handles incoming images by discerning between medical reports and glucometer photos.
 */
async function handleImageMessage(
  uid: string,
  senderPhone: string,
  imageObj: MetaMediaObject,
): Promise<void> {
  const mediaId = imageObj.id;
  const caption = (imageObj.caption || "").toLowerCase();

  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);

  // If the user explicitly captioned the image as a report/lab test.
  // Word boundaries prevent "label", "latest" and "contest" from matching.
  if (/\b(report|lab|test|prescription)\b/i.test(caption)) {
    await processMedicalReportBuffer(
      uid,
      senderPhone,
      buffer,
      mimeType,
      "Lab Report Photo",
    );
    return;
  }

  // Attempt glucometer OCR first
  const handledAsGlucose = await handleGlucometerImage(
    uid,
    senderPhone,
    buffer,
    mimeType,
  );
  if (handledAsGlucose) {
    return;
  }

  // Fallback: Check if photo was an uncaptioned lab report
  const reportHandled = await processMedicalReportBuffer(
    uid,
    senderPhone,
    buffer,
    mimeType,
    "Lab Report Photo",
    true,
  );

  if (!reportHandled) {
    await sendWhatsAppMessage(
      senderPhone,
      "I could not find a glucose reading in that. 🤔\n" +
        "Send me the number, like 126, or a photo of your glucometer and I will take it from there.\n\n" +
        "Type help if you need anything.",
    );
  }
}

const REMINDER_PROMPTS: Record<
  string,
  { display: string; hour: number; title: string }
> = {
  remind_morning: { display: "8:00 AM", hour: 8, title: "Morning (8 AM)" },
  remind_afternoon: { display: "1:00 PM", hour: 13, title: "Afternoon (1 PM)" },
  remind_evening: { display: "8:00 PM", hour: 20, title: "Evening (8 PM)" },
};

/** Keys the user can reply with when the interactive buttons are unavailable. */
const REMINDER_REPLY_WORDS: Record<string, string | undefined> = Object.assign(
  Object.create(null),
  {
    morning: "remind_morning",
    afternoon: "remind_afternoon",
    evening: "remind_evening",
    night: "remind_evening",
  },
);

/**
 * Sends the reminder time picker and remembers that it is awaiting an answer,
 * so a bare "1"/"2"/"3" reply can be resolved to the right slot.
 */
async function sendReminderPrompt(senderPhone: string): Promise<void> {
  const promptText =
    "When would you like me to remind you to log your glucose?\n" +
    "Choose a time below and I will remember it for you.\n\n" +
    "Type help if you need anything.";

  await db().doc(`whatsapp_pending_reminder/${senderPhone}`).set({
    createdAt: FieldValue.serverTimestamp(),
  });

  await sendWhatsAppButtons(
    senderPhone,
    promptText,
    Object.entries(REMINDER_PROMPTS).map(([id, cfg]) => ({
      id,
      title: cfg.title,
    })),
  );
}

/**
 * Persists a chosen reminder slot. Returns false for unknown button ids rather
 * than silently defaulting to the morning slot.
 */
async function setReminder(
  uid: string,
  senderPhone: string,
  buttonId: string,
): Promise<boolean> {
  const config = REMINDER_PROMPTS[buttonId];
  if (!config) return false;

  const batch = db().batch();
  batch.set(
    db().doc(`whatsapp_reminders/${senderPhone}`),
    {
      uid,
      phone: senderPhone,
      reminderHour: config.hour,
      timezone: "Asia/Kolkata",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.delete(db().doc(`whatsapp_pending_reminder/${senderPhone}`));
  await batch.commit();

  await sendWhatsAppMessage(
    senderPhone,
    `Done. I will remind you at ${config.display} each day.\n` +
      `I will be here when you are ready to log your reading.\n\n` +
      `Type help if you need anything.`,
  );
  return true;
}

const PROCESSED_MARKER_TTL_HOURS = 24;

/**
 * Returns true when the message id was already processed, meaning this is a
 * Meta retry and must be ignored.
 */
async function alreadyProcessed(messageId: string): Promise<boolean> {
  const ref = db().doc(`whatsapp_processed/${messageId}`);
  try {
    await ref.create({
      processedAt: FieldValue.serverTimestamp(),
      // Eligible for a Firestore TTL policy to keep the collection bounded.
      expireAt: new Date(Date.now() + PROCESSED_MARKER_TTL_HOURS * 60 * 60 * 1000),
    });
    return false;
  } catch (err: any) {
    // Firestore error code 6 == ALREADY_EXISTS
    if (err?.code === 6) return true;
    throw err;
  }
}

/**
 * Main handler and dispatcher for incoming WhatsApp webhook messages.
 */
export async function processIncomingWhatsAppMessage(
  message: MetaMessageObject,
): Promise<void> {
  const senderPhone = (message.from || "").replace(/[^0-9]/g, "");
  const messageType = message.type;

  console.log(
    `[WhatsApp] Received message type '${messageType}' from ${maskPhone(senderPhone)}`,
  );

  // Set once the idempotency marker is claimed, so a failure can release it
  // and let Meta's retry reprocess the message.
  let claimedMessageId: string | null = null;

  try {
    // Meta retries deliveries on any non-2xx or timeout. Drop duplicates so a
    // reading or report is never logged twice.
    if (message.id) {
      if (await alreadyProcessed(message.id)) {
        console.log(`[WhatsApp] Duplicate delivery ${message.id} ignored.`);
        return;
      }
      claimedMessageId = message.id;
    }

    // 1. Check for LINK command (e.g. "LINK 123456", "CONNECT 123456", or just "123456")
    if (messageType === "text") {
      const rawText = (message.text?.body || "").trim();
      const linkMatch = rawText.match(
        /^(?:(?:link|connect)\s*[:=]?\s*)?(\d{6})$/i,
      );
      if (linkMatch) {
        const code = linkMatch[1];
        const result = await linkWhatsAppAccount(senderPhone, code);
        if (result.success && result.uid) {
          const magicUrl = await createWhatsAppMagicLoginUrl(result.uid);
          await sendWhatsAppCtaUrl(
            senderPhone,
            result.message ?? "Your WhatsApp is now linked to Bluepin.",
            "Open Dashboard",
            magicUrl,
          );
        } else {
          await sendWhatsAppMessage(
            senderPhone,
            result.message ?? "Sorry, we could not link your WhatsApp.",
          );
        }
        return;
      }

      const lowerText = rawText.toLowerCase();

      if (lowerText === "help") {
        await sendWhatsAppMainMenu(senderPhone, "help");
        await sendWhatsAppMessage(
          senderPhone,
          "_Need to speak to someone?_\n" +
            "Email sparsh@bluepin.in and we will get back to you within 24 hours.",
        );
        return;
      }

      // Only an explicit request should open the reminder flow. Matching on
      // "remind" anywhere would hijack messages such as "126 fasting, remind me
      // tomorrow" and swallow the reading.
      if (/^(?:please\s+|pls\s+|can\s+you\s+|could\s+you\s+)?(?:set\s+|create\s+|add\s+)?remind(?:er|ers|ing)?\b/.test(lowerText)) {
        await sendReminderPrompt(senderPhone);
        return;
      }
    }

    // 2. Identify linked user by phone
    const userDoc = await db().doc(`whatsapp_users/${senderPhone}`).get();
    if (!userDoc.exists) {
      await sendWhatsAppMainMenu(senderPhone, "welcome");
      return;
    }

    const uid = userDoc.data()!.uid;

    // 3. Handle Message Types
    if (messageType === "interactive") {
      const btnId =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id ||
        "";
      const btnTitle =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "";

      const timingChoice =
        timingFromButtonId(btnId) ||
        (/fast/i.test(btnTitle)
          ? "Fasting"
          : /post|pp|prandial/i.test(btnTitle)
            ? "Post-Prandial"
            : /random/i.test(btnTitle)
              ? "Random"
              : null);

      if (timingChoice) {
        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      if (btnId.startsWith("remind_")) {
        if (await setReminder(uid, senderPhone, btnId)) return;
      }

      if (btnId === "menu_log_glucose") {
        await sendWhatsAppMessage(
          senderPhone,
          "Send me your glucose reading (e.g., `120 Fasting`) or a photo of your glucometer.",
        );
        return;
      }
      if (btnId === "menu_upload_report") {
        await sendWhatsAppMessage(
          senderPhone,
          "Send me a PDF health report (under 5 MB) or a clear photo of your lab test.",
        );
        return;
      }
      if (btnId === "menu_set_reminder") {
        await sendReminderPrompt(senderPhone);
        return;
      }
      if (btnId === "menu_view_profile") {
        const magicUrl = await createWhatsAppMagicLoginUrl(uid);
        await sendWhatsAppCtaUrl(
          senderPhone,
          "Here is your secure link to view your health profile, trends, and personalised insights.",
          "View health profile",
          magicUrl,
        );
        return;
      }

      await sendWhatsAppMessage(
        senderPhone,
        "ℹ️ This option has already been recorded or expired. Send a new reading or meter photo anytime!",
      );
      return;
    } else if (messageType === "text") {
      const rawText = (message.text?.body || "").trim();
      const lowerText = rawText.toLowerCase();

      // Resolve a pending prompt before falling through to glucose parsing.
      const pendingReminder =
        (await db().doc(`whatsapp_pending_reminder/${senderPhone}`).get()).exists;

      if (pendingReminder) {
        const position = Number(rawText);
        const slotId =
          (Number.isInteger(position) && position >= 1 && position <= 3
            ? Object.keys(REMINDER_PROMPTS)[position - 1]
            : undefined) ??
          REMINDER_REPLY_WORDS[lowerText];

        if (slotId) {
          if (await setReminder(uid, senderPhone, slotId)) return;
        } else {
          await sendReminderPrompt(senderPhone);
          return;
        }
      }

      // Meal-timing selection by keyword, or by position matching the buttons.
      let timingChoice: GlucoseTiming | null = null;
      if (/^(fasting|fast|pp|post-?prandial|post-?meal|after-?meal|random)$/.test(lowerText)) {
        timingChoice =
          lowerText === "fasting" || lowerText === "fast"
            ? "Fasting"
            : lowerText === "random"
              ? "Random"
              : "Post-Prandial";
      } else if (/^[123]$/.test(rawText)) {
        const pendingGlucose = (
          await db().doc(`whatsapp_pending_glucose/${senderPhone}`).get()
        ).exists;
        // A bare digit only means a timing choice while a reading is awaiting one.
        // Otherwise it is far more likely a mistyped reading than a menu answer.
        if (pendingGlucose) {
          timingChoice = timingFromPosition(Number(rawText));
        } else {
          await sendWhatsAppMainMenu(senderPhone, "fallback");
          return;
        }
      }

      if (timingChoice) {
        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      if (/\d/.test(rawText)) {
        await handleTextGlucoseLogging(uid, senderPhone, rawText);
      } else {
        await sendWhatsAppMainMenu(senderPhone, "fallback");
      }
    } else if (messageType === "image") {
      if (message.image) await handleImageMessage(uid, senderPhone, message.image);
    } else if (messageType === "document") {
      if (message.document) await handleDocumentReport(uid, senderPhone, message.document);
    } else {
      await sendWhatsAppMainMenu(senderPhone, "fallback");
    }
  } catch (err: any) {
    console.error("[WhatsApp] Error processing message:", err);

    // Release the marker so Meta's retry can attempt the message again.
    if (claimedMessageId) {
      try {
        await db().doc(`whatsapp_processed/${claimedMessageId}`).delete();
      } catch (cleanupErr) {
        console.error("[WhatsApp] Failed to release idempotency marker:", cleanupErr);
      }
    }

    try {
      await sendWhatsAppMessage(
        senderPhone,
        "⚠️ An error occurred while processing your request. Please try again or check your Bluepin dashboard.",
      );
    } catch {
      // Sending the failure notice is best-effort.
    }
  }
}
