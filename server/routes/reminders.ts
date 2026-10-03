import { Router } from "express";
import { requireAuth, getAdminFirestore } from "../firebase";
import {
  APP_REMINDER_HOURS,
  APP_HOUR_MIN,
  APP_HOUR_MAX,
  isValidAppHour,
  formatHour,
} from "../services/wa-bot/services/reminderSlots";
import { sendReminderConfirmation } from "../services/wa-bot/wa-client";
import { maskPhone } from "../services/whatsapp/client";

const router = Router();

const NOT_LINKED_MESSAGE =
  "Connect your WhatsApp account before setting a reminder, so we know where to send it.";
const INVALID_HOUR_MESSAGE = `Please choose a time between ${formatHour(APP_HOUR_MIN)} and ${formatHour(APP_HOUR_MAX)}.`;

/**
 * Reads the caller's linked WhatsApp number.
 *
 * The reminder document is keyed by phone rather than uid (the cron route and
 * the bot both address it that way), so the server resolves the phone from the
 * user profile instead of trusting a client-supplied value.
 */
async function getLinkedPhone(uid: string): Promise<string | null> {
  const snap = await getAdminFirestore().doc(`users/${uid}`).get();
  const phone = snap.exists ? snap.data()?.whatsappPhone : undefined;
  return typeof phone === "string" && phone ? phone : null;
}

/**
 * Normalises a stored reminder doc into the shape the app consumes.
 * `enabled` is absent on documents written before the flag existed, so those
 * read as enabled and keep behaving exactly as they did.
 */
function toReminderPayload(data: Record<string, any> | undefined) {
  if (!data) return null;

  const hour = Number(data.reminderHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  const updatedAt = data.updatedAt;
  const updatedAtMs =
    updatedAt?.toMillis?.() ??
    (typeof updatedAt?.seconds === "number" ? updatedAt.seconds * 1000 : null);

  return {
    hour,
    displayTime: typeof data.displayTime === "string" ? data.displayTime : formatHour(hour),
    enabled: data.enabled !== false,
    updatedAt: updatedAtMs,
  };
}

// ─── 1. Read the caller's reminder ─────────────────────────────────────────────
router.get("/reminders", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const phone = await getLinkedPhone(uid);

    if (!phone) {
      return res.json({ linked: false, reminder: null, slots: APP_REMINDER_HOURS });
    }

    const snap = await getAdminFirestore().doc(`whatsapp_reminders/${phone}`).get();
    return res.json({
      linked: true,
      reminder: toReminderPayload(snap.exists ? snap.data() : undefined),
      slots: APP_REMINDER_HOURS,
    });
  } catch (error: any) {
    console.error("[Reminders] Failed to fetch reminder:", error);
    return res.status(500).json({ error: "Failed to load your reminder settings." });
  }
});

// ─── 2. Create or update the reminder ──────────────────────────────────────────
router.put("/reminders", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const phone = await getLinkedPhone(uid);
    if (!phone) {
      return res.status(409).json({ error: NOT_LINKED_MESSAGE });
    }

    const hour = Number(req.body?.hour);
    if (!isValidAppHour(hour)) {
      return res.status(400).json({ error: INVALID_HOUR_MESSAGE });
    }
    const displayTime = formatHour(hour);

    const ref = getAdminFirestore().doc(`whatsapp_reminders/${phone}`);
    const snap = await ref.get();
    const previous = toReminderPayload(snap.exists ? snap.data() : undefined);
    const unchanged =
      previous !== null && previous.hour === hour && previous.enabled === true;
    if (unchanged) {
      return res.json({ success: true, reminder: previous, changed: false });
    }

    // Setting a time is an explicit opt-in, so it also re-enables a reminder
    // the user previously stopped.
    await ref.set(
      {
        uid,
        phone,
        reminderHour: hour,
        displayTime,
        enabled: true,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    console.log("[Reminders] Reminder updated from app.", {
      uid,
      phone: maskPhone(phone),
      hour,
    });

    // Confirm on the channel that will actually deliver. A failed confirmation
    // must not fail the save — the reminder is already persisted.
    if (previous?.enabled !== true || previous.hour !== hour) {
      sendReminderConfirmation(phone, displayTime).catch((err) =>
        console.warn(
          "[Reminders] Saved, but the WhatsApp confirmation failed:",
          err?.message || err,
        ),
      );
    }

    return res.json({
      success: true,
      changed: true,
      reminder: {
        hour,
        displayTime,
        enabled: true,
        updatedAt: Date.now(),
      },
    });
  } catch (error: any) {
    console.error("[Reminders] Failed to update reminder:", error);
    return res.status(500).json({ error: "Failed to update your reminder." });
  }
});

// ─── 3. Stop the reminder ──────────────────────────────────────────────────────
// Soft-disables rather than deletes. The end-of-day sweep iterates
// whatsapp_users, not whatsapp_reminders, so removing the document would leave
// the 8 PM message still going out.
router.post("/reminders/stop", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const phone = await getLinkedPhone(uid);
    if (!phone) {
      return res.status(409).json({ error: NOT_LINKED_MESSAGE });
    }

    const db = getAdminFirestore();
    const ref = db.doc(`whatsapp_reminders/${phone}`);
    const snap = await ref.get();
    const previous = toReminderPayload(snap.exists ? snap.data() : undefined);

    if (previous === null) {
      return res.json({ success: true, changed: false, reminder: null });
    }
    if (previous.enabled === false) {
      return res.json({ success: true, changed: false, reminder: previous });
    }

    // Push shares this reminder's hour, so stopping it has to silence both
    // channels — otherwise the user taps Stop in the WhatsApp modal and still
    // receives a browser notification at the same hour.
    await ref.set(
      {
        uid,
        phone,
        enabled: false,
        pushEnabled: false,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    console.log("[Reminders] Reminder stopped from app.", {
      uid,
      phone: maskPhone(phone),
    });

    return res.json({
      success: true,
      changed: true,
      reminder: { ...previous, enabled: false, updatedAt: Date.now() },
    });
  } catch (error: any) {
    console.error("[Reminders] Failed to stop reminder:", error);
    return res.status(500).json({ error: "Failed to stop your reminder." });
  }
});

export default router;