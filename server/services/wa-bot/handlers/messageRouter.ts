import type { WAMessage } from "../types";
import {
  handleGlucoseText,
  handleGlucoseTimingReply,
  extractGlucoseValue,
} from "./glucoseHandler";
import { handleGlucometerImage } from "./imageHandler";
import { handleMedicalDocUpload } from "./documentHandler";
import {
  handleReminderPrompt,
  handleReminderSelection,
} from "./reminderHandler";
import { getUidByPhone } from "../services/glucoseService";
import { claimMessageId, releaseMessageId } from "../services/idempotency";
import {
  sendTextMessage,
  sendInitialGreeting,
  sendHelpMessage,
  sendUnknownInputMessage,
  sendViewHealthProfileCta,
} from "../wa-client";

const GLUCOSE_TIMING_IDS = new Set(["fasting", "random", "post-prandial"]);

/**
 * Logs the inbound media object once per message.
 *
 * Meta's Media guide says webhook media carries `url`; its Messages webhook
 * field reference does not list it. Logging the raw object settles which one is
 * true for this app from real traffic, and shows up in logs either way.
 */
function logIncomingMedia(
  kind: "image" | "document",
  media: Record<string, unknown>,
): void {
  console.log(
    `[router] inbound ${kind} media payload: ${JSON.stringify(media)}`,
  );
}

/**
 * Entry point for every inbound message. Claims the message id up front so a
 * Meta redelivery cannot write the same reading twice.
 */
export async function routeMessage(message: WAMessage): Promise<void> {
  if (message.id && !(await claimMessageId(message.id))) {
    console.log(`[router] Dropping duplicate delivery of ${message.id}`);
    return;
  }

  try {
    await dispatch(message);
  } catch (err) {
    // Release the claim so Meta's retry gets a chance to reprocess.
    if (message.id) await releaseMessageId(message.id);
    throw err;
  }
}

/**
 * Routes an incoming WhatsApp message to the correct feature handler.
 * Add new features here — don't touch index.ts.
 */
async function dispatch(message: WAMessage): Promise<void> {
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

    // Unrecognized text (including "hi", "menu", etc.)
    // Check if they are an existing linked user
    const uid = await getUidByPhone(from);
    if (uid) {
      return void (await sendUnknownInputMessage(from));
    } else {
      return void (await sendInitialGreeting(from));
    }
  }

  // --- Interactive replies ---
  if (type === "interactive") {
    // Glucose timing buttons (Fasting / Random / Post meal)
    const buttonId = message.interactive.button_reply?.id;
    if (buttonId && GLUCOSE_TIMING_IDS.has(buttonId)) {
      return handleGlucoseTimingReply(from, buttonId);
    }

    // List selections — main menu AND reminder time picker
    const listId = message.interactive.list_reply?.id;
    if (listId) {
      if (listId.startsWith("remind_")) {
        return handleReminderSelection(from, listId);
      }
      return handleMenuSelection(from, listId);
    }

    // A button we do not recognise, or a Flow completion. Logged so an
    // unhandled reply is visible instead of vanishing.
    console.warn(
      `[router] Unhandled interactive reply type '${message.interactive.type}' from ${from}`,
    );
    return;
  }

  // --- Image (glucometer photo) ---
  if (type === "image") {
    logIncomingMedia("image", message.image);
    return handleGlucometerImage(from, message.image.id, {
      url: message.image.url,
      mimeType: message.image.mime_type,
      sha256: message.image.sha256,
    });
  }

  // --- Document (medical reports) ---
  if (type === "document") {
    const { id, filename, mime_type, file_size } = message.document;
    logIncomingMedia("document", message.document);
    return handleMedicalDocUpload(
      from,
      id,
      filename ?? "Lab_Report.pdf",
      file_size,
      mime_type,
      message.id,
      {
        url: message.document.url,
        mimeType: mime_type,
        sha256: message.document.sha256,
      },
    );
  }
}

/**
 * Handles a selection from the interactive list menu.
 * Each id maps to a feature entry point.
 */
async function handleMenuSelection(
  from: string,
  listId: string,
): Promise<void> {
  switch (listId) {
    case "log_glucose":
      await sendTextMessage(
        from,
        "Sure! Send me your glucose reading as a number (e.g. 126) or a photo of your glucometer.",
      );
      break;
    case "upload_report":
      await sendTextMessage(
        from,
        "Send me your health report as a PDF and I will add it to your profile.",
      );
      break;
    case "set_reminder":
      await handleReminderPrompt(from);
      break;
    case "view_profile":
      await sendViewHealthProfileCta(from);
      break;
    default:
      await sendTextMessage(
        from,
        "Sorry, I didn't recognise that option. Type *help* to see the menu.",
      );
  }
}
