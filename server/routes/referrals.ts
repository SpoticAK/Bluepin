import { Router } from "express";
import express from "express";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore, requireAuth } from "../firebase";
import { requireAdmin, requireReferralAccess } from "../middleware/requireAdmin";
import type { ReferralCode, ReferralEvent } from "../services/referralScorer";

const router = Router();

// List of disposable email domains for anti-abuse protection
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com",
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "dispostable.com",
  "getnada.com",
  "mohmal.com",
  "generator.email",
]);

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

function isDisposableEmail(email?: string): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
}

// ─── 1. Attribute Referral for Current Signed-In User ─────────────────────────
router.post("/referrals/attribute", requireAuth, express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    const uid = user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rawCode = req.body?.refCode;
    if (!rawCode || typeof rawCode !== "string") {
      return res.status(400).json({ error: "Referral code is required" });
    }

    const cleanCode = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(cleanCode)) {
      return res.status(400).json({ error: "Invalid referral code format" });
    }

    const db = getAdminFirestore();
    const eventRef = db.doc(`referral_events/${uid}`);

    // Idempotency: Has this user already been attributed?
    const existingEventSnap = await eventRef.get();
    if (existingEventSnap.exists) {
      return res.json({ success: true, alreadyAttributed: true });
    }

    // Safety: Verify user account creation time (< 10 minutes ago)
    const authAdmin = getAdminAuth();
    let userRecord;
    try {
      userRecord = await authAdmin.getUser(uid);
    } catch (err: any) {
      return res.status(400).json({ error: "Failed to verify user record" });
    }

    const creationTime = new Date(userRecord.metadata.creationTime).getTime();
    const tenMinutesMs = 10 * 60 * 1000;
    if (Date.now() - creationTime > tenMinutesMs) {
      return res.status(400).json({
        error: "Referral attribution is only valid for newly created accounts",
        code: "ACCOUNT_NOT_NEW",
      });
    }

    // Validate referral code existence and active state
    const codeRef = db.doc(`referral_codes/${cleanCode}`);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      return res.status(404).json({ error: "Referral code does not exist" });
    }

    const codeData = codeSnap.data() as ReferralCode;
    if (codeData.isActive === false) {
      return res.status(400).json({ error: "This referral code is inactive" });
    }

    // Anti-abuse telemetry
    const clientIp = String(
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown"
    ).split(",")[0].trim();
    const ipHash = hashIp(clientIp);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 255);

    const email = userRecord.email?.toLowerCase();
    const isDisposable = isDisposableEmail(email);

    // Determine signup method
    const isGoogle = userRecord.providerData.some((p) => p.providerId === "google.com");
    const signupMethod: "Email" | "Google" = isGoogle ? "Google" : "Email";

    // Transaction to safely attribute and increment referral_codes.totalSignups
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      if (snap.exists) return; // Prevent race conditions

      const newEvent: ReferralEvent = {
        uid,
        refCode: cleanCode,
        attributedAt: Date.now(),
        signupMethod,
        lastScoredAt: 0,
        score: 0,
        milestones: {},
        _ipHash: ipHash,
        _userAgent: userAgent,
        ...(isDisposable ? { _disqualifyReason: "disposable_email" } : {}),
      };

      tx.set(eventRef, newEvent);
      tx.update(codeRef, {
        totalSignups: FieldValue.increment(1),
      });
    });

    return res.json({
      success: true,
      refCode: cleanCode,
      alreadyAttributed: false,
    });
  } catch (err: any) {
    console.error("[Referrals] Error attributing referral:", err);
    return res.status(500).json({ error: "Failed to attribute referral" });
  }
});

// ─── 2. Admin / Dev Summary & Leaderboard ─────────────────────────────────────
router.get("/referrals/admin/summary", requireAuth, requireReferralAccess, async (req, res) => {
  try {
    const db = getAdminFirestore();
    const targetCode = req.query.code ? String(req.query.code).trim().toUpperCase() : null;

    if (targetCode) {
      const codeSnap = await db.doc(`referral_codes/${targetCode}`).get();
      if (!codeSnap.exists) {
        return res.status(404).json({ error: "Referral code not found" });
      }

      const eventsSnap = await db
        .collection("referral_events")
        .where("refCode", "==", targetCode)
        .orderBy("attributedAt", "desc")
        .get();

      const events = eventsSnap.docs.map((doc) => {
        const data = doc.data();
        // Hide internal IP hash from client response
        const { _ipHash, ...safeData } = data;
        return {
          id: doc.id,
          ...safeData,
        };
      });

      return res.json({
        success: true,
        code: codeSnap.data(),
        events,
      });
    }

    // Default: Return all codes ordered by totalScore desc
    const codesSnap = await db
      .collection("referral_codes")
      .orderBy("totalScore", "desc")
      .get();

    const codes = codesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      success: true,
      codes,
    });
  } catch (err: any) {
    console.error("[Referrals] Error fetching referral summary:", err);
    return res.status(500).json({ error: "Failed to fetch referral summary" });
  }
});

// ─── 3. Admin: Create a Single New Code Dynamically ───────────────────────────
router.post("/referrals/admin/codes", requireAuth, requireAdmin, express.json(), async (req, res) => {
  try {
    const { code, applicantName, applicantEmail } = req.body || {};
    if (!code || !applicantName) {
      return res.status(400).json({ error: "Code and applicantName are required" });
    }

    const cleanCode = String(code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(cleanCode)) {
      return res.status(400).json({ error: "Code must be 2-30 alphanumeric characters" });
    }

    const db = getAdminFirestore();
    const codeRef = db.doc(`referral_codes/${cleanCode}`);
    const existing = await codeRef.get();
    if (existing.exists) {
      return res.status(409).json({ error: "Referral code already exists" });
    }

    const adminUser = (req as any).user;
    const newCodeDoc: ReferralCode = {
      code: cleanCode,
      applicantName: String(applicantName).trim(),
      applicantEmail: applicantEmail ? String(applicantEmail).trim() : null,
      createdAt: Date.now(),
      createdBy: adminUser?.email || adminUser?.uid || "admin",
      isActive: true,
      totalSignups: 0,
      qualifiedSignups: 0,
      totalScore: 0,
    };

    await codeRef.set(newCodeDoc);
    return res.json({ success: true, code: newCodeDoc });
  } catch (err: any) {
    console.error("[Referrals] Error creating referral code:", err);
    return res.status(500).json({ error: "Failed to create referral code" });
  }
});

// ─── 4. Admin: Toggle Referral Code Status (Active / Inactive) ────────────────
router.patch("/referrals/admin/codes/:code/status", requireAuth, requireAdmin, express.json(), async (req, res) => {
  try {
    const { code } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const db = getAdminFirestore();
    const codeRef = db.doc(`referral_codes/${cleanCode}`);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      return res.status(404).json({ error: "Referral code not found" });
    }

    await codeRef.update({ isActive });
    return res.json({ success: true, code: cleanCode, isActive });
  } catch (err: any) {
    console.error("[Referrals] Error updating code status:", err);
    return res.status(500).json({ error: "Failed to update code status" });
  }
});

export default router;
