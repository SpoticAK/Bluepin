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

      // Verify code counter incremented
      const codeDoc = fakeDb.read("referral_codes/VALID2026");
      expect(codeDoc?.totalSignups).toBe(1);
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
