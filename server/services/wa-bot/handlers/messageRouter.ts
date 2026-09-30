import type { WAMessage } from "../types";
import { handleGlucoseText, handleGlucoseTimingReply, extractGlucoseValue } from "./glucoseHandler";
import { handleGlucometerImage } from "./imageHandler";
import { handleMedicalDocUpload } from "./documentHandler";
import {
  sendTextMessage,
  sendHelpMessage,
  sendUnknownInputMessage,
  sendViewHealthProfileCta,
} from "../wa-client";

const GLUCOSE_TIMING_IDS = new Set(["fasting", "random", "post-prandial"]);

/**
 * Routes an incoming WhatsApp message to the correct feature handler.
 * Add new features here — don't touch index.ts.
 */
export async function routeMessage(message: WAMessage): Promise<void> {
  const { from, type } = message;

  // --- Text messages ---
  if (type === "text") {
    const text = message.text.body.trim().toLowerCase();

    // Check if the user's text contains a likely glucose number
    const extractedNum = extractGlucoseValue(text);
    if (extractedNum !== null) {
      return handleGlucoseText(from, extractedNum);
    }

    if (text === "help") {
      return void (await sendHelpMessage(from));
    }

    // TODO: if (text === "login") return authHandler.startOtp(from);
    // TODO: if (text.startsWith("remind")) return reminderHandler.startFlow(from, text);

    // Any other text — show the default menu
    return void (await sendUnknownInputMessage(from));
  }

  // --- Interactive replies ---
  if (type === "interactive") {
    // Glucose timing buttons (Fasting / Random / Post meal)
    const buttonId = message.interactive.button_reply?.id;
    if (buttonId && GLUCOSE_TIMING_IDS.has(buttonId)) {
      return handleGlucoseTimingReply(from, buttonId);
    }

    // Main menu list selections
    const listId = message.interactive.list_reply?.id;
    if (listId) {
      return handleMenuSelection(from, listId);
    }

    return;
  }

  // --- Image (glucometer photo) ---
  if (type === "image") {
    return handleGlucometerImage(from, message.image.id);
  }

  // --- Document (medical reports) ---
  if (type === "document") {
    const { id, filename, mime_type, file_size } = message.document;
    return handleMedicalDocUpload(from, id, filename ?? "Lab_Report.pdf", file_size, mime_type);
  }
}

/**
 * Handles a selection from the interactive list menu.
 * Each id maps to a feature entry point.
 */
async function handleMenuSelection(from: string, listId: string): Promise<void> {
  switch (listId) {
    case "log_glucose":
      await sendTextMessage(
        from,
        "Sure! Send me your glucose reading as a number (e.g. 126) or a photo of your glucometer. 📲",
      );
      break;
    case "upload_report":
      // TODO: documentHandler.promptUpload(from);
      await sendTextMessage(from, "📄 Send me your health report as a PDF and I will add it to your profile.");
      break;
    case "set_reminder":
      // TODO: reminderHandler.startFlow(from);
      await sendTextMessage(from, "⏰ Reminder setup is coming soon! Stay tuned.");
      break;
    case "view_profile":
      await sendViewHealthProfileCta(from);
      break;
    default:
      await sendTextMessage(from, "Sorry, I didn't recognise that option. Type *help* to see the menu.");
  }
}
