import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, installFetchStub } from "../test/setup";
import authRouter from "./auth";

const fakeDb = new FakeFirestore();

/** Minimal Firebase Auth stand-in: users keyed by uid. */
const fakeUsers = new Map<string, { uid: string; phoneNumber?: string }>();
const notFound = () => {
  const err = new Error("user not found") as Error & { code: string };
  err.code = "auth/user-not-found";
  throw err;
};

vi.mock("../firebase", () => ({
  requireAuth: (
    req: { headers: Record<string, string>; user?: unknown },
    res: { status: (c: number) => { json: (b: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.headers["x-test-uid"];
    if (typeof uid !== "string" || !uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { uid };
    next();
  },
  getAdminFirestore: () => fakeDb,
  getAdminAuth: () => ({
    async getUser(uid: string) {
      const u = fakeUsers.get(uid);
      if (!u) notFound();
      return u;
    },
    async getUserByPhoneNumber(phone: string) {
      const u = [...fakeUsers.values()].find((x) => x.phoneNumber === phone);
      if (!u) notFound();
      return u;
    },
    async createUser({ phoneNumber }: { phoneNumber: string }) {
      const uid = `uid-${fakeUsers.size + 1}`;
      const u = { uid, phoneNumber };
      fakeUsers.set(uid, u);
      return u;
    },
    async updateUser(uid: string, patch: { phoneNumber: string }) {
      const u = fakeUsers.get(uid);
      if (!u) notFound();
      Object.assign(u, patch);
      return u;
    },
    async createCustomToken(uid: string) {
      return `custom-token-for-${uid}`;
    },
  }),
  getAdminApp: () => ({}),
}));

// Fixed OTP so verify tests are deterministic; delivery still runs the real client.
vi.mock("../services/whatsapp/utils", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/whatsapp/utils")>();
  return { ...real, generateNumericCode: () => "123456" };
});

const PHONE = "911234567890";

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  fakeUsers.clear();
  vi.clearAllMocks();
  process.env.WHATSAPP_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "999888777";
  delete process.env.WHATSAPP_OTP_TEMPLATE_NAME; // exercise the text fallback
});

const app = () => buildApp(authRouter);

describe("POST /auth/whatsapp/send-otp", () => {
  it("validates the phone number", async () => {
    const missing = await request(app()).post("/api/auth/whatsapp/send-otp").send({});
    expect(missing.status).toBe(400);
    const invalid = await request(app())
      .post("/api/auth/whatsapp/send-otp")
      .send({ phone: "not-a-number" });
    expect(invalid.status).toBe(400);
  });

  it("sends and stores only an HMAC — never the code", async () => {
    const res = await request(app())
      .post("/api/auth/whatsapp/send-otp")
      .send({ phone: PHONE });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, expiresIn: 300 });

    const stored = fakeDb.read(`whatsapp_otps/${PHONE}`)!;
    expect(stored.attempts).toBe(0);
    expect(typeof stored.otpHash).toBe("string");
    expect(stored.otpHash).not.toBe("123456");
    // No field holds the code itself (the phone number merely contains those digits).
    expect(Object.values(stored).filter((v) => v === "123456")).toHaveLength(0);
  });

  it("enforces the 30s resend cooldown", async () => {
    await request(app()).post("/api/auth/whatsapp/send-otp").send({ phone: PHONE });
    const res = await request(app()).post("/api/auth/whatsapp/send-otp").send({ phone: PHONE });
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });
});

describe("POST /auth/whatsapp/verify-otp", () => {
  async function sendOtp() {
    const res = await request(app()).post("/api/auth/whatsapp/send-otp").send({ phone: PHONE });
    expect(res.status).toBe(200);
  }

  it("rejects verification with no pending OTP", async () => {
    const res = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("auth/code-expired");
  });

  it("counts wrong attempts and locks out after 5", async () => {
    await sendOtp();
    for (let i = 1; i <= 5; i++) {
      const res = await request(app())
        .post("/api/auth/whatsapp/verify-otp")
        .send({ phone: PHONE, otp: "000000" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(`${5 - i} attempt(s) remaining`);
    }
    const locked = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "000000" });
    expect(locked.status).toBe(429);
    // Correct code no longer works after lockout (doc deleted).
    const after = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "123456" });
    expect(after.status).toBe(400);
  });

  it("rejects an expired code and clears it", async () => {
    await sendOtp();
    fakeDb.seed({
      [`whatsapp_otps/${PHONE}`]: {
        ...(fakeDb.read(`whatsapp_otps/${PHONE}`) as Record<string, unknown>),
        expiresAt: Date.now() - 1000,
      },
    });
    const res = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("auth/code-expired");
    expect(fakeDb.read(`whatsapp_otps/${PHONE}`)).toBeUndefined();
  });

  it("mints a custom token and auto-links on the correct code", async () => {
    await sendOtp();
    const res = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "123456" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, isNewUser: true });
    expect(res.body.customToken).toBe("custom-token-for-uid-1");

    // Single-use: OTP doc consumed.
    expect(fakeDb.read(`whatsapp_otps/${PHONE}`)).toBeUndefined();
    // Auto-link written on both sides.
    expect(fakeDb.read("users/uid-1")).toMatchObject({ whatsappPhone: PHONE });
    expect(fakeDb.read(`whatsapp_users/${PHONE}`)).toMatchObject({ uid: "uid-1" });
  });

  it("reuses the mapped account for a returning user", async () => {
    fakeUsers.set("uid-9", { uid: "uid-9", phoneNumber: `+${PHONE}` });
    fakeDb.seed({ [`whatsapp_users/${PHONE}`]: { uid: "uid-9", phone: PHONE } });
    await sendOtp();
    const res = await request(app())
      .post("/api/auth/whatsapp/verify-otp")
      .send({ phone: PHONE, otp: "123456" });
    expect(res.body).toMatchObject({ success: true, isNewUser: false });
    expect(res.body.customToken).toBe("custom-token-for-uid-9");
  });
});
