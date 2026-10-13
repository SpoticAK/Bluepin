import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, installFetchStub } from "../test/setup";
import notificationsRouter from "./notifications";

const fakeDb = new FakeFirestore();

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
  getAdminAuth: () => ({}),
  getAdminApp: () => ({}),
}));

const UID = "u1";
const auth = { "x-test-uid": UID };
const TOKEN = "fcm-test-token-0123456789abcdef";

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
});

const app = () => buildApp(notificationsRouter);

describe("GET /notifications/push", () => {
  it("reports defaults for a user with nothing stored", async () => {
    fakeDb.seed({ [`users/${UID}`]: { name: "T" } });
    const res = await request(app()).get("/api/notifications/push").set(auth);
    expect(res.body).toMatchObject({
      pushEnabled: false,
      tokenCount: 0,
      reminderHour: null,
      reminderLinked: false,
    });
  });

  it("reads the phone-linked reminder and counts tokens", async () => {
    fakeDb.seed({
      [`users/${UID}`]: { whatsappPhone: "911234567890" },
      "whatsapp_reminders/911234567890": {
        pushEnabled: true,
        reminderHour: 8,
      },
      [`users/${UID}/fcmTokens/tok1`]: { token: "a" },
      [`users/${UID}/fcmTokens/tok2`]: { token: "b" },
    });
    const res = await request(app()).get("/api/notifications/push").set(auth);
    expect(res.body).toMatchObject({
      pushEnabled: true,
      tokenCount: 2,
      reminderHour: 8,
      reminderLinked: true,
    });
  });
});

describe("POST /notifications/push", () => {
  it("rejects malformed tokens", async () => {
    for (const token of ["short", "", 12345, "x".repeat(5000)]) {
      const res = await request(app()).post("/api/notifications/push").set(auth).send({ token });
      expect(res.status).toBe(400);
    }
  });

  it("registers idempotently under a token-derived doc id", async () => {
    const first = await request(app()).post("/api/notifications/push").set(auth).send({ token: TOKEN });
    expect(first.body).toMatchObject({ success: true });
    const second = await request(app()).post("/api/notifications/push").set(auth).send({ token: TOKEN });
    expect(second.body).toMatchObject({ success: true });
    expect(fakeDb.read(`users/${UID}/fcmTokens/${TOKEN}`)).toMatchObject({
      token: TOKEN,
      platform: "web",
    });
  });
});

describe("DELETE /notifications/push", () => {
  it("removes the token", async () => {
    fakeDb.seed({ [`users/${UID}/fcmTokens/${TOKEN}`]: { token: TOKEN } });
    const res = await request(app()).delete("/api/notifications/push").set(auth).send({ token: TOKEN });
    expect(res.body).toMatchObject({ success: true });
    expect(fakeDb.read(`users/${UID}/fcmTokens/${TOKEN}`)).toBeUndefined();
  });
});

describe("PUT /notifications/push", () => {
  it("requires a boolean", async () => {
    const res = await request(app()).put("/api/notifications/push").set(auth).send({ enabled: "yes" });
    expect(res.status).toBe(400);
  });

  it("creates a uid-keyed doc with the 7 AM default for unlinked users", async () => {
    fakeDb.seed({ [`users/${UID}`]: { name: "T" } });
    const res = await request(app()).put("/api/notifications/push").set(auth).send({ enabled: true });
    expect(res.body).toMatchObject({ success: true, pushEnabled: true, reminderHour: 7 });
    expect(fakeDb.read(`whatsapp_reminders/${UID}`)).toMatchObject({
      pushEnabled: true,
      reminderHour: 7,
    });
  });

  it("keeps the existing hour when one is set", async () => {
    fakeDb.seed({
      [`users/${UID}`]: { whatsappPhone: "911234567890" },
      "whatsapp_reminders/911234567890": { reminderHour: 20, pushEnabled: false },
    });
    const res = await request(app()).put("/api/notifications/push").set(auth).send({ enabled: true });
    expect(res.body).toMatchObject({ pushEnabled: true, reminderHour: 20 });
  });

  it("disables without touching the hour", async () => {
    fakeDb.seed({
      "whatsapp_reminders/u1": { reminderHour: 8, pushEnabled: true },
    });
    const res = await request(app()).put("/api/notifications/push").set(auth).send({ enabled: false });
    expect(res.body).toMatchObject({ success: true, pushEnabled: false, reminderHour: 8 });
    expect(fakeDb.read("whatsapp_reminders/u1")).toMatchObject({ pushEnabled: false });
  });
});
