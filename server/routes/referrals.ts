import { Router } from "express";
import express from "express";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { config } from "../config";
import { getAdminAuth, getAdminFirestore, requireAuth } from "../firebase";
import { applicantReferralLimiter } from "../middleware/security";
import { requireAdmin, requireReferralAccess } from "../middleware/requireAdmin";
import {
  buildReferralUrl,
  issueApplicantReferralCode,
  normalizeApplicantEmail,
  normalizeApplicantLinkedinUrl,
} from "../services/applicantReferral";
import type { ReferralCode, ReferralEvent } from "../services/referralScorer";
import {
  rebuildReferralCodeTotals,
  runReferralScoring,
} from "../services/referralScoring";

const router = Router();

// Anti-abuse: flag accounts when more than this many signups share an IP hash
// inside the window. Flagged accounts are kept for visibility but never earn
// points (see services/referralScorer.ts).
const IP_CLUSTER_WINDOW_MS = 24 * 60 * 60 * 1000;
const IP_CLUSTER_LIMIT = 5;

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
    if (codeData.isActive !== true) {
      return res.status(400).json({ error: "This referral code is inactive" });
    }

    // Anti-abuse telemetry
    const clientIp = String(
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown"
    ).split(",")[0].trim();
    const ipHash = hashIp(clientIp);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 255);

    const email = userRecord.email?.toLowerCase();
    if (isDisposableEmail(email)) {
      return res.status(400).json({
        error: "Disposable email addresses are not eligible for referral attribution",
        code: "DISPOSABLE_EMAIL",
      });
    }

    // IP clustering: legit households can share an IP, so this flags rather
    // than rejects. Flagged events are excluded from scoring.
    let disqualifyReason: string | undefined;
    try {
      const ipSnap = await db
        .collection("referral_events")
        .where("_ipHash", "==", ipHash)
        .get();
      const recentCount = ipSnap.docs.filter((doc) => {
        const attributedAt = Number(doc.data().attributedAt || 0);
        return attributedAt > Date.now() - IP_CLUSTER_WINDOW_MS;
      }).length;

      if (recentCount >= IP_CLUSTER_LIMIT - 1) {
        disqualifyReason = "ip_cluster";
      }
    } catch (err) {
      // Telemetry must never block a legitimate attribution.
      console.warn("[Referrals] IP clustering check failed:", err);
    }

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
        referredEmail: userRecord.email?.toLowerCase() ?? null,
        attributedAt: Date.now(),
        signupMethod,
        lastScoredAt: 0,
        score: 0,
        milestones: {},
        _ipHash: ipHash,
        _userAgent: userAgent,
        ...(disqualifyReason ? { _disqualifyReason: disqualifyReason } : {}),
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

// ─── 2. Applicant Portal: Issue or Reuse a Referral Code (Public) ─────────────
// Called by the bluepin.in applicant form. No authentication is required by
// design: the email is the idempotency key, so re-registering returns the same
// code. The endpoint is IP-rate-limited and never touches user data or events.
router.post(
  "/referrals/applicant",
  applicantReferralLimiter,
  express.json(),
  async (req, res) => {
    try {
      const rawName = req.body?.applicantName ?? req.body?.name;
      const rawEmail = req.body?.applicantEmail ?? req.body?.email;

      if (typeof rawName !== "string" || rawName.trim().length === 0) {
        return res.status(400).json({ error: "applicantName is required" });
      }

      const applicantName = rawName.trim().replace(/\s+/g, " ");
      if (applicantName.length > 80) {
        return res
          .status(400)
          .json({ error: "applicantName must be 80 characters or fewer" });
      }
      if (/[\u0000-\u001F\u007F]/.test(applicantName)) {
        return res
          .status(400)
          .json({ error: "applicantName contains invalid characters" });
      }

      if (typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
        return res.status(400).json({ error: "applicantEmail is required" });
      }

      const applicantEmail = normalizeApplicantEmail(rawEmail);
      if (
        applicantEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)
      ) {
        return res
          .status(400)
          .json({ error: "A valid applicantEmail is required" });
      }

      const rawAge = req.body?.applicantAge ?? req.body?.age;
      let applicantAge: number | undefined;
      if (rawAge !== undefined && rawAge !== null && rawAge !== "") {
        const parsedAge =
          typeof rawAge === "number" ? rawAge : Number(String(rawAge).trim());
        if (
          !Number.isInteger(parsedAge) ||
          parsedAge < 13 ||
          parsedAge > 120
        ) {
          return res.status(400).json({
            error: "applicantAge must be an integer between 13 and 120",
          });
        }
        applicantAge = parsedAge;
      }

      const rawLinkedin =
        req.body?.applicantLinkedinUrl ?? req.body?.linkedinUrl;
      let applicantLinkedinUrl: string | undefined;
      if (
        rawLinkedin !== undefined &&
        rawLinkedin !== null &&
        rawLinkedin !== ""
      ) {
        if (typeof rawLinkedin !== "string") {
          return res.status(400).json({
            error: "applicantLinkedinUrl must be a LinkedIn profile URL",
          });
        }
        const normalizedLinkedin = normalizeApplicantLinkedinUrl(rawLinkedin);
        if (!normalizedLinkedin) {
          return res.status(400).json({
            error:
              "applicantLinkedinUrl must be a valid LinkedIn profile URL",
          });
        }
        applicantLinkedinUrl = normalizedLinkedin;
      }

      if (isDisposableEmail(applicantEmail)) {
        return res.status(400).json({
          error: "Disposable email addresses are not eligible for a referral code",
          code: "DISPOSABLE_EMAIL",
        });
      }

      const db = getAdminFirestore();
      const result = await issueApplicantReferralCode(db, {
        applicantName,
        applicantEmail,
        applicantAge,
        applicantLinkedinUrl,
      });

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        code: result.code,
        referralUrl: buildReferralUrl(config.appUrl, result.code),
        isActive: result.codeDoc.isActive === true,
        created: result.created,
        reused: !result.created,
        applicantName: result.codeDoc.applicantName,
        applicantEmail,
        applicantAge: result.codeDoc.applicantAge ?? null,
        applicantLinkedinUrl: result.codeDoc.applicantLinkedinUrl ?? null,
      });
    } catch (err: any) {
      console.error("[Referrals] Error issuing applicant referral code:", err);
      return res
        .status(500)
        .json({ error: "Failed to issue referral code" });
    }
  },
);

// ─── 3. Admin / Dev Summary & Leaderboard ─────────────────────────────────────
router.get("/referrals/admin/summary", requireAuth, requireReferralAccess, async (req, res) => {
  try {
    const db = getAdminFirestore();
    const targetCode = req.query.code ? String(req.query.code).trim().toUpperCase() : null;

    if (targetCode) {
      const codeSnap = await db.doc(`referral_codes/${targetCode}`).get();
      if (!codeSnap.exists) {
        return res.status(404).json({ error: "Referral code not found" });
      }

      // Deliberately no orderBy here: an equality filter + orderBy on a
      // different field needs a composite index (not declared in
      // firestore.indexes.json). Sorting in memory keeps the breakdown pane
      // working on a fresh deployment.
      const eventsSnap = await db
        .collection("referral_events")
        .where("refCode", "==", targetCode)
        .get();

      // Enrich the breakdown with the referred user's profile name (when they
      // have completed onboarding). The raw UID remains the fallback so events
      // without a profile are still identifiable.
      const userIds = eventsSnap.docs.map((doc) => doc.id);
      const displayNames = new Map<string, string>();
      for (let i = 0; i < userIds.length; i += 300) {
        const chunk = userIds.slice(i, i + 300);
        const userSnaps = await db.getAll(
          ...chunk.map((id) => db.doc(`users/${id}`)),
        );
        for (const snap of userSnaps) {
          if (!snap.exists) continue;
          const name = snap.data()?.name;
          if (typeof name === "string" && name.trim().length > 0) {
            displayNames.set(snap.id, name.trim());
          }
        }
      }

      // Older events predate `referredEmail`; resolve those from Firebase Auth
      // in batches of 100 (the Admin SDK limit for getUsers).
      const emailByUid = new Map<string, string>();
      const missingEmailUids = eventsSnap.docs
        .filter((doc) => {
          const email = doc.data().referredEmail;
          return typeof email !== "string" || email.length === 0;
        })
        .map((doc) => doc.id);

      if (missingEmailUids.length > 0) {
        const authAdmin = getAdminAuth();
        for (let i = 0; i < missingEmailUids.length; i += 100) {
          const chunk = missingEmailUids.slice(i, i + 100);
          try {
            const usersResult = await authAdmin.getUsers(
              chunk.map((uid) => ({ uid })),
            );
            for (const user of usersResult.users) {
              if (user.email) emailByUid.set(user.uid, user.email);
            }
          } catch (err) {
            // A missing Auth user or transient Admin API failure must not break
            // the whole leaderboard; the UI falls back to the profile name/UID.
            console.warn(
              "[Referrals] Could not resolve referred user emails:",
              err,
            );
          }
        }
      }

      const events = eventsSnap.docs
        .map((doc) => {
          const data = doc.data();
          // Hide server-only anti-abuse telemetry from the client response
          const { _ipHash, _userAgent, ...safeData } = data;
          return {
            id: doc.id,
            ...safeData,
            displayName: displayNames.get(doc.id) ?? null,
            referredEmail:
              (typeof data.referredEmail === "string" &&
                data.referredEmail) ||
              emailByUid.get(doc.id) ||
              null,
          };
        })
        .sort((a: any, b: any) => Number(b.attributedAt || 0) - Number(a.attributedAt || 0));

      return res.json({
        success: true,
        code: codeSnap.data(),
        events,
      });
    }

    // Default: Return all codes ordered by totalScore desc, then by
    // qualifiedSignups desc as the documented tie-breaker.
    const codesSnap = await db.collection("referral_codes").get();

    const codes = codesSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        const scoreDiff = Number(b.totalScore || 0) - Number(a.totalScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(b.qualifiedSignups || 0) - Number(a.qualifiedSignups || 0);
      });

    return res.json({
      success: true,
      codes,
    });
  } catch (err: any) {
    console.error("[Referrals] Error fetching referral summary:", err);
    return res.status(500).json({ error: "Failed to fetch referral summary" });
  }
});

// ─── 4. Admin: Create a Single New Code Dynamically ───────────────────────────
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
      applicantEmail: applicantEmail
        ? String(applicantEmail).trim().toLowerCase()
        : null,
      createdAt: Date.now(),
      createdBy: adminUser?.uid || adminUser?.email || "admin",
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

// ─── 5. Referral dashboard: Trigger an Immediate Scoring Sweep ────────────────
// The Cloud Scheduler route is protected by CRON_SECRET, which must never be
// shipped to the browser. Referral viewers/admins use this authenticated route
// instead. Re-scoring only recomputes referral counters; it never edits codes
// or user data, so read-only tracking viewers are allowed to trigger it.
router.post(
  "/referrals/admin/rescore",
  requireAuth,
  requireReferralAccess,
  async (req, res) => {
    try {
      const db = getAdminFirestore();
      const force = req.query.force !== "false";
      const result = await runReferralScoring(db, { force });
      return res.json(result);
    } catch (err: any) {
      console.error("[Referrals] Error running scoring sweep:", err);
      return res.status(500).json({ error: "Failed to run referral scoring" });
    }
  },
);

// ─── 6. Admin: Rebuild Denormalized Code Totals From Events ───────────────────
// Repair path for historical counter drift (e.g. the pre-fix seed script that
// reset counters on every re-run). Safe to run repeatedly.
router.post(
  "/referrals/admin/rebuild-totals",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    try {
      const db = getAdminFirestore();
      const result = await rebuildReferralCodeTotals(db);
      return res.json(result);
    } catch (err: any) {
      console.error("[Referrals] Error rebuilding referral totals:", err);
      return res.status(500).json({ error: "Failed to rebuild referral totals" });
    }
  },
);

// ─── 7. Admin: Toggle Referral Code Status (Active / Inactive) ────────────────
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
