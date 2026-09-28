import { Router } from "express";
import express from "express";
import { requireAuth } from "../firebase";
import {
  sendWhatsAppMessage,
  sendWhatsAppOtp,
  createWhatsAppLinkCode,
  unlinkWhatsAppAccount,
  processIncomingWhatsAppMessage,
  verifyMetaSignature,
} from "../services/whatsappService";
import { getAdminFirestore, getAdminAuth } from "../firebase";

const router = Router();

// ─── 1. Webhook Verification (Meta GET Challenge) ──────────────────────────────
router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "bluepin_webhook_secret";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[WhatsApp] Webhook successfully verified with Meta challenge.");
    return res.status(200).send(challenge);
  }

  console.warn("[WhatsApp] Webhook verification failed. Invalid verify token or mode.", { mode, token });
  return res.sendStatus(403);
});

// ─── 2. Webhook Ingestion (Meta POST Events) ───────────────────────────────────
router.post(
  "/whatsapp/webhook",
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  async (req: any, res) => {
    // 1. Signature Verification (if WHATSAPP_APP_SECRET is set)
    const sigHeader = req.headers["x-hub-signature-256"] as string | undefined;
    if (req.rawBody && process.env.WHATSAPP_APP_SECRET) {
      const isValid = verifyMetaSignature(req.rawBody, sigHeader);
      if (!isValid) {
        console.warn("[WhatsApp Webhook] Invalid X-Hub-Signature-256 rejected.", { sigHeader });
        return res.status(401).send("Invalid signature");
      }
    }

    // 2. Respond 200 OK immediately to acknowledge receipt to Meta within 3 seconds
    res.status(200).send("EVENT_RECEIVED");

    // 3. Process events in the background
    const body = req.body;
    console.log("[WhatsApp Webhook] Received payload object:", body?.object);

    if (!body || body.object !== "whatsapp_business_account") {
      console.warn("[WhatsApp Webhook] Ignored non-whatsapp_business_account object:", body?.object);
      return;
    }

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;

          const messages = change.value?.messages || [];
          for (const message of messages) {
            // Process message asynchronously
            processIncomingWhatsAppMessage(message).catch((err) => {
              console.error("[WhatsApp] Unhandled error processing message:", err);
            });
          }
        }
      }
    } catch (err) {
      console.error("[WhatsApp] Error parsing webhook payload:", err);
    }
  }
);

// ─── 3. In-App WhatsApp Link: Send OTP ─────────────────────────────────────────
router.post("/whatsapp/link/send-otp", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const { phone } = req.body || {};
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "WhatsApp phone number is required." });
    }

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
    }

    const cleanPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;
    const db = getAdminFirestore();

    // Check if phone number is already linked to another active account
    const existingSnap = await db.doc(`whatsapp_users/${cleanDigits}`).get();
    if (existingSnap.exists) {
      const existingUid = existingSnap.data()?.uid;
      if (existingUid && existingUid !== uid) {
        const authAdmin = getAdminAuth();
        let isActive = true;
        try {
          await authAdmin.getUser(existingUid);
        } catch (e: any) {
          if (e.code === "auth/user-not-found") {
            isActive = false;
            await db.doc(`whatsapp_users/${cleanDigits}`).delete();
          }
        }
        if (isActive) {
          return res.status(409).json({
            error: "This WhatsApp number is already linked to another Bluepin account. Please log in with that account or unlink it first.",
          });
        }
      }
    }

    // Rate limiting: 30 seconds cooldown
    const otpRef = db.doc(`whatsapp_sync_otps/${uid}`);
    const otpSnap = await otpRef.get();
    if (otpSnap.exists) {
      const lastSentAt = otpSnap.data()?.lastSentAt || 0;
      const cooldown = 30 - Math.floor((Date.now() - lastSentAt) / 1000);
      if (cooldown > 0) {
        return res.status(429).json({
          error: `Please wait ${cooldown}s before requesting a new code.`,
          retryAfter: cooldown,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Dispatch via WhatsApp Meta API
    const sendRes = await sendWhatsAppOtp(cleanPhone, otp);
    if (!sendRes.success) {
      return res.status(502).json({
        error: sendRes.error || "Failed to deliver WhatsApp message. Please check number and try again.",
      });
    }

    await otpRef.set({
      uid,
      phone: cleanDigits,
      fullPhone: cleanPhone,
      otp,
      attempts: 0,
      expiresAt,
      lastSentAt: Date.now(),
    });

    return res.json({
      success: true,
      message: "Verification code sent to your WhatsApp.",
      expiresIn: 300,
    });
  } catch (err: any) {
    console.error("[WhatsApp Sync] send-otp error:", err);
    return res.status(500).json({ error: "Failed to send verification code." });
  }
});

// ─── 4. In-App WhatsApp Link: Verify OTP ───────────────────────────────────────
router.post("/whatsapp/link/verify-otp", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone number and 6-digit OTP are required." });
    }

    const cleanDigits = String(phone).replace(/\D/g, "");
    const cleanOtp = String(otp).trim();
    const cleanPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;

    const db = getAdminFirestore();
    const otpRef = db.doc(`whatsapp_sync_otps/${uid}`);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return res.status(400).json({ error: "No active verification code found. Please request a new code." });
    }

    const data = otpSnap.data()!;
    if (Date.now() > data.expiresAt) {
      await otpRef.delete();
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    if (data.attempts >= 5) {
      await otpRef.delete();
      return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    }

    if (data.otp !== cleanOtp || data.phone !== cleanDigits) {
      await otpRef.update({ attempts: (data.attempts || 0) + 1 });
      const remaining = 5 - ((data.attempts || 0) + 1);
      return res.status(400).json({ error: `Incorrect code. ${remaining} attempt(s) remaining.` });
    }

    // Code is valid! Delete OTP record
    await otpRef.delete();

    // Link in Firestore
    const batch = db.batch();
    batch.set(
      db.doc(`whatsapp_users/${cleanDigits}`),
      {
        uid,
        phone: cleanDigits,
        linkedAt: Date.now(),
      },
      { merge: true },
    );
    batch.set(
      db.doc(`users/${uid}`),
      {
        whatsappPhone: cleanDigits,
        phoneNumber: cleanPhone,
      },
      { merge: true },
    );
    await batch.commit();

    // Sync phone on Firebase Auth user record if empty
    try {
      const authAdmin = getAdminAuth();
      const user = await authAdmin.getUser(uid);
      if (!user.phoneNumber) {
        await authAdmin.updateUser(uid, { phoneNumber: cleanPhone });
      }
    } catch {
      // Ignored if phone already claimed on another auth record
    }
    // Send welcome confirmation message on WhatsApp in background
    sendWhatsAppMessage(
      cleanPhone,
      "Hi, I am Aarika from Bluepin. 🙏\n" +
      "I will be your WhatsApp companion for managing your diabetes, right here every day.\n\n" +
      "Here is what I can help you with:\n" +
      "- Log glucose\n" +
      "Send me a reading or a photo of your glucometer.\n\n" +
      "- Upload health report\n" +
      "Send me your health reports and I will add them to your health profile.\n\n" +
      "- Set a reminder\n" +
      "Choose when you would like me to remind you to log your glucose.\n\n" +
      "- View health profile\n" +
      "See your health history, trends and personalised insights.\n\n" +
      "Type help if you need anything.",
    ).catch(() => {});

    return res.json({
      success: true,
      phone: cleanDigits,
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
    // Direct WhatsApp chat link with prefilled message
    const deepLink = botPhone ? `https://wa.me/${botPhone.replace(/[^0-9]/g, "")}?text=LINK%20${code}` : null;

    return res.json({
      success: true,
      code,
      expiresIn,
      botPhone,
      deepLink,
    });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to create link code:", error);
    return res.status(500).json({ error: "Failed to create linking code." });
  }
});

// ─── 4. Check WhatsApp Status for Current User ─────────────────────────────────
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

// ─── 5. Unlink WhatsApp Account ────────────────────────────────────────────────
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

// ─── 6. Exchange WhatsApp Magic Token for Firebase Custom Token ───────────────
router.post("/whatsapp/exchange-token", async (req: any, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing token" });
    }

    const db = getAdminFirestore();
    const tokenRef = db.doc(`whatsapp_magic_tokens/${token}`);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const data = tokenSnap.data()!;
    if (data.used) {
      return res.status(400).json({ error: "Token already used" });
    }

    const expiresAt = data.expiresAt ? data.expiresAt.toDate() : null;
    if (expiresAt && expiresAt < new Date()) {
      await tokenRef.delete();
      return res.status(400).json({ error: "Token expired" });
    }

    // Delete used token to prevent replay
    await tokenRef.delete();

    // Generate Firebase Custom Token
    const authAdmin = getAdminAuth();
    const customToken = await authAdmin.createCustomToken(data.uid);

    return res.json({
      success: true,
      customToken,
    });
  } catch (error: any) {
    console.error("[WhatsApp] Failed to exchange magic token:", error);
    return res.status(500).json({ error: "Failed to exchange magic token" });
  }
});

export default router;
