import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp } from "../test/setup";
import referralsRouter from "./referrals";

const fakeDb = new FakeFirestore();

const fakeUsers = new Map<string, {
  uid: string;
  email?: string;
  metadata: { creationTime: string };
  providerData: Array<{ providerId: string }>;
}>();

vi.mock("../config", () => ({
  config: { appUrl: "https://app.bluepin.in" },
}));

vi.mock("../firebase", () => ({
  requireAuth: (
    req: { headers: Record<string, string>; user?: unknown },
    res: { status: (c: number) => { json: (b: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.headers["x-test-uid"];
    const email = req.headers["x-test-email"];
    if (typeof uid !== "string" || !uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { uid, email };
    next();
  },
  getAdminFirestore: () => fakeDb,
  getAdminAuth: () => ({
    async getUser(uid: string) {
      const u = fakeUsers.get(uid);
      if (!u) {
        const err = new Error("User not found");
        (err as any).code = "auth/user-not-found";
        throw err;
      }
      return u;
    },
    async getUsers(identifiers: Array<{ uid: string }>) {
      const users = identifiers
        .map(({ uid }) => fakeUsers.get(uid))
        .filter((user): user is NonNullable<typeof user> => Boolean(user));
      return { users, notFound: [] };
    },
  }),
}));

describe("Referrals API Routes", () => {
  const app = buildApp(referralsRouter);

  beforeEach(() => {
    fakeDb.clear();
    fakeUsers.clear();
  });

  describe("POST /referrals/attribute", () => {
    it("rejects unauthorized requests without auth header", async () => {
      const res = await request(app)
        .post("/api/referrals/attribute")
        .send({ refCode: "TEST2026" });
      expect(res.status).toBe(401);
    });

    it("rejects requests with missing referral code", async () => {
      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 if referral code does not exist", async () => {
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "newbie@test.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({ refCode: "DOESNOTEXIST" });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain("does not exist");
    });

    it("returns 400 if referral code is inactive", async () => {
      fakeDb.seed({
        "referral_codes/INACTIVE": {
          code: "INACTIVE",
          applicantName: "Inactive Candidate",
          isActive: false,
          totalSignups: 0,
        },
      });
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "newbie@test.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({ refCode: "INACTIVE" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("inactive");
    });

    it("returns 400 if account was created > 10 minutes ago", async () => {
      fakeDb.seed({
        "referral_codes/VALID2026": {
          code: "VALID2026",
          applicantName: "Valid Candidate",
          isActive: true,
          totalSignups: 0,
        },
      });
      // 20 minutes ago
      const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      fakeUsers.set("oldie-1", {
        uid: "oldie-1",
        email: "oldie@test.com",
        metadata: { creationTime: oldTime },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "oldie-1")
        .send({ refCode: "VALID2026" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ACCOUNT_NOT_NEW");
    });

    it("successfully attributes a new user and increments totalSignups", async () => {
      fakeDb.seed({
        "referral_codes/VALID2026": {
          code: "VALID2026",
          applicantName: "Valid Candidate",
          isActive: true,
          totalSignups: 0,
        },
      });
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "newbie@gmail.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({ refCode: "valid2026" }); // testing uppercase normalization

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refCode).toBe("VALID2026");
      expect(res.body.alreadyAttributed).toBe(false);

      // Verify referral_events document in DB
      const eventDoc = fakeDb.read("referral_events/newbie-1");
      expect(eventDoc).toBeDefined();
      expect(eventDoc?.refCode).toBe("VALID2026");
      expect(eventDoc?.score).toBe(0);
      expect(eventDoc?.referredEmail).toBe("newbie@gmail.com");

      // Verify code counter incremented
      const codeDoc = fakeDb.read("referral_codes/VALID2026");
      expect(codeDoc?.totalSignups).toBe(1);
    });

    it("rejects disposable email domains", async () => {
      fakeDb.seed({
        "referral_codes/VALID2026": {
          code: "VALID2026",
          applicantName: "Valid Candidate",
          isActive: true,
          totalSignups: 0,
        },
      });
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "someone@mailinator.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({ refCode: "VALID2026" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("DISPOSABLE_EMAIL");
      expect(fakeDb.read("referral_events/newbie-1")).toBeUndefined();
    });

    it("flags the signup when too many accounts share an IP hash", async () => {
      const ip = "1.2.3.4";
      const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
      const now = Date.now();

      fakeDb.seed({
        "referral_codes/VALID2026": {
          code: "VALID2026",
          applicantName: "Valid Candidate",
          isActive: true,
          totalSignups: 4,
        },
      });
      for (let i = 0; i < 4; i++) {
        fakeDb.seed({
          [`referral_events/existing-${i}`]: {
            uid: `existing-${i}`,
            refCode: "VALID2026",
            attributedAt: now - i * 1000,
            _ipHash: ipHash,
          },
        });
      }
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "newbie@gmail.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .set("x-forwarded-for", ip)
        .send({ refCode: "VALID2026" });

      expect(res.status).toBe(200);
      expect(fakeDb.read("referral_events/newbie-1")?._disqualifyReason).toBe(
        "ip_cluster",
      );
    });

    it("is idempotent: returns alreadyAttributed: true on subsequent calls", async () => {
      fakeDb.seed({
        "referral_codes/VALID2026": {
          code: "VALID2026",
          applicantName: "Valid Candidate",
          isActive: true,
          totalSignups: 1,
        },
        "referral_events/newbie-1": {
          uid: "newbie-1",
          refCode: "VALID2026",
          attributedAt: Date.now(),
          score: 0,
        },
      });
      fakeUsers.set("newbie-1", {
        uid: "newbie-1",
        email: "newbie@gmail.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .post("/api/referrals/attribute")
        .set("x-test-uid", "newbie-1")
        .send({ refCode: "VALID2026" });

      expect(res.status).toBe(200);
      expect(res.body.alreadyAttributed).toBe(true);
      // Counter should NOT have incremented again
      const codeDoc = fakeDb.read("referral_codes/VALID2026");
      expect(codeDoc?.totalSignups).toBe(1);
    });
  });

  describe("POST /referrals/applicant", () => {
    const emailKey = (email: string) =>
      crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

    it("creates an active code, stores the email mapping, and returns the app link", async () => {
      const res = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Priya Sharma",
          applicantEmail: "Priya@Example.com",
          applicantAge: 29,
          applicantLinkedinUrl: "linkedin.com/in/priya-sharma",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toMatch(/^[A-Z0-9_-]{2,30}$/);
      expect(res.body.code.startsWith("PRIYA")).toBe(true);
      expect(res.body.created).toBe(true);
      expect(res.body.reused).toBe(false);
      expect(res.body.isActive).toBe(true);
      expect(res.body.applicantEmail).toBe("priya@example.com");
      expect(res.body.applicantAge).toBe(29);
      expect(res.body.applicantLinkedinUrl).toBe(
        "https://linkedin.com/in/priya-sharma",
      );
      expect(res.body.referralUrl).toBe(
        `https://app.bluepin.in/?ref=${res.body.code}`,
      );

      const saved = fakeDb.read(`referral_codes/${res.body.code}`);
      expect(saved).toMatchObject({
        code: res.body.code,
        applicantName: "Priya Sharma",
        applicantEmail: "priya@example.com",
        applicantAge: 29,
        applicantLinkedinUrl: "https://linkedin.com/in/priya-sharma",
        createdBy: "applicant-portal",
        isActive: true,
        totalSignups: 0,
        qualifiedSignups: 0,
        totalScore: 0,
      });

      const mapping = fakeDb.read(
        `referral_applicants/${emailKey("priya@example.com")}`,
      );
      expect(mapping?.code).toBe(res.body.code);

      // Applicants are not referred users; they must not create events.
      expect(fakeDb.read("referral_events/priya")).toBeUndefined();
    });

    it("returns the same code for the same email in any case or whitespace", async () => {
      const first = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Priya Sharma",
          applicantEmail: "Priya@Example.com",
        });

      const second = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Priya S.",
          applicantEmail: "  priya@example.com  ",
        });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.code).toBe(first.body.code);
      expect(second.body.created).toBe(false);
      expect(second.body.reused).toBe(true);

      const codes = await fakeDb.collection("referral_codes").get();
      expect(codes.size).toBe(1);
    });

    it("reuses a seeded/admin-created code without resetting its counters", async () => {
      fakeDb.seed({
        "referral_codes/SEEDED42": {
          code: "SEEDED42",
          applicantName: "Seed Candidate",
          applicantEmail: "seed@example.com",
          createdAt: 123,
          createdBy: "import-script",
          isActive: true,
          totalSignups: 7,
          qualifiedSignups: 3,
          totalScore: 5,
        },
      });

      const res = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Seed Candidate",
          applicantEmail: "SEED@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe("SEEDED42");
      expect(res.body.created).toBe(false);
      expect(res.body.reused).toBe(true);

      const saved = fakeDb.read("referral_codes/SEEDED42");
      expect(saved?.totalSignups).toBe(7);
      expect(saved?.qualifiedSignups).toBe(3);
      expect(saved?.totalScore).toBe(5);
      expect(saved?.isActive).toBe(true);

      const mapping = fakeDb.read(
        `referral_applicants/${emailKey("seed@example.com")}`,
      );
      expect(mapping?.code).toBe("SEEDED42");
    });

    it("returns the existing code as inactive if an admin paused it", async () => {
      fakeDb.seed({
        "referral_codes/PAUSED42": {
          code: "PAUSED42",
          applicantName: "Paused Candidate",
          applicantEmail: "paused@example.com",
          createdAt: 123,
          createdBy: "admin",
          isActive: false,
          totalSignups: 2,
          qualifiedSignups: 1,
          totalScore: 1,
        },
      });

      const res = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Paused Candidate",
          applicantEmail: "paused@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe("PAUSED42");
      expect(res.body.isActive).toBe(false);
      expect(fakeDb.read("referral_codes/PAUSED42")?.isActive).toBe(false);
      expect(fakeDb.read("referral_codes/PAUSED42")?.totalSignups).toBe(2);
    });

    it("rejects missing or invalid applicant details", async () => {
      const missingName = await request(app)
        .post("/api/referrals/applicant")
        .send({ applicantEmail: "candidate@example.com" });
      expect(missingName.status).toBe(400);

      const invalidEmail = await request(app)
        .post("/api/referrals/applicant")
        .send({ applicantName: "Candidate", applicantEmail: "not-an-email" });
      expect(invalidEmail.status).toBe(400);

      const disposable = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Candidate",
          applicantEmail: "candidate@mailinator.com",
        });
      expect(disposable.status).toBe(400);
      expect(disposable.body.code).toBe("DISPOSABLE_EMAIL");
    });

    it("rejects invalid age and non-LinkedIn profile URLs", async () => {
      const invalidAge = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Candidate",
          applicantEmail: "candidate@example.com",
          applicantAge: 12,
        });
      expect(invalidAge.status).toBe(400);

      const invalidAgeType = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Candidate",
          applicantEmail: "candidate@example.com",
          applicantAge: "twenty",
        });
      expect(invalidAgeType.status).toBe(400);

      const invalidLinkedin = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Candidate",
          applicantEmail: "candidate@example.com",
          applicantLinkedinUrl: "https://example.com/in/candidate",
        });
      expect(invalidLinkedin.status).toBe(400);

      const nonProfileLinkedin = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Candidate",
          applicantEmail: "candidate@example.com",
          applicantLinkedinUrl: "https://linkedin.com/company/bluepin",
        });
      expect(nonProfileLinkedin.status).toBe(400);
      expect(fakeDb.read("referral_events/candidate")).toBeUndefined();
    });

    it("adds profile details when a pre-seeded code is first claimed", async () => {
      fakeDb.seed({
        "referral_codes/SEEDED99": {
          code: "SEEDED99",
          applicantName: "Seed Candidate",
          applicantEmail: "seed99@example.com",
          createdAt: 123,
          createdBy: "import-script",
          isActive: true,
          totalSignups: 4,
          qualifiedSignups: 2,
          totalScore: 3,
        },
      });

      const res = await request(app)
        .post("/api/referrals/applicant")
        .send({
          applicantName: "Seed Candidate",
          applicantEmail: "seed99@example.com",
          applicantAge: 41,
          applicantLinkedinUrl: "https://www.linkedin.com/in/seed-candidate/",
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe("SEEDED99");
      expect(res.body.reused).toBe(true);

      const saved = fakeDb.read("referral_codes/SEEDED99");
      expect(saved?.totalSignups).toBe(4);
      expect(saved?.qualifiedSignups).toBe(2);
      expect(saved?.totalScore).toBe(3);
      expect(saved?.isActive).toBe(true);
      expect(saved?.applicantAge).toBe(41);
      expect(saved?.applicantLinkedinUrl).toBe(
        "https://www.linkedin.com/in/seed-candidate/",
      );
    });

    it("accepts the shorter name/email field aliases used by forms", async () => {
      const res = await request(app)
        .post("/api/referrals/applicant")
        .send({ name: "Alias Candidate", email: "alias@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.code).toMatch(/^ALIAS/);
      expect(res.body.applicantEmail).toBe("alias@example.com");
    });
  });

  describe("Admin Routes", () => {
    it("forbids non-admin users from accessing admin summary", async () => {
      const res = await request(app)
        .get("/api/referrals/admin/summary")
        .set("x-test-uid", "regular-user")
        .set("x-test-email", "regular@example.com");
      expect(res.status).toBe(403);
    });

    it("allows sparsh@bluepin.in to access admin summary", async () => {
      fakeDb.seed({
        "referral_codes/CODE1": {
          code: "CODE1",
          applicantName: "Candidate 1",
          totalScore: 10,
        },
      });

      const res = await request(app)
        .get("/api/referrals/admin/summary")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.codes).toBeInstanceOf(Array);
      expect(res.body.codes.length).toBe(1);
    });

    it("forbids users without referral access from triggering a re-score", async () => {
      const res = await request(app)
        .post("/api/referrals/admin/rescore")
        .set("x-test-uid", "regular-user")
        .set("x-test-email", "regular@example.com");
      expect(res.status).toBe(403);
    });

    it("re-scores referrals for admins without double-counting", async () => {
      fakeDb.seed({
        "referral_codes/CODE1": {
          code: "CODE1",
          applicantName: "Candidate 1",
          isActive: true,
          totalSignups: 1,
          qualifiedSignups: 0,
          totalScore: 0,
        },
        "referral_events/u1": {
          uid: "u1",
          refCode: "CODE1",
          attributedAt: Date.now(),
          signupMethod: "Email",
          lastScoredAt: 0,
          score: 0,
          milestones: {},
        },
        "users/u1": { name: "Aarav Sharma" },
      });

      const first = await request(app)
        .post("/api/referrals/admin/rescore")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in");

      expect(first.status).toBe(200);
      expect(first.body.pointsAwardedTotal).toBe(1);
      expect(fakeDb.read("referral_events/u1")?.score).toBe(1);
      expect(fakeDb.read("referral_codes/CODE1")?.totalScore).toBe(1);
      expect(fakeDb.read("referral_codes/CODE1")?.qualifiedSignups).toBe(1);

      // A second forced sweep must not award the same milestone twice.
      const second = await request(app)
        .post("/api/referrals/admin/rescore")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in");

      expect(second.status).toBe(200);
      expect(second.body.pointsAwardedTotal).toBe(0);
      expect(fakeDb.read("referral_codes/CODE1")?.totalScore).toBe(1);
      expect(fakeDb.read("referral_codes/CODE1")?.qualifiedSignups).toBe(1);
    });

    it("rebuilds denormalized code totals from events", async () => {
      const now = Date.now();
      fakeDb.seed({
        "referral_codes/CODE1": {
          code: "CODE1",
          applicantName: "Candidate 1",
          isActive: true,
          totalSignups: 99,
          qualifiedSignups: 99,
          totalScore: 99,
        },
        "referral_events/u1": {
          uid: "u1",
          refCode: "CODE1",
          attributedAt: now,
          milestones: {
            onboarded: { achievedAt: now },
            whatsappLinked: { achievedAt: now },
          },
        },
        "referral_events/u2": {
          uid: "u2",
          refCode: "CODE1",
          attributedAt: now,
          milestones: { glucose3days: { achievedAt: now } },
        },
        "referral_events/u3": {
          uid: "u3",
          refCode: "CODE1",
          attributedAt: now,
          _disqualifyReason: "ip_cluster",
          milestones: { onboarded: { achievedAt: now } },
        },
      });

      const res = await request(app)
        .post("/api/referrals/admin/rebuild-totals")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ eventsScanned: 3, codesUpdated: 1 });

      const code = fakeDb.read("referral_codes/CODE1");
      expect(code?.totalSignups).toBe(3);
      expect(code?.qualifiedSignups).toBe(1);
      expect(code?.totalScore).toBe(4);
    });

    it("hides server-only telemetry in the code breakdown", async () => {
      fakeDb.seed({
        "referral_codes/CODE1": {
          code: "CODE1",
          applicantName: "Candidate 1",
          totalScore: 3,
        },
        "referral_events/u1": {
          uid: "u1",
          refCode: "CODE1",
          attributedAt: Date.now(),
          score: 1,
          milestones: {},
          _ipHash: "hash",
          _userAgent: "test-agent",
        },
        "users/u1": { name: "Aarav Sharma" },
      });
      fakeUsers.set("u1", {
        uid: "u1",
        email: "aarav@example.com",
        metadata: { creationTime: new Date().toISOString() },
        providerData: [{ providerId: "password" }],
      });

      const res = await request(app)
        .get("/api/referrals/admin/summary?code=CODE1")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in");

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].displayName).toBe("Aarav Sharma");
      // Older events without referredEmail resolve it from Firebase Auth.
      expect(res.body.events[0].referredEmail).toBe("aarav@example.com");
      expect(res.body.events[0]._ipHash).toBeUndefined();
      expect(res.body.events[0]._userAgent).toBeUndefined();
    });

    it("allows creating a new code for admin", async () => {
      const res = await request(app)
        .post("/api/referrals/admin/codes")
        .set("x-test-uid", "admin-1")
        .set("x-test-email", "sparsh@bluepin.in")
        .send({
          code: "NEWAPPLICANT",
          applicantName: "New Candidate",
          applicantEmail: "candidate@test.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code.code).toBe("NEWAPPLICANT");

      const saved = fakeDb.read("referral_codes/NEWAPPLICANT");
      expect(saved).toBeDefined();
      expect(saved?.applicantName).toBe("New Candidate");
    });
  });
});
