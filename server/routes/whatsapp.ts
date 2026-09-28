import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../firebase";
import {
  sendWhatsAppOtp,
  createWhatsAppLinkCode,
  unlinkWhatsAppAccount,
  processIncomingWhatsAppMessage,
  verifyMetaSignature,
  sendWhatsAppMainMenu,
  normalizePhone,
  maskPhone,
  getPhoneNumberId,
} from "../services/whatsappService";
import { getAdminFirestore, getAdminAuth } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { generateNumericCode, hashOtp, verifyOtpHash } from "../services/whatsapp/utils";
import { MAGIC_TOKEN_PATTERN } from "../services/whatsapp/auth";
import { MetaWebhookBody } from "../services/whatsapp/types";

const router = Router();

const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const PHONE_OTP_HOURLY_LIMIT = 5;
const LINKED_PHONE_UNAVAILABLE =
  "This WhatsApp number cannot be linked right now. Please try again later.";

/**
 * Per-IP guard on the outbound-message endpoints. These routes are mounted
 * ahead of the global limiter, so they need their own protection against a
 * single host driving Meta spend across many accounts.
 */
const linkOtpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification code requests from this network. Please try again later." },
});

const exchangeTokenIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token exchange attempts. Please try again later." },
});

/**
 * Rejects a phone number that is already bound to a different, live account.
 * Returns true when the number was already linked to somebody else.
 */
async function isPhoneLinkedToAnotherAccount(
  canonicalPhone: string,
  uid: string,
): Promise<boolean> {
  const db = getAdminFirestore();
  const snap = await db.doc(`whatsapp_users/${canonicalPhone}`).get();
  if (!snap.exists) return false;

  const existingUid = snap.data()?.uid;
  if (!existingUid || existingUid === uid) return false;

  try {
    await getAdminAuth().getUser(existingUid);
    return true;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      // Orphaned mapping from a deleted account; safe to reclaim.
      await snap.ref.delete();
      return false;
    }
    throw err;
  }
}

/**
 * Rate limits OTP sends per destination number so one account cannot spam
 * arbitrary phone numbers and damage the Meta quality rating.
 */
async function checkPhoneOtpQuota(canonicalPhone: string): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.doc(`whatsapp_otp_quota/${canonicalPhone}`);
  const hourAgo = Date.now() - 60 * 60 * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : {};
    const recent = Array.isArray(data.sentAt)
      ? (data.sentAt as number[]).filter((t) => t > hourAgo)
      : [];

    if (recent.length >= PHONE_OTP_HOURLY_LIMIT) return false;

    tx.set(ref, { sentAt: [...recent, Date.now()] }, { merge: true });
    return true;
  });
}

// ─── 1. Webhook Verification (Meta GET Challenge) ──────────────────────────────
router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken && process.env.NODE_ENV === "production") {
    console.error("[WhatsApp] WHATSAPP_VERIFY_TOKEN is not set; cannot verify webhook.");
    return res.sendStatus(503);
  }

  const activeToken = expectedToken ?? "bluepin_webhook_secret";

  if (mode === "subscribe" && token === activeToken) {
    console.log("[WhatsApp] Webhook successfully verified with Meta challenge.");
    return res.status(200).send(challenge);
  }

  // Never echo the presented token back into logs.
  console.warn("[WhatsApp Webhook] Verification failed.", { mode, tokenProvided: Boolean(token) });
  return res.sendStatus(403);
});

// ─── 2. Webhook Ingestion (Meta POST Events) ───────────────────────────────────
router.post(
  "/whatsapp/webhook",
  express.json({
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  async (req: any, res) => {
    const sigHeader = req.headers["x-hub-signature-256"] as string | undefined;

    if (!req.rawBody) {
      console.error(
        "[WhatsApp Webhook] rawBody missing; signature cannot be verified. " +
          "Ensure no express.json() runs before this router.",
      );
      return res.status(400).send("Missing raw body");
    }

    const isValid = verifyMetaSignature(req.rawBody, sigHeader);
    if (!isValid) {
      console.warn("[WhatsApp Webhook] Rejected payload with invalid X-Hub-Signature-256.");
      return res.status(401).send("Invalid signature");
    }

    // Acknowledge receipt to Meta promptly, then process in the background.
    res.status(200).send("EVENT_RECEIVED");

    const body = req.body as MetaWebhookBody | undefined;

    if (!body || body.object !== "whatsapp_business_account") {
      console.warn("[WhatsApp Webhook] Ignored non-whatsapp_business_account object:", body?.object);
      return;
    }

    try {
      const expectedPhoneId = getPhoneNumberId();

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== "messages") continue;

          // Ignore traffic addressed to a different WhatsApp Business number
          // sharing this webhook.
          const receivedPhoneId = change.value?.metadata?.phone_number_id;
          if (expectedPhoneId && receivedPhoneId && receivedPhoneId !== expectedPhoneId) {
            console.warn("[WhatsApp Webhook] Ignored message for a different phone_number_id.", {
              receivedPhoneId,
            });
            continue;
          }

          for (const message of change.value?.messages || []) {
            processIncomingWhatsAppMessage(message).catch((err) => {
              console.error("[WhatsApp] Unhandled error processing message:", err);
            });
          }
        }
      }
    } catch (err) {
      console.error("[WhatsApp] Error parsing webhook payload:", err);
    }
  },
);

// ─── 3. In-App WhatsApp Link: Send OTP ─────────────────────────────────────────
router.post(
  "/whatsapp/link/send-otp",
  requireAuth,
  linkOtpIpLimiter,
  async (req: any, res) => {
    try {
      const uid = req.user.uid;
      const { phone } = req.body || {};
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ error: "WhatsApp phone number is required." });
      }

      const canonicalPhone = normalizePhone(phone);
      if (!canonicalPhone) {
        return res.status(400).json({
          error: "Please enter a valid mobile number with its country code.",
        });
      }

      const db = getAdminFirestore();

      if (await isPhoneLinkedToAnotherAccount(canonicalPhone, uid)) {
        return res.status(409).json({ error: LINKED_PHONE_UNAVAILABLE });
      }

      if (!(await checkPhoneOtpQuota(canonicalPhone))) {
        return res.status(429).json({
          error: "Too many verification codes requested for this number. Please try again later.",
        });
      }

      // Resend cooldown is tracked per account.
      const otpRef = db.doc(`whatsapp_sync_otps/${uid}`);
      const otpSnap = await otpRef.get();
      if (otpSnap.exists) {
        const lastSentAt = Number(otpSnap.data()?.lastSentAt || 0);
        const cooldown =
          OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - lastSentAt) / 1000);
        if (cooldown > 0) {
          return res.status(429).json({
            error: `Please wait ${cooldown}s before requesting a new code.`,
            retryAfter: cooldown,
          });
        }
      }

      const otp = generateNumericCode(6);
      const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;

      const sendRes = await sendWhatsAppOtp(canonicalPhone, otp);
      if (!sendRes.success) {
        return res.status(502).json({
          error:
            sendRes.error || "Failed to deliver WhatsApp message. Please check number and try again.",
        });
      }

      await otpRef.set({
        uid,
        phone: canonicalPhone,
        // Stored as an HMAC so a Firestore dump yields no usable codes.
        otpHash: hashOtp(otp, canonicalPhone),
        attempts: 0,
        expiresAt,
        lastSentAt: Date.now(),
      });

      console.log("[WhatsApp Sync] OTP dispatched.", {
        uid,
        phone: maskPhone(canonicalPhone),
      });

      return res.json({
        success: true,
        message: "Verification code sent to your WhatsApp.",
        expiresIn: OTP_TTL_SECONDS,
      });
    } catch (err: any) {
      console.error("[WhatsApp Sync] send-otp error:", err);
      return res.status(500).json({ error: "Failed to send verification code." });
    }
  },
);

// ─── 4. In-App WhatsApp Link: Verify OTP ───────────────────────────────────────
router.post("/whatsapp/link/verify-otp", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone number and 6-digit OTP are required." });
    }

    const canonicalPhone = normalizePhone(phone);
    if (!canonicalPhone) {
      return res.status(400).json({ error: "Invalid mobile number format." });
    }
    const cleanOtp = String(otp).trim();

    const db = getAdminFirestore();

    if (await isPhoneLinkedToAnotherAccount(canonicalPhone, uid)) {
      return res.status(409).json({ error: LINKED_PHONE_UNAVAILABLE });
    }

    const otpRef = db.doc(`whatsapp_sync_otps/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const mappingRef = db.doc(`whatsapp_users/${canonicalPhone}`);

    type VerifyOutcome =
      | { status: "ok" }
      | { status: "error"; code: number; error: string; remaining?: number };

    // One transaction so the attempt counter cannot be raced, the ownership
    // check cannot be raced, and the mappings are written together.
    // Reads are issued sequentially: Firestore requires all reads before writes.
    const outcome = await db.runTransaction(async (tx): Promise<VerifyOutcome> => {
      const otpSnap = await tx.get(otpRef);
      const userSnap = await tx.get(userRef);
      const mappingSnap = await tx.get(mappingRef);

      if (!otpSnap.exists) {
        return {
          status: "error",
          code: 400,
          error: "No active verification code found. Please request a new code.",
        };
      }

      const data = otpSnap.data()!;

      if (Date.now() > Number(data.expiresAt || 0)) {
        tx.delete(otpRef);
        return {
          status: "error",
          code: 400,
          error: "Verification code has expired. Please request a new code.",
        };
      }

      const attempts = Number(data.attempts || 0);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        tx.delete(otpRef);
        return {
          status: "error",
          code: 429,
          error: "Too many incorrect attempts. Please request a new code.",
        };
      }

      const matches =
        data.phone === canonicalPhone &&
        verifyOtpHash(cleanOtp, canonicalPhone, String(data.otpHash || ""));

      if (!matches) {
        const nextAttempts = attempts + 1;
        tx.update(otpRef, { attempts: nextAttempts });
        return {
          status: "error",
          code: 400,
          error: `Incorrect code. ${OTP_MAX_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
          remaining: OTP_MAX_ATTEMPTS - nextAttempts,
        };
      }

      // Ownership was re-checked above and the write below is guarded by this
      // read, so a number claimed by another account is never overwritten.
      const existingUid = mappingSnap.exists ? mappingSnap.data()?.uid : undefined;
      if (existingUid && existingUid !== uid) {
        return { status: "error", code: 409, error: LINKED_PHONE_UNAVAILABLE };
      }

      tx.delete(otpRef);

      // If this account previously linked a different number, remove that
      // mapping so the old number can no longer act as this user.
      const previousPhone = userSnap.exists ? userSnap.data()?.whatsappPhone : undefined;
      if (previousPhone && previousPhone !== canonicalPhone) {
        tx.delete(db.doc(`whatsapp_users/${previousPhone}`));
        tx.delete(db.doc(`whatsapp_reminders/${previousPhone}`));
        tx.delete(db.doc(`whatsapp_pending_glucose/${previousPhone}`));
      }

      tx.set(
        mappingRef,
        { uid, phone: canonicalPhone, linkedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      tx.set(
        userRef,
        { whatsappPhone: canonicalPhone, phoneNumber: `+${canonicalPhone}` },
        { merge: true },
      );

      return { status: "ok" };
    });

    if (outcome.status === "error") {
      return res.status(outcome.code).json({ error: outcome.error });
    }

    // Sync phone on the Firebase Auth record if it is not already claimed.
    try {
      const authAdmin = getAdminAuth();
      const user = await authAdmin.getUser(uid);
      if (!user.phoneNumber) {
        await authAdmin.updateUser(uid, { phoneNumber: `+${canonicalPhone}` });
      }
    } catch {
      // Ignored when the phone is already claimed on another auth record.
    }

    sendWhatsAppMainMenu(canonicalPhone, "welcome").catch(() => {});

    return res.json({
      success: true,
      phone: canonicalPhone,
      message: "WhatsApp successfully connected to your account!",
    });
  } catch (err: any) {
    console.error("[WhatsApp Sync] verify-otp error:", err);
    return res.status(500).json({ error: "Failed to verify code and link account." });
  }
});

// ─── 5. Generate Link Code (Option A Fallback) ──────────────────────────────────
router.post("/whatsapp/link-code", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const { code, expiresIn } = await createWhatsAppLinkCode(uid);

    const botPhone = process.env.WHATSAPP_BUSINESS_PHONE || "";
    const deepLink = botPhone
      ? `https://wa.me/${botPhone.replace(/[^0-9]/g, "")}?text=LINK%20${code}`
      : null;

    return res.json({ success: true, code, expiresIn, botPhone, deepLink });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to create link code:", error);
    return res.status(500).json({ error: "Failed to create linking code." });
  }
});

// ─── 6. Check WhatsApp Status for Current User ─────────────────────────────────
router.get("/whatsapp/status", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const db = getAdminFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    const phone = userDoc.data()?.whatsappPhone || null;

    return res.json({
      linked: !!phone,
      phone,
      botPhone: process.env.WHATSAPP_BUSINESS_PHONE || null,
    });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to fetch status:", error);
    return res.status(500).json({ error: "Failed to fetch WhatsApp status." });
  }
});

// ─── 7. Unlink WhatsApp Account ────────────────────────────────────────────────
router.post("/whatsapp/unlink", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    await unlinkWhatsAppAccount(uid);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to unlink account:", error);
    return res.status(500).json({ error: "Failed to unlink WhatsApp account." });
  }
});

// ─── 8. Exchange WhatsApp Magic Token for Firebase Custom Token ───────────────
router.post("/whatsapp/exchange-token", exchangeTokenIpLimiter, async (req: any, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string" || !MAGIC_TOKEN_PATTERN.test(token)) {
      return res.status(400).json({ error: "Missing or malformed token" });
    }

    const db = getAdminFirestore();
    const tokenRef = db.doc(`whatsapp_magic_tokens/${token}`);

    // Consume the token atomically so concurrent requests cannot both mint a
    // session from a single link.
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) return { ok: false as const };

      const expiresAt = snap.data()?.expiresAt?.toDate?.() ?? null;
      tx.delete(tokenRef);

      if (expiresAt && expiresAt.getTime() < Date.now()) {
        return { ok: false as const };
      }

      return { ok: true as const, uid: snap.data()!.uid as string };
    });

    if (!result.ok) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const customToken = await getAdminAuth().createCustomToken(result.uid);
    return res.json({ success: true, customToken });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to exchange magic token:", error);
    return res.status(500).json({ error: "Failed to exchange magic token" });
  }
});

export default router;
