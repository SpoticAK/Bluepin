import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../firebase";
import { LinkAccountResult } from "./types";

export const getDashboardUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "https://app.bluepin.in").replace(
    /\/+$/,
    "",
  );

/**
 * Generates a single-use 24-hour magic login link for a user's dashboard.
 * When tapped, it automatically authenticates the user into Bluepin.
 */
export async function createWhatsAppMagicLoginUrl(
  uid: string,
): Promise<string> {
  try {
    const db = getAdminFirestore();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.doc(`whatsapp_magic_tokens/${token}`).set({
      uid,
      expiresAt,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const base = getDashboardUrl();
    return `${base}?wa_t=${token}`;
  } catch (err) {
    console.error(
      "[WhatsApp] Error creating magic login url, falling back to static dashboard url:",
      err,
    );
    return getDashboardUrl();
  }
}

/**
 * Generates a 6-digit linking code for an authenticated Bluepin user.
 */
export async function createWhatsAppLinkCode(
  uid: string,
): Promise<{ code: string; expiresIn: number }> {
  const db = getAdminFirestore();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInSeconds = 10 * 60; // 10 minutes
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  await db.doc(`whatsapp_links/${code}`).set({
    uid,
    code,
    createdAt: Date.now(),
    expiresAt,
  });

  return { code, expiresIn: expiresInSeconds };
}

/**
 * Attempts to link a WhatsApp sender phone number with a Bluepin account via 6-digit code.
 */
export async function linkWhatsAppAccount(
  senderPhone: string,
  code: string,
): Promise<LinkAccountResult> {
  const db = getAdminFirestore();
  const cleanCode = code.trim();
  const linkRef = db.doc(`whatsapp_links/${cleanCode}`);
  const snap = await linkRef.get();

  if (!snap.exists) {
    return {
      success: false,
      message:
        "⚠️ Link code is invalid. Please generate a new code in your Bluepin dashboard under Settings > WhatsApp Sync.",
    };
  }

  const data = snap.data()!;
  if (Date.now() > data.expiresAt) {
    await linkRef.delete();
    return {
      success: false,
      message:
        "⚠️ This link code has expired. Please generate a fresh code in your Bluepin dashboard.",
    };
  }

  const uid = data.uid;

  const batch = db.batch();
  // Store mapping: phone -> uid
  batch.set(db.doc(`whatsapp_users/${senderPhone}`), {
    uid,
    phone: senderPhone,
    linkedAt: Date.now(),
  });

  // Store mapping in user's profile
  batch.update(db.doc(`users/${uid}`), {
    whatsappPhone: senderPhone,
  });

  // Remove used code
  batch.delete(linkRef);

  await batch.commit();

  return {
    success: true,
    uid,
    message:
      "🎉 *Account successfully linked!*\n\nWelcome to Bluepin WhatsApp Sync. You can now:\n" +
      "• 🩸 *Log glucose:* Reply with readings like `115 Fasting`, `140 PP`, or `95`\n" +
      "• 📸 *Glucometer photo:* Send a photo of your meter screen to log automatically\n" +
      "• 📄 *Medical reports:* Send PDF or image lab reports to analyze biomarkers\n\n" +
      "Send *HELP* anytime for quick commands.",
  };
}

/**
 * Unlinks WhatsApp from a user account.
 */
export async function unlinkWhatsAppAccount(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return false;
  const phone = userSnap.data()?.whatsappPhone;

  const batch = db.batch();
  batch.update(userRef, { whatsappPhone: FieldValue.delete() });
  if (phone) {
    batch.delete(db.doc(`whatsapp_users/${phone}`));
  }
  await batch.commit();
  return true;
}
