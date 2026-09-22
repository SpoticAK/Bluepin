import { getAdminFirestore } from "../../firebase";
import {
  sendWhatsAppMessage,
  sendWhatsAppCtaUrl,
  downloadWhatsAppMedia,
} from "./client";
import {
  linkWhatsAppAccount,
  createWhatsAppMagicLoginUrl,
} from "./auth";
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
      "⚠️ Could not detect a clear glucose number or medical report from this photo.\n\n" +
        "Tip: Ensure the meter display is in focus and well lit, or type your reading directly (e.g. `115 Fasting`).",
    );
  }
}

/**
 * Main handler and dispatcher for incoming WhatsApp webhook messages.
 */
export async function processIncomingWhatsAppMessage(message: any): Promise<void> {
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
      await sendWhatsAppMessage(
        senderPhone,
        "📋 *Bluepin WhatsApp Guide*\n\n" +
          "• *Log Glucose:* Send `110 Fasting`, `145 PP`, or `98`\n" +
          "• *Photo of Meter:* Send a clear photo of your glucometer\n" +
          "• *Lab Reports:* Send a PDF document or lab photo\n" +
          "• *Link Account:* Send `LINK <6-digit code>`\n\n" +
          "Access your web dashboard at https://bluepin.in",
      );
      return;
    }
  }

  // 2. Identify linked user by phone
  const userDoc = await db.doc(`whatsapp_users/${senderPhone}`).get();
  if (!userDoc.exists) {
    await sendWhatsAppMessage(
      senderPhone,
      "👋 Welcome to *Bluepin*! Your WhatsApp is not connected to an account yet.\n\n" +
        "1. Open your Bluepin dashboard on web\n" +
        "2. Click your profile icon > *WhatsApp Sync*\n" +
        "3. Copy the 6-digit code and reply here with: `LINK <code>` (or just send the 6-digit code)",
    );
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

      await handleTextGlucoseLogging(uid, senderPhone, rawText);
    } else if (messageType === "image") {
      await handleImageMessage(uid, senderPhone, message.image);
    } else if (messageType === "document") {
      await handleDocumentReport(uid, senderPhone, message.document);
    } else {
      await sendWhatsAppMessage(
        senderPhone,
        "ℹ️ Bluepin supports text readings (e.g. `120 Fasting`), glucometer photos, and medical report PDFs.",
      );
    }
  } catch (err: any) {
    console.error("[WhatsApp] Error processing message:", err);
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ An error occurred while processing your request. Please try again or check your Bluepin dashboard.",
    );
  }
}
