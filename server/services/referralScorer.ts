import type { Firestore } from "firebase-admin/firestore";

export interface ReferralMilestone {
  achievedAt: number;
}

export interface ReferralEvent {
  uid: string;
  refCode: string;
  /** Email of the referred user (shown to referral viewers/admins). */
  referredEmail?: string | null;
  attributedAt: number;
  signupMethod: "Email" | "Google";
  lastScoredAt: number;
  score: number;
  milestones: {
    onboarded?: ReferralMilestone;
    glucose3days?: ReferralMilestone;
    labReportUploaded?: ReferralMilestone;
    whatsappLinked?: ReferralMilestone;
    active7days?: ReferralMilestone;
  };
  _ipHash?: string;
  _userAgent?: string;
  _disqualifyReason?: string;
}

export interface ReferralCode {
  code: string;
  applicantName: string;
  applicantEmail: string | null;
  createdAt: number;
  createdBy: string;
  isActive: boolean;
  totalSignups: number;
  qualifiedSignups: number;
  totalScore: number;
}

export interface ScoreCalculationResult {
  pointsEarned: number;
  newMilestones: Partial<ReferralEvent["milestones"]>;
  newTotalScore: number;
  isNewlyOnboarded: boolean;
}

/**
 * Evaluates user activity milestones against their profile and logs in Firestore.
 * This function only READS user data; it never mutates user documents.
 */
export async function scoreReferralEvent(
  event: ReferralEvent,
  db: Firestore,
): Promise<ScoreCalculationResult> {
  const currentMilestones = event.milestones || {};
  const newMilestones: Partial<ReferralEvent["milestones"]> = {};
  let pointsEarned = 0;
  const now = Date.now();
  let isNewlyOnboarded = false;

  // Accounts flagged by anti-abuse checks never earn points. The event is kept
  // so the admin UI can still show the signup and the reason it was flagged.
  if (event._disqualifyReason) {
    return {
      pointsEarned: 0,
      newMilestones: {},
      newTotalScore: Number(event.score || 0),
      isNewlyOnboarded: false,
    };
  }

  // 1. Fetch user profile
  const userRef = db.doc(`users/${event.uid}`);
  const userSnap = await userRef.get();
  const profile = userSnap.exists ? userSnap.data() : null;

  // Milestone 1: Onboarding completed (+1)
  // useSession.ts treats a non-empty name as onboarded
  if (!currentMilestones.onboarded && profile?.name && typeof profile.name === "string" && profile.name.trim().length > 0) {
    newMilestones.onboarded = { achievedAt: now };
    pointsEarned += 1;
    isNewlyOnboarded = true;
  }

  // Milestone 4: WhatsApp connected (+1)
  if (!currentMilestones.whatsappLinked && profile?.whatsappPhone && typeof profile.whatsappPhone === "string" && profile.whatsappPhone.trim().length > 0) {
    newMilestones.whatsappLinked = { achievedAt: now };
    pointsEarned += 1;
  }

  // Determine if we need glucose readings or lab reports
  const needsGlucose = !currentMilestones.glucose3days || !currentMilestones.active7days;
  const needsLabReports = !currentMilestones.labReportUploaded || !currentMilestones.active7days;

  let glucoseDates: string[] = [];
  if (needsGlucose) {
    try {
      const readingsSnap = await db.collection(`users/${event.uid}/glucoseReadings`).select("date").get();
      glucoseDates = readingsSnap.docs.map((d) => d.data().date).filter((d): d is string => typeof d === "string" && !!d);
    } catch (err) {
      console.warn(`[ReferralScorer] Failed to query glucoseReadings for ${event.uid}:`, err);
    }
  }

  // Milestone 2: Glucose logged 3 distinct days (+2)
  if (!currentMilestones.glucose3days) {
    const distinctGlucoseDays = new Set(glucoseDates);
    if (distinctGlucoseDays.size >= 3) {
      newMilestones.glucose3days = { achievedAt: now };
      pointsEarned += 2;
    }
  }

  let labReportDates: string[] = [];
  if (needsLabReports) {
    try {
      const reportsSnap = await db.collection(`users/${event.uid}/labReports`).select("date").get();
      if (!reportsSnap.empty) {
        if (!currentMilestones.labReportUploaded) {
          newMilestones.labReportUploaded = { achievedAt: now };
          pointsEarned += 2;
        }
        labReportDates = reportsSnap.docs.map((d) => d.data().date).filter((d): d is string => typeof d === "string" && !!d);
      }
    } catch (err) {
      console.warn(`[ReferralScorer] Failed to query labReports for ${event.uid}:`, err);
    }
  }

  // Milestone 5: Active on 7 distinct days (+3)
  if (!currentMilestones.active7days) {
    const allActivityDays = new Set([...glucoseDates, ...labReportDates]);
    if (allActivityDays.size >= 7) {
      newMilestones.active7days = { achievedAt: now };
      pointsEarned += 3;
    }
  }

  const currentScore = Number(event.score || 0);
  const newTotalScore = currentScore + pointsEarned;

  return {
    pointsEarned,
    newMilestones,
    newTotalScore,
    isNewlyOnboarded,
  };
}
