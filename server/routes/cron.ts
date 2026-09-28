import express from "express";
import { getAdminFirestore } from "../firebase";
import { sendWhatsAppMessage, sendWhatsAppUtilityTemplate } from "../services/whatsapp/client";

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
    
    if (authHeader !== `Bearer ${expectedSecret}` && process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = getAdminFirestore();
    
    // Get current hour in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const currentHourIST = istTime.getUTCHours();
    
    const todayDateStr = istTime.toISOString().split("T")[0];

    console.log(`[Cron] Running WhatsApp reminders for hour: ${currentHourIST} IST on ${todayDateStr}`);

    const remindersSnap = await db.collection("whatsapp_reminders")
      .where("reminderHour", "==", currentHourIST)
      .get();

    if (remindersSnap.empty) {
      return res.json({ success: true, sent: 0, message: "No reminders scheduled for this hour." });
    }

    let sentCount = 0;

    for (const doc of remindersSnap.docs) {
      const { uid, phone } = doc.data();
      if (!uid || !phone) continue;

      const readingsSnap = await db.collection(`users/${uid}/glucoseReadings`)
        .where("date", "==", todayDateStr)
        .limit(1)
        .get();

      if (!readingsSnap.empty) {
        continue;
      }

      try {
        // IMPORTANT: Because of Meta's 24-hour rule, we MUST use a pre-approved template
        // for cron job reminders. 
        // 1. Create a Utility Template in Meta Business Manager named "daily_glucose_reminder"
        // 2. Add Guideline 9 text to it.
        // 3. Once approved, uncomment the line below:
        
        await sendWhatsAppUtilityTemplate(phone, "daily_glucose_reminder", "en");

        // We also fall back to standard text just in case the 24-hour window IS open during testing
        // await sendWhatsAppMessage(phone, "It is time to check in.\nWhenever you are ready, send me your glucose reading or a photo of your glucometer.\n\nType help if you need anything.");

        sentCount++;
      } catch (err) {
        console.error(`[Cron] Failed to send reminder to ${phone}:`, err);
      }
    }

    return res.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error("[Cron] Error running whatsapp reminders:", err);
    return res.status(500).json({ error: "Failed to process reminders" });
  }
});

export default router;
