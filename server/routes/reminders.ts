import { Router } from "express";
import crypto from "crypto";
import { getAdminFirestore, requireAuth } from "../firebase";
import { getVapidKeys } from "../vapid";
import { sendPush, type PushPayload } from "../services/pushService";

const router = Router();

const hashEndpoint = (endpoint: string) =>
  crypto.createHash("sha256").update(endpoint).digest("hex");

function isPushSubscription(sub: any): sub is { endpoint: string; keys: { p256dh: string; auth: string } } {
  return (
    !!sub &&
    typeof sub.endpoint === "string" &&
    !!sub.keys &&
    typeof sub.keys.p256dh === "string" &&
    typeof sub.keys.auth === "string"
  );
}

// Public VAPID key used by the browser to subscribe to push.
router.get("/reminders/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getVapidKeys().publicKey });
});

// Save a push subscription for the signed-in user.
router.post("/reminders/subscribe", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { subscription } = req.body as { subscription?: any };
    if (!isPushSubscription(subscription)) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }
    const db = getAdminFirestore();
    await db
      .collection("pushSubscriptions")
      .doc(hashEndpoint(subscription.endpoint))
      .set(
        {
          userId,
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          createdAt: new Date().toISOString(),
          userAgent: req.headers["user-agent"] || null,
        },
        { merge: true },
      );
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[push] subscribe failed:", err?.message || err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Remove a push subscription for the signed-in user.
router.post("/reminders/unsubscribe", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    const db = getAdminFirestore();
    const ref = db.collection("pushSubscriptions").doc(hashEndpoint(endpoint));
    const snap = await ref.get();
    if (snap.exists && snap.data()?.userId === userId) {
      await ref.delete();
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[push] unsubscribe failed:", err?.message || err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Send a one-off test notification (debugging / onboarding).
router.post("/reminders/test", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const db = getAdminFirestore();
    const snap = await db
      .collection("pushSubscriptions")
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) {
      return res.status(400).json({ error: "No push subscription found. Enable notifications first." });
    }
    const sub = snap.docs[0].data();
    const payload: PushPayload = {
      title: "Glucose reminders are on",
      body: "This is a test. You'll be notified at your scheduled reminder times.",
      url: "/?tab=glucose",
      tag: "glucose-reminder-setup",
      requireInteraction: false,
    };
    const result = await sendPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      payload,
    );
    if (!result.ok && snap.docs[0].ref) {
      await snap.docs[0].ref.delete();
    }
    res.json({ ok: result.ok });
  } catch (err: any) {
    console.error("[push] test failed:", err?.message || err);
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

export default router;