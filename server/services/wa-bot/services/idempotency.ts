import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";

const PROCESSED_MARKER_TTL_HOURS = 24;

/**
 * Attempts to claim a message id for processing.
 *
 * Meta redelivers a webhook payload whenever it fails to see a 2xx in time, so
 * the same message can arrive twice. Without a claim, a duplicated tap on the
 * "Fasting" button logs a second glucose reading into the user's health record.
 *
 * Returns true when this is the first delivery and the caller owns processing.
 * Returns false when the id was already claimed and the caller must drop it.
 */
export async function claimMessageId(messageId: string): Promise<boolean> {
  const ref = getAdminFirestore().doc(`whatsapp_processed/${messageId}`);

  try {
    await ref.create({
      processedAt: FieldValue.serverTimestamp(),
      // Eligible for a Firestore TTL policy to keep the collection bounded.
      expireAt: new Date(Date.now() + PROCESSED_MARKER_TTL_HOURS * 60 * 60 * 1000),
    });
    return true;
  } catch (err: any) {
    // gRPC code 6 == ALREADY_EXISTS. The admin SDK surfaces the string form on
    // some runtimes, so accept either.
    const alreadyExists = err?.code === 6 || err?.code === "already-exists";
    if (alreadyExists) return false;
    throw err;
  }
}

/**
 * Releases a claim so Meta's retry can reprocess the message.
 * Call this only when processing failed — otherwise the message is dropped
 * permanently.
 */
export async function releaseMessageId(messageId: string): Promise<void> {
  try {
    await getAdminFirestore().doc(`whatsapp_processed/${messageId}`).delete();
  } catch (err) {
    console.error(`[idempotency] Failed to release claim for ${messageId}:`, err);
  }
}
