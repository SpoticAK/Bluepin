import { linkWhatsAppAccount } from "../../whatsapp/auth";
import { sendInitialGreeting, sendTextMessage } from "../wa-client";

/**
 * Every failure branch of linkWhatsAppAccount supplies its own explanation, so
 * this is unreachable in practice and exists only to keep `message` optional.
 */
const UNEXPECTED_FAILURE =
  "Sorry, we could not link your WhatsApp right now. Please try again.";

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

  if (!result.success) {
    // The sender phone is deliberately omitted: a failed attempt is usually a
    // mistyped or expired code, and there is nothing to learn from who sent it.
    console.warn(`[linkHandler] Link attempt rejected: ${result.message}`);
    await sendTextMessage(sender, result.message ?? UNEXPECTED_FAILURE);
    return;
  }

  // A newly linked number has seen nothing of the bot, so it gets the same
  // interactive greeting an app signup sends. Keeping the feature list in one
  // place stops it drifting out of step with the live menu again.
  await sendInitialGreeting(sender);
}