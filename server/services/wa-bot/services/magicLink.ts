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

/**
 * Single source of truth for the dashboard URL.
 *
 * Every CTA the bot sends is a magic login link built on top of this base.
 * Never hand this plain URL to a user directly — use
 * `createWhatsAppMagicLoginUrl(uid)` or `getMagicLoginUrlForPhone(phone)` so
 * the tap auto-authenticates them.
 *
 * APP_URL must be set on the server. FRONTEND_URL is accepted as a fallback,
 * but APP_URL wins so there is one name to configure.
 */
export const getDashboardUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "https://app.bluepin.in").replace(
    /\/+$/,
    "",
  );

/**
 * Resolves a magic login link for a WhatsApp recipient phone number.
 *
 * Every CTA the bot sends must use this (not the plain dashboard URL) so the
 * tap auto-authenticates the user. Falls back to the plain dashboard URL when
 * the phone is not linked to any account or link creation fails — the CTA
 * still lands on the right host, just without auto-login.
 */
export async function getMagicLoginUrlForPhone(
  phone: string,
): Promise<string> {
  try {
    const db = getAdminFirestore();
    const snap = await db.doc(`whatsapp_users/${phone}`).get();
    const uid = snap.data()?.uid as string | undefined;
    if (!uid) return getDashboardUrl();
    return createWhatsAppMagicLoginUrl(uid);
  } catch (err) {
    console.error(
      "[wa-bot] Error resolving magic login url for phone, falling back to static dashboard url:",
      err,
    );
    return getDashboardUrl();
  }
}
 
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
