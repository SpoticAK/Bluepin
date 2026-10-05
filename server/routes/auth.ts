import { Router } from "express";
import { getAdminFirestore, getAdminAuth } from "../firebase";
import {
  sendWhatsAppOtp,
  normalizePhone,
  maskPhone,
} from "../services/whatsappService";
import {
  generateNumericCode,
  hashOtp,
  verifyOtpHash,
} from "../services/whatsapp/utils";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

/**
 * Normalizes phone numbers to canonical E.164 digits without a "+"
 * (e.g. 919876543210). This is the exact form Meta reports in webhook
 * payloads, so it is also the form used for every `whatsapp_users/{phone}`
 * Firestore key. Bare 10-digit numbers default to India (+91).
 */
function normalizePhoneNumber(raw: string): string | null {
  return normalizePhone(raw);
}

// ─── 1. Send WhatsApp OTP ──────────────────────────────────────────────────
router.post("/auth/whatsapp/send-otp", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "Mobile phone number is required." });
    }

    const digitsOnly = normalizePhoneNumber(phone);
    if (!digitsOnly) {
      return res.status(400).json({ error: "Invalid mobile phone number format." });
    }
    const cleanPhone = `+${digitsOnly}`;

    const db = getAdminFirestore();
    const otpRef = db.doc(`whatsapp_otps/${digitsOnly}`);
    const existingSnap = await otpRef.get();

    // Rate limiting: 30 seconds cooldown between resends
    if (existingSnap.exists) {
      const data = existingSnap.data()!;
      const lastSentAt = data.lastSentAt || 0;
      const cooldownRemaining = 30 - Math.floor((Date.now() - lastSentAt) / 1000);
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          error: `Please wait ${cooldownRemaining}s before requesting a new code.`,
          retryAfter: cooldownRemaining,
        });
      }
    }

    // Generate 6-digit OTP with a CSPRNG
    const otp = generateNumericCode(6);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Dispatch via WhatsApp Meta API
    const dispatchResult = await sendWhatsAppOtp(digitsOnly, otp);
    if (!dispatchResult.success) {
      return res.status(502).json({
        error: dispatchResult.error || "Failed to deliver WhatsApp message. Please check number and try again.",
      });
    }

    // Store only an HMAC of the code, never the code itself
    await otpRef.set({
      phone: cleanPhone,
      otpHash: hashOtp(otp, digitsOnly),
      attempts: 0,
      expiresAt,
      lastSentAt: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: "Verification code sent to your WhatsApp.",
      expiresIn: 300,
    });
  } catch (err: any) {
    console.error("[WhatsApp Auth] Error sending OTP:", err);
    return res.status(500).json({ error: "Internal server error while sending OTP." });
  }
});

// ─── 2. Verify WhatsApp OTP & Issue Firebase Custom Token ──────────────────
router.post("/auth/whatsapp/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone number and 6-digit OTP are required." });
    }

    const digitsOnly = normalizePhoneNumber(phone);
    if (!digitsOnly) {
      return res.status(400).json({ error: "Invalid mobile phone number format." });
    }
    const cleanPhone = `+${digitsOnly}`;
    const cleanOtp = String(otp).trim();

    const db = getAdminFirestore();
    const otpRef = db.doc(`whatsapp_otps/${digitsOnly}`);

    interface VerifyResult {
      ok: boolean;
      status?: number;
      error?: string;
      code?: string;
    }

    // Transactional so the attempt counter cannot be raced by parallel requests,
    // which would otherwise let a 6-digit code be brute-forced past the limit.
    const verify: VerifyResult = await db.runTransaction(async (tx): Promise<VerifyResult> => {
      const otpSnap = await tx.get(otpRef);
      if (!otpSnap.exists) {
        return {
          ok: false,
          status: 400,
          error: "No active verification request found. Please request a new OTP code.",
          code: "auth/code-expired",
        };
      }

      const data = otpSnap.data()!;

      if (Date.now() > Number(data.expiresAt || 0)) {
        tx.delete(otpRef);
        return {
          ok: false,
          status: 400,
          error: "The OTP code has expired. Please request a new code.",
          code: "auth/code-expired",
        };
      }

      const attempts = Number(data.attempts || 0);
      if (attempts >= 5) {
        tx.delete(otpRef);
        return {
          ok: false,
          status: 429,
          error: "Too many incorrect attempts. Please request a new OTP code.",
          code: "auth/too-many-requests",
        };
      }

      if (!verifyOtpHash(cleanOtp, digitsOnly, String(data.otpHash || ""))) {
        const nextAttempts = attempts + 1;
        tx.update(otpRef, { attempts: nextAttempts });
        return {
          ok: false,
          status: 400,
          error: `Incorrect OTP. You have ${5 - nextAttempts} attempt(s) remaining.`,
          code: "auth/invalid-verification-code",
        };
      }

      tx.delete(otpRef);
      return { ok: true };
    });

    if (!verify.ok) {
      return res
        .status(verify.status ?? 400)
        .json({ error: verify.error, code: verify.code });
    }

    // Get or Create Firebase User
    const authAdmin = getAdminAuth();
    let user;
    let isNewUser = false;

    // 1. Check if phone is already linked to an existing account in Firestore
    // (e.g. user previously signed up via Google or Email and connected their WhatsApp number)
    const waMappingSnap = await db.doc(`whatsapp_users/${digitsOnly}`).get();
    if (waMappingSnap.exists) {
      const mappedUid = waMappingSnap.data()?.uid;
      if (mappedUid) {
        try {
          user = await authAdmin.getUser(mappedUid);
        } catch (err: any) {
          if (err.code === "auth/user-not-found") {
            console.warn(
              `[WhatsApp Auth] Mapped user ${mappedUid} was deleted in Firebase Auth. Removing orphaned link.`,
            );
            await db.doc(`whatsapp_users/${digitsOnly}`).delete();
          } else {
            console.warn(
              `[WhatsApp Auth] Mapped user ${mappedUid} not found in Firebase Auth:`,
              err.message,
            );
          }
        }
      }
    }

    // 2. If not found via WhatsApp mapping, check Firebase Auth by phone number
    if (!user) {
      try {
        user = await authAdmin.getUserByPhoneNumber(cleanPhone);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          user = await authAdmin.createUser({
            phoneNumber: cleanPhone,
          });
          isNewUser = true;
        } else {
          throw err;
        }
      }
    }

    // If the account didn't have phoneNumber set in Firebase Auth (e.g. Google user), sync it
    if (!user.phoneNumber) {
      try {
        await authAdmin.updateUser(user.uid, { phoneNumber: cleanPhone });
      } catch {
        // Ignored if phone is already claimed on another auth record
      }
    }

    // Generate Firebase Custom Token
    const customToken = await authAdmin.createCustomToken(user.uid);

    // Auto-link WhatsApp phone in Firestore for seamless WhatsApp feature integration!
    const batch = db.batch();
    batch.set(
      db.doc(`users/${user.uid}`),
      {
        phoneNumber: cleanPhone,
        whatsappPhone: digitsOnly,
      },
      { merge: true },
    );
    batch.set(
      db.doc(`whatsapp_users/${digitsOnly}`),
      {
        uid: user.uid,
        phone: digitsOnly,
        linkedAt: Date.now(),
      },
      { merge: true },
    );
    await batch.commit();

    return res.json({
      success: true,
      customToken,
      isNewUser,
    });
  } catch (err: any) {
    console.error("[WhatsApp Auth] Error verifying OTP:", err);
    return res.status(500).json({ error: "Failed to verify OTP." });
  }
});

export default router;
