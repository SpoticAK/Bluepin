import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  scoreReferralEvent,
  type ReferralEvent,
  type ReferralMilestone,
} from "./referralScorer";

/**
 * Points awarded for each milestone. Keeping the weights in one place means
 * the scorer, the runner, and any future commission mapping cannot drift.
 */
export const MILESTONE_POINTS = {
  onboarded: 1,
  glucose3days: 2,
  labReportUploaded: 2,
  whatsappLinked: 1,
  active7days: 3,
} as const;

export type MilestoneKey = keyof typeof MILESTONE_POINTS;
export type ReferralMilestones = Partial<
  Record<MilestoneKey, ReferralMilestone>
>;

export const MAX_REFERRAL_SCORE = 9;

/**
 * Re-score an event at most once per ~day. The plan asks for 23h so a nightly
 * job always finds every event eligible even with a few minutes of jitter.
 */
export const RESCORE_INTERVAL_MS = 23 * 60 * 60 * 1000;

export function calculateMilestoneScore(
  milestones: ReferralMilestones | undefined | null,
): number {
  if (!milestones) return 0;

  let score = 0;
  for (const key of Object.keys(MILESTONE_POINTS) as MilestoneKey[]) {
    if (milestones[key]) score += MILESTONE_POINTS[key];
  }
  return Math.min(score, MAX_REFERRAL_SCORE);
}

export interface ReferralScoringRunResult {
  success: true;
  processed: number;
  totalEvents: number;
  pointsAwardedTotal: number;
  newlyOnboardedTotal: number;
  skipped: number;
}

export interface ReferralTotalsRebuildResult {
  success: true;
  eventsScanned: number;
  codesUpdated: number;
}

/**
 * Rebuilds the denormalized `referral_codes` counters from `referral_events`.
 *
 * The transaction-based sweep keeps counters correct going forward, but this
 * repairs historical drift (for example, a re-run of the old seed script that
 * reset counters). Flagged events still count as signups but never contribute
 * points or qualified signups.
 */
export async function rebuildReferralCodeTotals(
  db: Firestore,
): Promise<ReferralTotalsRebuildResult> {
  const eventsSnap = await db.collection("referral_events").get();

  const totals = new Map<
    string,
    { totalSignups: number; qualifiedSignups: number; totalScore: number }
  >();

  for (const doc of eventsSnap.docs) {
    const event = doc.data() as ReferralEvent;
    if (!event.refCode) continue;

    const aggregate = totals.get(event.refCode) ?? {
      totalSignups: 0,
      qualifiedSignups: 0,
      totalScore: 0,
    };

    aggregate.totalSignups += 1;

    if (!event._disqualifyReason) {
      aggregate.totalScore += calculateMilestoneScore(event.milestones);
      if (event.milestones?.onboarded) aggregate.qualifiedSignups += 1;
    }

    totals.set(event.refCode, aggregate);
  }

  const codesSnap = await db.collection("referral_codes").get();
  let batch = db.batch();
  let ops = 0;
  let codesUpdated = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of codesSnap.docs) {
    const aggregate = totals.get(doc.id) ?? {
      totalSignups: 0,
      qualifiedSignups: 0,
      totalScore: 0,
    };

    batch.set(
      db.doc(`referral_codes/${doc.id}`),
      aggregate,
      { merge: true },
    );
    ops++;
    codesUpdated++;

    if (ops >= 400) await flush();
  }

  await flush();

  return {
    success: true,
    eventsScanned: eventsSnap.size,
    codesUpdated,
  };
}

/**
 * Progressive scoring sweep shared by the Cloud Scheduler route and the
 * admin-triggered re-score route.
 *
 * Each event is claimed inside a transaction that re-reads the document before
 * writing. That makes overlapping/retried sweeps safe: the second sweep sees
 * the milestones written by the first and awards nothing, so the denormalized
 * `referral_codes` counters cannot be incremented twice.
 */
export async function runReferralScoring(
  db: Firestore,
  options: { force?: boolean; now?: number } = {},
): Promise<ReferralScoringRunResult> {
  const force = options.force ?? false;
  const now = options.now ?? Date.now();
  const cutoff = now - RESCORE_INTERVAL_MS;

  // Non-forced sweeps only read due events. Newly attributed events use
  // lastScoredAt = 0, so they are always picked up by the first run.
  const eventsSnap = force
    ? await db.collection("referral_events").get()
    : await db
        .collection("referral_events")
        .where("lastScoredAt", "<", cutoff)
        .get();

  let processed = 0;
  let skipped = 0;
  let pointsAwardedTotal = 0;
  let newlyOnboardedTotal = 0;

  for (const doc of eventsSnap.docs) {
    const uid = doc.id;
    const snapshot = doc.data() as ReferralEvent;

    // Nothing left to earn for this user.
    if (calculateMilestoneScore(snapshot.milestones) >= MAX_REFERRAL_SCORE) {
      skipped++;
      continue;
    }

    // Defensive double-check in case the query is ever widened.
    if (!force && Number(snapshot.lastScoredAt || 0) > cutoff) {
      skipped++;
      continue;
    }

    processed++;

    // All expensive reads (profile + subcollections) happen outside the
    // transaction; the transaction only re-reads this event and its code.
    const result = await scoreReferralEvent({ ...snapshot, uid }, db);

    const applied = await db.runTransaction(async (tx) => {
      const eventRef = db.doc(`referral_events/${uid}`);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) return null;

      const current = eventSnap.data() as ReferralEvent;

      if (!force && Number(current.lastScoredAt || 0) > cutoff) return null;

      const currentMilestones: ReferralMilestones = current.milestones || {};
      if (calculateMilestoneScore(currentMilestones) >= MAX_REFERRAL_SCORE) {
        return null;
      }

      // Only apply milestones that are still missing at commit time. A
      // concurrent sweep may already have written some of them.
      const toApply: ReferralMilestones = {};
      for (const key of Object.keys(result.newMilestones) as MilestoneKey[]) {
        const milestone = result.newMilestones[key];
        if (milestone && !currentMilestones[key]) toApply[key] = milestone;
      }

      const points = calculateMilestoneScore(toApply);
      const updatedMilestones = { ...currentMilestones, ...toApply };
      const newScore = Math.min(
        MAX_REFERRAL_SCORE,
        calculateMilestoneScore(updatedMilestones),
      );
      const newlyOnboarded = Boolean(toApply.onboarded);

      // A referral code can be deleted while events still reference it.
      // Read it first so the transaction doesn't fail on a missing document.
      const codeRef = db.doc(`referral_codes/${current.refCode}`);
      const codeSnap = await tx.get(codeRef);

      tx.update(eventRef, {
        score: newScore,
        milestones: updatedMilestones,
        lastScoredAt: now,
      });

      if (points > 0 && codeSnap.exists) {
        tx.update(codeRef, {
          totalScore: FieldValue.increment(points),
          ...(newlyOnboarded
            ? { qualifiedSignups: FieldValue.increment(1) }
            : {}),
        });
      }

      return { points, newlyOnboarded };
    });

    if (applied) {
      pointsAwardedTotal += applied.points;
      if (applied.newlyOnboarded) newlyOnboardedTotal++;
    }
  }

  return {
    success: true,
    processed,
    totalEvents: eventsSnap.size,
    pointsAwardedTotal,
    newlyOnboardedTotal,
    skipped,
  };
}
