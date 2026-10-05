import { postMessage } from "../sender";

export const footerText = "Type help if you need anything.";

/** Sends a plain text message to a user. */
export async function sendTextMessage(
  to: string, 
  body: string,
  replyToMessageId?: string
): Promise<Response> {
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body },
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  return postMessage(payload);
}
