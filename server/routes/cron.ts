import express from "express";
import { getAdminFirestore } from "../firebase";
import {
  sendWhatsAppUtilityTemplate,
  getTemplateLang,
  maskPhone,
} from "../services/whatsapp/client";

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

    for (const doc of remindersSnap.docs) {
      const { uid, phone } = doc.data();
      if (!uid || !phone) continue;

      const readingsSnap = await db
        .collection(`users/${uid}/glucoseReadings`)
        .where("date", "==", todayDateStr)
        .limit(1)
        .get();

      if (!readingsSnap.empty) {
        continue;
      }

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

    // --- 2. End-of-Day Sweep (Guideline 10) ---
    // If it is 8:00 PM IST (20), we sweep everyone who missed logging today.
    const END_OF_DAY_HOUR = 20;
    let sentSweepCount = 0;

    if (currentHourIST === END_OF_DAY_HOUR) {
      const allUsersSnap = await db.collection("whatsapp_users").get();

      for (const doc of allUsersSnap.docs) {
        const { uid, phone } = doc.data();
        if (!uid || !phone) continue;

        // Skip if they explicitly scheduled an 8PM reminder (they already got Guideline 9 above)
        const has8pmReminderSnap = await db
          .collection("whatsapp_reminders")
          .doc(phone)
          .get();
        if (
          has8pmReminderSnap.exists &&
          has8pmReminderSnap.data()?.reminderHour === END_OF_DAY_HOUR
        ) {
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
    });
  } catch (err: any) {
    console.error("[Cron] Error running whatsapp reminders:", err);
    return res.status(500).json({ error: "Failed to process reminders" });
  }
});

export default router;
