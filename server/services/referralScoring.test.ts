import { describe, expect, it } from "vitest";
import { FakeFirestore } from "../test/fakeFirestore";
import { runReferralScoring } from "./referralScoring";

function seedCode(db: FakeFirestore) {
  db.seed({
    "referral_codes/CODE1": {
      code: "CODE1",
      applicantName: "Candidate",
      isActive: true,
      totalSignups: 2,
      qualifiedSignups: 0,
      totalScore: 0,
    },
  });
}

describe("runReferralScoring", () => {
  it("only processes events outside the re-score window", async () => {
    const db = new FakeFirestore();
    const now = Date.now();
    seedCode(db);
    db.seed({
      "referral_events/due": {
        uid: "due",
        refCode: "CODE1",
        attributedAt: now - 60_000,
        lastScoredAt: 0,
        score: 0,
        milestones: {},
      },
      "referral_events/recent": {
        uid: "recent",
        refCode: "CODE1",
        attributedAt: now - 60_000,
        lastScoredAt: now - 1_000,
        score: 0,
        milestones: {},
      },
      "users/due": { name: "Due User" },
      "users/recent": { name: "Recent User" },
    });

    const result = await runReferralScoring(db as any, { now });

    expect(result.processed).toBe(1);
    expect(result.pointsAwardedTotal).toBe(1);
    expect(db.read("referral_events/due")?.score).toBe(1);
    expect(db.read("referral_events/recent")?.lastScoredAt).toBe(now - 1_000);
    expect(db.read("referral_codes/CODE1")?.totalScore).toBe(1);
  });

  it("does not re-award milestones or counters on a forced re-run", async () => {
    const db = new FakeFirestore();
    const now = Date.now();
    seedCode(db);
    db.seed({
      "referral_events/u1": {
        uid: "u1",
        refCode: "CODE1",
        attributedAt: now - 60_000,
        lastScoredAt: 0,
        score: 0,
        milestones: {},
      },
      "users/u1": { name: "Aarav Sharma" },
    });

    const first = await runReferralScoring(db as any, { force: true, now });
    const second = await runReferralScoring(db as any, { force: true, now });

    expect(first.pointsAwardedTotal).toBe(1);
    expect(second.pointsAwardedTotal).toBe(0);
    expect(db.read("referral_events/u1")?.score).toBe(1);
    expect(db.read("referral_codes/CODE1")?.totalScore).toBe(1);
    expect(db.read("referral_codes/CODE1")?.qualifiedSignups).toBe(1);
  });

  it("skips events that already have the maximum score", async () => {
    const db = new FakeFirestore();
    const now = Date.now();
    seedCode(db);
    db.seed({
      "referral_events/maxed": {
        uid: "maxed",
        refCode: "CODE1",
        attributedAt: now - 60_000,
        lastScoredAt: 0,
        score: 9,
        milestones: {
          onboarded: { achievedAt: now },
          glucose3days: { achievedAt: now },
          labReportUploaded: { achievedAt: now },
          whatsappLinked: { achievedAt: now },
          active7days: { achievedAt: now },
        },
      },
      "users/maxed": { name: "Maxed User" },
    });

    const result = await runReferralScoring(db as any, { force: true, now });

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
