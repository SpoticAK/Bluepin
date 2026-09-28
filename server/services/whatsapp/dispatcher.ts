import { getAdminFirestore } from "../../firebase";
import {
  sendWhatsAppMessage,
  sendWhatsAppCtaUrl,
  downloadWhatsAppMedia,
  sendWhatsAppButtons,
  sendWhatsAppMainMenu,
} from "./client";
import { linkWhatsAppAccount, createWhatsAppMagicLoginUrl } from "./auth";
import {
  handleTimingSelection,
  handleTextGlucoseLogging,
  handleGlucometerImage,
} from "./handlers/glucose";
import {
  handleDocumentReport,
  processMedicalReportBuffer,
} from "./handlers/reports";
import { GlucoseTiming } from "./types";

/**
 * Handles incoming images by discerning between medical reports and glucometer photos.
 */
async function handleImageMessage(
  uid: string,
  senderPhone: string,
  imageObj: any,
): Promise<void> {
  const mediaId = imageObj.id;
  const caption = (imageObj.caption || "").toLowerCase();

  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);

  // If user explicitly captioned the image as a report/lab test
  if (
    caption.includes("report") ||
    caption.includes("lab") ||
    caption.includes("test")
  ) {
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

/**
 * Main handler and dispatcher for incoming WhatsApp webhook messages.
 */
export async function processIncomingWhatsAppMessage(
  message: any,
): Promise<void> {
  const senderPhone = (message.from || "").replace(/[^0-9]/g, "");
  const messageType = message.type;
  const db = getAdminFirestore();

  console.log(
    `[WhatsApp] Received message type '${messageType}' from ${senderPhone}`,
  );

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
          result.message,
          "Open Dashboard",
          magicUrl,
        );
      } else {
        await sendWhatsAppMessage(senderPhone, result.message);
      }
      return;
    }

    if (rawText.toLowerCase() === "help") {
      await sendWhatsAppMainMenu(senderPhone, "help");
      // Send the email string in a separate text.
      await sendWhatsAppMessage(
        senderPhone,
        "_Need to speak to someone?_\n" +
          "Email sparsh@bluepin.in and we will get back to you within 24 hours.",
      );
      return;
    }

    if (rawText.toLowerCase().includes("remind")) {
      const promptText =
        "When would you like me to remind you to log your glucose?\n" +
        "Choose a time below and I will remember it for you.\n\n" +
        "Type help if you need anything.";

      await sendWhatsAppButtons(senderPhone, promptText, [
        { id: "remind_morning", title: "Morning (8 AM)" },
        { id: "remind_afternoon", title: "Afternoon (1 PM)" },
        { id: "remind_evening", title: "Evening (8 PM)" },
      ]);
      return;
    }
  }

  // 2. Identify linked user by phone
  const userDoc = await db.doc(`whatsapp_users/${senderPhone}`).get();
  if (!userDoc.exists) {
    await sendWhatsAppMainMenu(senderPhone, "welcome");
    return;
  }

  const uid = userDoc.data()!.uid;

  // 3. Handle Message Types
  try {
    if (messageType === "interactive") {
      const btnId =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id ||
        "";
      const btnTitle =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "";

      let timingChoice: GlucoseTiming | null = null;
      if (btnId === "timing_fasting" || /fast/i.test(btnTitle)) {
        timingChoice = "Fasting";
      } else if (btnId === "timing_pp" || /post|pp|prandial/i.test(btnTitle)) {
        timingChoice = "Post-Prandial";
      } else if (btnId === "timing_random" || /random/i.test(btnTitle)) {
        timingChoice = "Random";
      }

      if (timingChoice) {
        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      if (btnId.startsWith("remind_")) {
        const hourMap: Record<string, { display: string; hour: number }> = {
          remind_morning: { display: "8:00 AM", hour: 8 },
          remind_afternoon: { display: "1:00 PM", hour: 13 },
          remind_evening: { display: "8:00 PM", hour: 20 },
        };
        const config = hourMap[btnId] || hourMap["remind_morning"];

        await db.doc(`whatsapp_reminders/${senderPhone}`).set({
          uid,
          phone: senderPhone,
          reminderHour: config.hour,
          timezone: "Asia/Kolkata",
          updatedAt: new Date(),
        });

        await sendWhatsAppMessage(
          senderPhone,
          `Done. I will remind you at ${config.display} each day.\n` +
            `I will be here when you are ready to log your reading.\n\n` +
            `Type help if you need anything.`,
        );
        return;
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
        const promptText =
          "When would you like me to remind you to log your glucose?\n" +
          "Choose a time below and I will remember it for you.\n\n" +
          "Type help if you need anything.";

        await sendWhatsAppButtons(senderPhone, promptText, [
          { id: "remind_morning", title: "Morning (8 AM)" },
          { id: "remind_afternoon", title: "Afternoon (1 PM)" },
          { id: "remind_evening", title: "Evening (8 PM)" },
        ]);
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

      // Check if user answered a pending timing prompt via text (e.g., "1", "2", "3", "fasting", "pp", "random")
      const timingMatch = rawText.match(
        /^(?:1|2|3|fasting|fast|pp|post-?prandial|post-?meal|after-?meal|random)$/i,
      );
      if (timingMatch) {
        const lower = rawText.toLowerCase();
        let timingChoice: GlucoseTiming = "Random";
        if (lower === "1" || lower.includes("fast")) {
          timingChoice = "Fasting";
        } else if (
          lower === "2" ||
          lower.includes("pp") ||
          lower.includes("post") ||
          lower.includes("after")
        ) {
          timingChoice = "Post-Prandial";
        } else if (lower === "3" || lower.includes("random")) {
          timingChoice = "Random";
        }

        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      if (/\d/.test(rawText)) {
        await handleTextGlucoseLogging(uid, senderPhone, rawText);
      } else {
        await sendWhatsAppMainMenu(senderPhone, "fallback");
      }
    } else if (messageType === "image") {
      await handleImageMessage(uid, senderPhone, message.image);
    } else if (messageType === "document") {
      await handleDocumentReport(uid, senderPhone, message.document);
    } else {
      await sendWhatsAppMainMenu(senderPhone, "fallback");
    }
  } catch (err: any) {
    console.error("[WhatsApp] Error processing message:", err);
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ An error occurred while processing your request. Please try again or check your Bluepin dashboard.",
    );
  }
}
