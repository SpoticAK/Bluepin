import express from "express";
import { getAdminFirestore } from "../firebase";
import {
  sendWhatsAppUtilityTemplate,
  getTemplateLang,
  maskPhone,
} from "../services/whatsapp/client";
import { sendGlucosePushNudges } from "../services/notifications";

const router = express.Router();

/**
 * Triggered by Google Cloud Scheduler every hour.
 * Example URL: POST /api/cron/whatsapp-reminders
 */
router.post("/cron/whatsapp-reminders", async (req, res) => {
  try {
    // Basic security check
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.CRON_SECRET || "default_cron_secret";

    if (
      authHeader !== `Bearer ${expectedSecret}` &&
      process.env.NODE_ENV === "production"
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = getAdminFirestore();

    // Get current hour in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const currentHourIST = istTime.getUTCHours();

    const todayDateStr = istTime.toISOString().split("T")[0];

    console.log(
      `[Cron] Running WhatsApp reminders for hour: ${currentHourIST} IST on ${todayDateStr}`,
    );

    // --- 1. Scheduled Reminders (Guideline 9) ---
    const remindersSnap = await db
      .collection("whatsapp_reminders")
      .where("reminderHour", "==", currentHourIST)
      .get();

    let sentScheduledCount = 0;
    // Users who opted into push and have not logged yet, collected during the
    // loop below so the "already logged" check is not repeated for the push send.
    const pushCandidates: Array<{ uid: string }> = [];

    for (const doc of remindersSnap.docs) {
      const { uid, phone } = doc.data();
      if (!uid) continue;

      // `enabled` is absent on documents written before the flag existed, so
      // only an explicit false opts the user out. It governs the WhatsApp
      // channel; push has its own `pushEnabled` flag.
      if (doc.data().enabled === false) continue;

      const readingsSnap = await db
        .collection(`users/${uid}/glucoseReadings`)
        .where("date", "==", todayDateStr)
        .limit(1)
        .get();

      if (!readingsSnap.empty) {
        continue;
      }

      if (doc.data().pushEnabled === true) {
        pushCandidates.push({ uid });
      }

      // No linked number means there is nothing to send over WhatsApp, but a
      // push-only user still needs their reminder.
      if (!phone) continue;

      try {
        // Template for Guideline 9
        await sendWhatsAppUtilityTemplate(
          phone,
          "bluepin_glucose_reminder",
          getTemplateLang(),
        );
        sentScheduledCount++;
      } catch (err) {
        console.error(
          `[Cron] Failed to send scheduled reminder to ${maskPhone(phone)}:`,
          err,
        );
      }
    }

    // --- 1b. Scheduled Push Notifications ---
    // Sent after the WhatsApp loop so both channels reuse the single readings
    // query above. Failures here must never affect WhatsApp delivery counts.
    let pushResult = { delivered: 0, prunedTokens: 0, errors: 0 };
    if (pushCandidates.length > 0) {
      try {
        pushResult = await sendGlucosePushNudges(pushCandidates);
        console.log(
          `[Cron] Push nudge delivered to ${pushResult.delivered} device(s), pruned ${pushResult.prunedTokens} stale token(s).`,
        );
      } catch (err: any) {
        console.error("[Cron] Push nudge stage failed:", err?.message || err);
      }
    }

    // --- 2. End-of-Day Sweep (Guideline 10) ---
    // If it is 8:00 PM IST (20), we sweep everyone who missed logging today.
    const END_OF_DAY_HOUR = 20;
    let sentSweepCount = 0;

    if (currentHourIST === END_OF_DAY_HOUR) {
      const allUsersSnap = await db.collection("whatsapp_users").get();

      for (const doc of allUsersSnap.docs) {
        const { uid, phone } = doc.data();
        if (!uid || !phone) continue;

        // This sweep walks whatsapp_users rather than whatsapp_reminders, so a
        // user who stopped their reminder would otherwise keep getting the 8 PM
        // message. Read their reminder doc and honour an explicit opt-out.
        const ownReminderSnap = await db
          .collection("whatsapp_reminders")
          .doc(phone)
          .get();
        const ownReminder = ownReminderSnap.exists
          ? ownReminderSnap.data()
          : undefined;

        if (ownReminder?.enabled === false) continue;

        // Skip if they explicitly scheduled an 8PM reminder (they already got Guideline 9 above)
        if (ownReminder?.reminderHour === END_OF_DAY_HOUR) {
          continue;
        }

        const readingsSnap = await db
          .collection(`users/${uid}/glucoseReadings`)
          .where("date", "==", todayDateStr)
          .limit(1)
          .get();

        if (!readingsSnap.empty) {
          continue;
        }

        try {
          // Template for Guideline 10: "I have not seen a glucose reading from you today..."
          await sendWhatsAppUtilityTemplate(
            phone,
            "missed_glucose_reminder",
            getTemplateLang(),
          );
          sentSweepCount++;
        } catch (err) {
          console.error(
            `[Cron] Failed to send sweep reminder to ${maskPhone(phone)}:`,
            err,
          );
        }
      }
    }

    return res.json({
      success: true,
      scheduledSent: sentScheduledCount,
      sweepSent: sentSweepCount,
      pushDelivered: pushResult.delivered,
      pushPrunedTokens: pushResult.prunedTokens,
      pushErrors: pushResult.errors,
    });
  } catch (err: any) {
    console.error("[Cron] Error running whatsapp reminders:", err);
    return res.status(500).json({ error: "Failed to process reminders" });
  }
});

export default router;
