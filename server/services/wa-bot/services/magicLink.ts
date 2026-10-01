import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";

/**
 * Single-use dashboard login links handed to users over WhatsApp.
 *
 * Self-contained — no dependency on the legacy server/services/whatsapp module.
 */

const MAGIC_TOKEN_TTL_MINUTES = Number(process.env.WHATSAPP_MAGIC_TOKEN_TTL_MINUTES) || 30;
const MAGIC_TOKEN_HEX_BYTES = 24;

/**
 * Magic login tokens are hex, so reject anything that could alter a doc path.
 * The exchange endpoint validates against this, so the two must stay in sync.
 */
export const MAGIC_TOKEN_PATTERN = new RegExp(
  `^[0-9a-f]{${MAGIC_TOKEN_HEX_BYTES * 2}}$`,
);

export const getDashboardUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "https://app.bluepin.in").replace(
    /\/+$/,
    "",
  );

/**
 * Generates a single-use magic login link for a user's dashboard.
 * When tapped, it automatically authenticates the user into Bluepin.
 *
 * Falls back to the plain dashboard URL rather than failing the surrounding
 * user journey — a report was still saved even if the link could not be made.
 */
export async function createWhatsAppMagicLoginUrl(
  uid: string,
): Promise<string> {
  try {
    const db = getAdminFirestore();
    const token = crypto.randomBytes(MAGIC_TOKEN_HEX_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MINUTES * 60 * 1000);

    await db.doc(`whatsapp_magic_tokens/${token}`).set({
      uid,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    const base = getDashboardUrl();
    return `${base}?wa_t=${token}`;
  } catch (err) {
    console.error(
      "[wa-bot] Error creating magic login url, falling back to static dashboard url:",
      err,
    );
    return getDashboardUrl();
  }
}
