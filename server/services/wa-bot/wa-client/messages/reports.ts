import { postMessage } from "../sender";

/**
 * Sent when a medical report is successfully extracted and saved.
 * Displays a CTA button linking to the user's dashboard.
 */
export async function sendReportAcceptedCta(to: string, magicUrl: string, replyToMessageId?: string): Promise<Response> {
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      header: {
        type: "text",
        text: "Health Report Accepted"
      },
      body: {
        text: "Got it, I have your health report. I will add it to your health profile.",
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "View health profile",
          url: magicUrl,
        },
      },
      footer: { text: "Type help if you need anything." },
    },
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  return postMessage(payload);
}

/**
 * Sent when the AI cannot extract valid biomarkers from the uploaded document.
 */
export async function sendInvalidReportMessage(to: string, replyToMessageId?: string): Promise<Response> {
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: "*Invalid Health Report*\nI could not process that report. 🤔\nSend me a PDF health report under 5 MB and I will take it from there.\n\nType help if you need anything."
    }
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  return postMessage(payload);
}
