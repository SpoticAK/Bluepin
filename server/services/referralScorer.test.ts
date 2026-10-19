import { describe, expect, it } from "vitest";
import { FakeFirestore } from "../test/fakeFirestore";
import { scoreReferralEvent, type ReferralEvent } from "./referralScorer";

describe("referralScorer service", () => {
  it("returns 0 points if user has no profile or activity", async () => {
    const fakeDb = new FakeFirestore();
    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    expect(result.pointsEarned).toBe(0);
    expect(result.newTotalScore).toBe(0);
    expect(result.isNewlyOnboarded).toBe(false);
  });

  it("awards 1 point when onboarding (profile name) is completed", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1": { name: "Aarav Sharma" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    expect(result.pointsEarned).toBe(1);
    expect(result.newTotalScore).toBe(1);
    expect(result.isNewlyOnboarded).toBe(true);
    expect(result.newMilestones.onboarded).toBeDefined();
  });

  it("does not re-award onboarding point if already earned", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1": { name: "Aarav Sharma" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: Date.now() - 10000,
      score: 1,
      milestones: {
        onboarded: { achievedAt: Date.now() - 10000 },
      },
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    expect(result.pointsEarned).toBe(0);
    expect(result.newTotalScore).toBe(1);
    expect(result.isNewlyOnboarded).toBe(false);
  });

  it("awards 2 points for logging glucose on 3 distinct days", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1": { name: "Aarav Sharma" },
      "users/user-1/glucoseReadings/r1": { date: "2026-10-10" },
      "users/user-1/glucoseReadings/r2": { date: "2026-10-10" }, // duplicate day
      "users/user-1/glucoseReadings/r3": { date: "2026-10-11" },
      "users/user-1/glucoseReadings/r4": { date: "2026-10-12" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    // Onboarding (+1) + Glucose 3 days (+2) = 3
    expect(result.pointsEarned).toBe(3);
    expect(result.newTotalScore).toBe(3);
    expect(result.newMilestones.glucose3days).toBeDefined();
  });

  it("awards 2 points when a lab report is uploaded", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1/labReports/rep1": { date: "2026-10-15" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    expect(result.pointsEarned).toBe(2);
    expect(result.newMilestones.labReportUploaded).toBeDefined();
  });

  it("awards 1 point when whatsapp is linked", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1": { whatsappPhone: "919876543210" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    expect(result.pointsEarned).toBe(1);
    expect(result.newMilestones.whatsappLinked).toBeDefined();
  });

  it("awards max score (9 points) when all 5 milestones are completed", async () => {
    const fakeDb = new FakeFirestore();
    fakeDb.seed({
      "users/user-1": { name: "Aarav Sharma", whatsappPhone: "919876543210" },
      "users/user-1/glucoseReadings/r1": { date: "2026-10-01" },
      "users/user-1/glucoseReadings/r2": { date: "2026-10-02" },
      "users/user-1/glucoseReadings/r3": { date: "2026-10-03" },
      "users/user-1/glucoseReadings/r4": { date: "2026-10-04" },
      "users/user-1/glucoseReadings/r5": { date: "2026-10-05" },
      "users/user-1/glucoseReadings/r6": { date: "2026-10-06" },
      "users/user-1/labReports/rep1": { date: "2026-10-07" },
    });

    const event: ReferralEvent = {
      uid: "user-1",
      refCode: "TESTCODE",
      attributedAt: Date.now(),
      signupMethod: "Email",
      lastScoredAt: 0,
      score: 0,
      milestones: {},
    };

    const result = await scoreReferralEvent(event, fakeDb as any);
    // Onboarding (1) + WhatsApp (1) + Glucose3days (2) + LabReport (2) + Active7days (3) = 9
    expect(result.pointsEarned).toBe(9);
    expect(result.newTotalScore).toBe(9);
    expect(result.newMilestones.onboarded).toBeDefined();
    expect(result.newMilestones.whatsappLinked).toBeDefined();
    expect(result.newMilestones.glucose3days).toBeDefined();
    expect(result.newMilestones.labReportUploaded).toBeDefined();
    expect(result.newMilestones.active7days).toBeDefined();
  });
});
