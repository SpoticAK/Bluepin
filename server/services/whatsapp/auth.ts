import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminAuth } from "../../firebase";
import { LinkAccountResult } from "./types";
import { generateNumericCode } from "./utils";
import { normalizePhone, maskPhone } from "./client";
import { getDashboardUrl } from "../wa-bot/services/magicLink";

// Re-exported so this module keeps its historical public surface. The
// definition lives in wa-bot so every CTA the bot sends resolves the same host.
export { getDashboardUrl };

const MAGIC_TOKEN_TTL_MINUTES = Number(process.env.WHATSAPP_MAGIC_TOKEN_TTL_MINUTES) || 30;
const MAGIC_TOKEN_HEX_BYTES = 24;

/** Magic login tokens are hex, so reject anything that could alter a doc path. */
export const MAGIC_TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${MAGIC_TOKEN_HEX_BYTES * 2}}$`);

const LINK_CODE_TTL_SECONDS = 10 * 60;
const LINK_CODE_MAX_ATTEMPTS = 5;
const LINK_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Generates a single-use magic login link for a user's dashboard.
 * When tapped, it automatically authenticates the user into Bluepin.
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
  const code = generateNumericCode(6);

  await db.doc(`whatsapp_links/${code}`).set({
    uid,
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + LINK_CODE_TTL_SECONDS * 1000,
  });

  return { code, expiresIn: LINK_CODE_TTL_SECONDS };
}

/**
 * Returns true when the sender has exhausted their link-code attempts in the
 * current window. Resets the window once it has elapsed.
 */
async function isLinkCodeLockedOut(senderPhone: string): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.doc(`whatsapp_link_attempts/${senderPhone}`);
  const snap = await ref.get();
  const now = Date.now();
  const data = snap.data();

  if (!data) return false;

  const windowStart = Number(data.windowStart || 0);
  if (now - windowStart > LINK_CODE_ATTEMPT_WINDOW_MS) {
    await ref.delete();
    return false;
  }

  return Number(data.attempts || 0) >= LINK_CODE_MAX_ATTEMPTS;
}

async function recordFailedLinkAttempt(senderPhone: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.doc(`whatsapp_link_attempts/${senderPhone}`);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : {};
    const windowStart = Number(data.windowStart || 0);
    const expired = now - windowStart > LINK_CODE_ATTEMPT_WINDOW_MS;

    tx.set(
      ref,
      {
        attempts: expired ? 1 : Number(data.attempts || 0) + 1,
        windowStart: expired ? now : windowStart,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * Attempts to link a WhatsApp sender phone number with a Bluepin account via 6-digit code.
 */
export async function linkWhatsAppAccount(
  rawSenderPhone: string,
  code: string,
): Promise<LinkAccountResult> {
  const db = getAdminFirestore();
  const senderPhone = normalizePhone(rawSenderPhone);

  if (!senderPhone) {
    return {
      success: false,
      message:
        "⚠️ I could not read your number. Please try linking again from your Bluepin dashboard.",
    };
  }

  if (await isLinkCodeLockedOut(senderPhone)) {
    return {
      success: false,
      message:
        "⚠️ Too many incorrect link codes. Please wait 15 minutes and generate a new code in your Bluepin dashboard.",
    };
  }

  const cleanCode = code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      success: false,
      message:
        "⚠️ Link code is invalid. Please generate a new code in your Bluepin dashboard under Settings > WhatsApp Sync.",
    };
  }

  const linkRef = db.doc(`whatsapp_links/${cleanCode}`);
  const snap = await linkRef.get();

  if (!snap.exists) {
    await recordFailedLinkAttempt(senderPhone);
    return {
      success: false,
      message:
        "⚠️ Link code is invalid. Please generate a new code in your Bluepin dashboard under Settings > WhatsApp Sync.",
    };
  }

  const data = snap.data()!;
  const uid = data.uid;

  if (Date.now() > Number(data.expiresAt || 0)) {
    await linkRef.delete();
    return {
      success: false,
      message:
        "⚠️ This link code has expired. Please generate a fresh code in your Bluepin dashboard.",
    };
  }

  // Check if this WhatsApp number is already linked to another account
  const existingMapping = await db.doc(`whatsapp_users/${senderPhone}`).get();
  if (existingMapping.exists) {
    const existingUid = existingMapping.data()?.uid;
    if (existingUid && existingUid !== uid) {
      const authAdmin = getAdminAuth();
      let accountActive = true;
      try {
        await authAdmin.getUser(existingUid);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          accountActive = false;
        }
      }

      if (accountActive) {
        return {
          success: false,
          message:
            "⚠️ This WhatsApp number is already linked to another Bluepin account. Please log in with that account or unlink it first.",
        };
      }
    }
  }

  // If this uid previously linked a different number, drop the stale mapping so
  // the old number can no longer act as this account.
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const previousPhone = userSnap.data()?.whatsappPhone;

  const batch = db.batch();
  batch.set(db.doc(`whatsapp_users/${senderPhone}`), {
    uid,
    phone: senderPhone,
    linkedAt: FieldValue.serverTimestamp(),
  });

  batch.set(userRef, { whatsappPhone: senderPhone }, { merge: true });

  if (previousPhone && previousPhone !== senderPhone) {
    batch.delete(db.doc(`whatsapp_users/${previousPhone}`));
    batch.delete(db.doc(`whatsapp_reminders/${previousPhone}`));
    batch.delete(db.doc(`whatsapp_pending_glucose/${previousPhone}`));
  }

  // Remove used code and reset attempt counter
  batch.delete(linkRef);
  batch.delete(db.doc(`whatsapp_link_attempts/${senderPhone}`));

  await batch.commit();

  console.log("[WhatsApp] Account linked:", { uid, phone: maskPhone(senderPhone) });

  return {
    success: true,
    uid,
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
    // Reminders are keyed by phone number. Leaving them behind would keep
    // messaging a number that may since have been recycled.
    batch.delete(db.doc(`whatsapp_users/${phone}`));
    batch.delete(db.doc(`whatsapp_reminders/${phone}`));
    batch.delete(db.doc(`whatsapp_pending_glucose/${phone}`));
  }
  await batch.commit();
  return true;
}
