import { postMessage } from "../sender";

export const footerText = "Type help if you need anything.";

/** Sends a plain text message to a user. */
export async function sendTextMessage(to: string, body: string): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body },
  });
}
