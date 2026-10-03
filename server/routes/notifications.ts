import { Router } from "express";
import { requireAuth, getAdminFirestore } from "../firebase";

const router = Router();

/**
 * Push-notification preference and token registration.
 *
 * Deliberately separate from server/routes/reminders.ts. Reminder documents are
 * keyed by WhatsApp phone (`whatsapp_reminders/{phone}`) because the WhatsApp
 * bot and the cron both address them that way, and that whole flow 409s when a
 * user has not linked WhatsApp. Browser push has no phone number, so gating it
 * behind a linked account would lock out exactly the users who want it most.
 *
 * Tokens live at `users/{uid}/fcmTokens/{docId}` — keyed by user, not phone,
 * because one person may hold several (phone + laptop).
 */

const REMINDER_COLLECTION = "whatsapp_reminders";
const TOKENS_SUBCOLLECTION = "fcmTokens";

/**
 * Firestore document ids allow most characters but not `/`, and an FCM token is
 * an opaque ~150-char string. Using the token itself as the doc id is safe and
 * makes re-registration idempotent: the same browser always writes the same doc.
 */
function tokenDocId(token: string): string {
  return token.replace(/\//g, "_");
}

/**
 * The reminder doc this user's push settings attach to.
 *
 * Prefers the doc matching their linked WhatsApp phone, because that is the one
 * the cron already reads `reminderHour` from. Falls back to a uid-keyed doc for
 * users with no linked number.
 */
async function resolveReminderRef(
  uid: string,
): Promise<{ ref: FirebaseFirestore.DocumentReference; phone: string | null }> {
  const db = getAdminFirestore();
  const profileSnap = await db.doc(`users/${uid}`).get();
  const phone =
    profileSnap.exists && typeof profileSnap.data()?.whatsappPhone === "string"
      ? (profileSnap.data()!.whatsappPhone as string)
      : null;

  const key = phone || uid;
  return {
    ref: db.collection(REMINDER_COLLECTION).doc(key),
    phone,
  };
}

// ─── 1. Read current push settings ─────────────────────────────────────────────
router.get("/notifications/push", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const { ref, phone } = await resolveReminderRef(uid);
    const snap = await ref.get();

    const tokensSnap = await getAdminFirestore()
      .collection(`users/${uid}/${TOKENS_SUBCOLLECTION}`)
      .get();

    return res.json({
      pushEnabled: snap.exists ? snap.data()?.pushEnabled === true : false,
      tokenCount: tokensSnap.size,
      // Surfaced so the UI can explain that push follows the same hour as the
      // WhatsApp reminder rather than inventing a second schedule.
      reminderHour: snap.exists ? snap.data()?.reminderHour ?? null : null,
      reminderLinked: Boolean(phone),
    });
  } catch (error: any) {
    console.error("[Notifications] Failed to read push settings:", error);
    return res.status(500).json({ error: "Failed to load notification settings." });
  }
});

// ─── 2. Register a device token ────────────────────────────────────────────────
router.post("/notifications/push", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const token = req.body?.token;

    // FCM web tokens are long opaque strings; reject anything obviously wrong so
    // a malformed client cannot pollute the collection.
    if (typeof token !== "string" || token.length < 20 || token.length > 4096) {
      return res.status(400).json({ error: "Invalid notification token." });
    }

    await getAdminFirestore()
      .collection(`users/${uid}/${TOKENS_SUBCOLLECTION}`)
      .doc(tokenDocId(token))
      .set(
        {
          token,
          platform: typeof req.body?.platform === "string" ? req.body.platform : "web",
          updatedAt: new Date(),
        },
        { merge: true },
      );

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Failed to register push token:", error);
    return res.status(500).json({ error: "Failed to register this device." });
  }
});

// ─── 3. Remove a device token ──────────────────────────────────────────────────
router.delete("/notifications/push", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const token = req.body?.token;

    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "Invalid notification token." });
    }

    await getAdminFirestore()
      .collection(`users/${uid}/${TOKENS_SUBCOLLECTION}`)
      .doc(tokenDocId(token))
      .delete();

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Failed to remove push token:", error);
    return res.status(500).json({ error: "Failed to remove this device." });
  }
});

// ─── 4. Turn push on or off ────────────────────────────────────────────────────
// Writing `pushEnabled` alone is not enough to receive anything: the cron also
// requires `reminderHour`, which only the reminder settings own. Mirroring the
// WhatsApp default of 7 AM keeps a push-only user from being silently skipped.
const DEFAULT_REMINDER_HOUR = 7;

router.put("/notifications/push", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const enabled = req.body?.enabled;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Expected { enabled: boolean }." });
    }

    const { ref, phone } = await resolveReminderRef(uid);
    const snap = await ref.get();
    const current = snap.exists ? snap.data() : undefined;

    if (enabled) {
      // Leaving `enabled` absent keeps the WhatsApp cron behaving as before:
      // absent means "enabled" for backwards compatibility.
      await ref.set(
        {
          uid,
          ...(phone ? { phone } : {}),
          pushEnabled: true,
          reminderHour: current?.reminderHour ?? DEFAULT_REMINDER_HOUR,
          displayTime: current?.displayTime ?? "7:00 AM",
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } else {
      await ref.set({ pushEnabled: false, updatedAt: new Date() }, { merge: true });
    }

    return res.json({
      success: true,
      pushEnabled: enabled,
      reminderHour: enabled
        ? (current?.reminderHour ?? DEFAULT_REMINDER_HOUR)
        : (current?.reminderHour ?? null),
    });
  } catch (error: any) {
    console.error("[Notifications] Failed to update push setting:", error);
    return res.status(500).json({ error: "Failed to update notification settings." });
  }
});

export default router;