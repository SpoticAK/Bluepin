import { Router } from "express";
import express from "express";
import { getAdminFirestore } from "../firebase";
import { sendFeedbackEmail } from "../mailer";

const router = Router();

router.post("/feedback", express.json(), async (req, res) => {
  try {
    const { subject, message, userEmail } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    try {
      const db = getAdminFirestore();
      await db.collection('feedbacks').add({
        subject,
        message,
        userEmail: userEmail || 'Anonymous',
        createdAt: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error("Failed to save feedback to database:", dbError);
    }

    const emailResult = await sendFeedbackEmail({
      subject,
      message,
      userEmail
    });

    res.json(emailResult);
  } catch (error: any) {
    console.error("Feedback error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
