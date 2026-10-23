import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { ReferralCode } from "./referralScorer";

const APPLICANT_MAPPING_COLLECTION = "referral_applicants";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 8;

export interface ApplicantReferralResult {
  code: string;
  codeDoc: ReferralCode;
  created: boolean;
}

interface ApplicantMapping {
  email: string;
  code: string;
  applicantName: string;
  applicantAge?: number | null;
  applicantLinkedinUrl?: string | null;
  createdAt: number;
  updatedAt: number;
}

export function normalizeApplicantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeApplicantName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Accepts a LinkedIn profile URL with or without a protocol. Only LinkedIn
 * hosts and profile paths are allowed so the field cannot be used to store an
 * arbitrary link. The result is always https.
 */
export function normalizeApplicantLinkedinUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return null;
    }
    if (!/^\/(in|pub)\//i.test(url.pathname)) return null;

    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Deterministic document id for the one-code-per-email mapping. Hashing keeps
 * email addresses out of document ids and avoids characters Firestore might
 * reject in a path.
 */
export function applicantEmailKey(email: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeApplicantEmail(email))
    .digest("hex");
}

function generateCode(name: string): string {
  const prefix =
    normalizeApplicantName(name)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 10) || "BP";

  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }

  return `${prefix}${suffix}`.slice(0, 30);
}

export function buildReferralUrl(appUrl: string, code: string): string {
  const url = new URL(appUrl);
  url.searchParams.set("ref", code);
  return url.toString();
}

interface ApplicantProfileInput {
  applicantAge?: number;
  applicantLinkedinUrl?: string;
}

function profileFields(input: ApplicantProfileInput) {
  return {
    applicantAge: input.applicantAge ?? null,
    applicantLinkedinUrl: input.applicantLinkedinUrl ?? null,
  };
}

function profilePatch(input: ApplicantProfileInput): Partial<ReferralCode> {
  const patch: Partial<ReferralCode> = {};
  if (typeof input.applicantAge === "number") {
    patch.applicantAge = input.applicantAge;
  }
  if (input.applicantLinkedinUrl) {
    patch.applicantLinkedinUrl = input.applicantLinkedinUrl;
  }
  return patch;
}

function newCodeDoc(
  code: string,
  applicantName: string,
  applicantEmail: string,
  input: ApplicantProfileInput = {},
): ReferralCode {
  return {
    code,
    applicantName,
    applicantEmail,
    ...profileFields(input),
    createdAt: Date.now(),
    createdBy: "applicant-portal",
    isActive: true,
    totalSignups: 0,
    qualifiedSignups: 0,
    totalScore: 0,
  };
}

function mappingData(
  applicantName: string,
  applicantEmail: string,
  code: string,
  input: ApplicantProfileInput = {},
): ApplicantMapping {
  const now = Date.now();
  return {
    email: applicantEmail,
    code,
    applicantName,
    ...profileFields(input),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Finds a code that already belongs to this email. This covers codes created by
 * the CSV seeder or the admin panel before the applicant ever visits the portal.
 */
async function findCodeByEmail(
  db: Firestore,
  email: string,
): Promise<{ code: string; codeDoc: ReferralCode } | null> {
  const snap = await db
    .collection("referral_codes")
    .where("applicantEmail", "==", email)
    .get();

  const candidates = snap.docs
    .map((doc) => ({
      code: doc.id,
      codeDoc: doc.data() as ReferralCode,
    }))
    .sort((a, b) => {
      // Prefer an active code if an old duplicate exists, then the oldest one
      // so a repeated registration cannot move an applicant to a newer code.
      const activeDiff =
        Number(b.codeDoc.isActive === true) -
        Number(a.codeDoc.isActive === true);
      if (activeDiff !== 0) return activeDiff;
      return (
        Number(a.codeDoc.createdAt || 0) - Number(b.codeDoc.createdAt || 0)
      );
    });

  return candidates[0] ?? null;
}

/**
 * Issues a referral code for an applicant, or returns the code already assigned
 * to that email.
 *
 * Idempotency is enforced with `referral_applicants/{sha256(email)}` inside the
 * same transaction that creates the code. Concurrent submissions for the same
 * email therefore resolve to one code, and a re-submission never resets
 * counters or re-activates a code an admin has paused.
 */
export async function issueApplicantReferralCode(
  db: Firestore,
  input: ApplicantProfileInput & {
    applicantName: string;
    applicantEmail: string;
  },
): Promise<ApplicantReferralResult> {
  const applicantName = normalizeApplicantName(input.applicantName);
  const applicantEmail = normalizeApplicantEmail(input.applicantEmail);
  const mappingRef = db.doc(
    `${APPLICANT_MAPPING_COLLECTION}/${applicantEmailKey(applicantEmail)}`,
  );

  // Fast path for the common repeat-submission case.
  const mappingSnap = await mappingRef.get();
  const mapping = mappingSnap.data() as ApplicantMapping | undefined;
  if (mapping?.code) {
    const codeSnap = await db.doc(`referral_codes/${mapping.code}`).get();
    if (codeSnap.exists) {
      const codeDoc = codeSnap.data() as ReferralCode;
      const patch = profilePatch(input);
      if (Object.keys(patch).length > 0) {
        await db.doc(`referral_codes/${mapping.code}`).set(patch, { merge: true });
        Object.assign(codeDoc, patch);
      }
      return {
        code: mapping.code,
        codeDoc,
        created: false,
      };
    }
  }

  // Only query legacy/admin-created codes when there is no mapping to trust.
  const existingByEmail = mapping?.code
    ? null
    : await findCodeByEmail(db, applicantEmail);

  let preferredCode = mapping?.code ?? existingByEmail?.code ?? null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = preferredCode ?? generateCode(applicantName);

    const result = await db.runTransaction(async (tx) => {
      const mapSnap = await tx.get(mappingRef);
      const map = mapSnap.data() as ApplicantMapping | undefined;

      if (map?.code) {
        const codeRef = db.doc(`referral_codes/${map.code}`);
        const codeSnap = await tx.get(codeRef);

        if (codeSnap.exists) {
          const codeDoc = codeSnap.data() as ReferralCode;
          const patch = profilePatch(input);
          if (Object.keys(patch).length > 0) {
            tx.set(codeRef, patch, { merge: true });
            Object.assign(codeDoc, patch);
          }
          return {
            code: map.code,
            codeDoc,
            created: false,
          };
        }

        // The mapping survived but its code document was removed. Recreate the
        // same code so the applicant's existing link starts working again.
        const codeDoc = newCodeDoc(
          map.code,
          applicantName,
          applicantEmail,
          input,
        );
        tx.set(codeRef, codeDoc);
        tx.set(
          mappingRef,
          mappingData(applicantName, applicantEmail, map.code, input),
          { merge: true },
        );
        return { code: map.code, codeDoc, created: true };
      }

      const codeRef = db.doc(`referral_codes/${candidate}`);
      const codeSnap = await tx.get(codeRef);

      if (codeSnap.exists) {
        // Reusing an admin/seed code is intentional. A collision with a random
        // candidate is not, so ask the caller to retry with another suffix.
        if (preferredCode && candidate === preferredCode) {
          const codeDoc = codeSnap.data() as ReferralCode;
          const patch = profilePatch(input);
          if (Object.keys(patch).length > 0) {
            tx.set(codeRef, patch, { merge: true });
            Object.assign(codeDoc, patch);
          }
          tx.set(
            mappingRef,
            mappingData(applicantName, applicantEmail, candidate, input),
            { merge: true },
          );
          return {
            code: candidate,
            codeDoc,
            created: false,
          };
        }
        return null;
      }

      const codeDoc = newCodeDoc(
        candidate,
        applicantName,
        applicantEmail,
        input,
      );
      tx.set(codeRef, codeDoc);
      tx.set(
        mappingRef,
        mappingData(applicantName, applicantEmail, candidate, input),
        { merge: true },
      );
      return { code: candidate, codeDoc, created: true };
    });

    if (result) return result;

    preferredCode = null;
  }

  throw new Error("Could not generate a unique referral code");
}
