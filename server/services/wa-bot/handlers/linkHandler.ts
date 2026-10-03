import { linkWhatsAppAccount } from "../../whatsapp/auth";
import { sendTextMessage } from "../wa-client";

/**
 * Handles "LINK 482913" from a user who generated a code in the app.
 *
 * The router guarantees `code` is exactly six digits before calling. That value
 * can never be a glucose reading — the bot caps those at 800 — so a link attempt
 * is never ambiguous with the glucose flow.
 *
 * All validation (lockout, expiry, ownership conflicts) belongs to
 * linkWhatsAppAccount, which also owns the Firestore writes. This handler only
 * adapts its result to the WhatsApp reply.
 */
export async function handleLinkCode(
  sender: string,
  code: string,
): Promise<void> {
  const result = await linkWhatsAppAccount(sender, code);

  // The sender phone is deliberately omitted: a failed attempt is usually a
  // mistyped or expired code, and there is nothing to learn from who sent it.
  if (!result.success) {
    console.warn(`[linkHandler] Link attempt rejected: ${result.message}`);
  }

  await sendTextMessage(sender, result.message);
}