import { Router } from "express";
import express from "express";
import { requireAuth } from "../firebase";
import {
  sendWhatsAppMessage,
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

// ─── 3. Generate Link Code (Option A) ───────────────────────────────────────────
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
