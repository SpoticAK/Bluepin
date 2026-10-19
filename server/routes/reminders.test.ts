import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, installFetchStub } from "../test/setup";
import { sendReminderConfirmation } from "../services/wa-bot/wa-client";
import remindersRouter from "./reminders";

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

vi.mock("../services/wa-bot/wa-client", () => ({
  sendReminderConfirmation: vi.fn(async () => ({ ok: true })),
}));

const confirmed = vi.mocked(sendReminderConfirmation);
const PHONE = "911234567890";

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

const app = () => buildApp(remindersRouter);
const as = (uid: string | null) => (uid === null ? {} : { "x-test-uid": uid });

describe("GET /reminders", () => {
  it("requires auth", async () => {
    const res = await request(app()).get("/api/reminders").set(as(null));
    expect(res.status).toBe(401);
  });

  it("reports unlinked when the profile has no whatsappPhone", async () => {
    fakeDb.seed({ "users/u1": { name: "Test" } });
    const res = await request(app()).get("/api/reminders").set(as("u1"));
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);
    expect(res.body.reminder).toBeNull();
    expect(res.body.slots.length).toBeGreaterThan(0);
  });

  it("returns null reminder when linked but nothing stored", async () => {
    fakeDb.seed({ "users/u1": { whatsappPhone: PHONE } });
    const res = await request(app()).get("/api/reminders").set(as("u1"));
    expect(res.body).toMatchObject({ linked: true, reminder: null });
  });

  it("reads the stored reminder, defaulting enabled to true when absent", async () => {
    fakeDb.seed({
      "users/u1": { whatsappPhone: PHONE },
      [`whatsapp_reminders/${PHONE}`]: { uid: "u1", phone: PHONE, reminderHour: 8 },
    });
    const res = await request(app()).get("/api/reminders").set(as("u1"));
    expect(res.body.reminder).toMatchObject({ hour: 8, enabled: true });
  });

  it("returns null for a corrupt hour instead of 500", async () => {
    fakeDb.seed({
      "users/u1": { whatsappPhone: PHONE },
      [`whatsapp_reminders/${PHONE}`]: { uid: "u1", reminderHour: "dawn" },
    });
    const res = await request(app()).get("/api/reminders").set(as("u1"));
    expect(res.status).toBe(200);
    expect(res.body.reminder).toBeNull();
  });
});

describe("PUT /reminders", () => {
  it("rejects unlinked users with 409", async () => {
    fakeDb.seed({ "users/u1": {} });
    const res = await request(app()).put("/api/reminders").set(as("u1")).send({ hour: 8 });
    expect(res.status).toBe(409);
  });

  it("rejects out-of-range hours with 400", async () => {
    fakeDb.seed({ "users/u1": { whatsappPhone: PHONE } });
    for (const hour of [4, 24, 7.5, "eight"]) {
      const res = await request(app()).put("/api/reminders").set(as("u1")).send({ hour });
      expect(res.status).toBe(400);
    }
    expect(fakeDb.read(`whatsapp_reminders/${PHONE}`)).toBeUndefined();
  });

  it("saves a valid hour, re-enables, and confirms on WhatsApp", async () => {
    fakeDb.seed({ "users/u1": { whatsappPhone: PHONE } });
    const res = await request(app()).put("/api/reminders").set(as("u1")).send({ hour: 8 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      changed: true,
      reminder: { hour: 8, displayTime: "8:00 AM", enabled: true },
    });
    expect(fakeDb.read(`whatsapp_reminders/${PHONE}`)).toMatchObject({
      uid: "u1",
      reminderHour: 8,
      enabled: true,
    });
    expect(confirmed).toHaveBeenCalledWith(PHONE, "8:00 AM");
  });

  it("short-circuits an unchanged reminder without re-confirming", async () => {
    fakeDb.seed({
      "users/u1": { whatsappPhone: PHONE },
      [`whatsapp_reminders/${PHONE}`]: {
        uid: "u1",
        phone: PHONE,
        reminderHour: 8,
        displayTime: "8:00 AM",
        enabled: true,
      },
    });
    const res = await request(app()).put("/api/reminders").set(as("u1")).send({ hour: 8 });
    expect(res.body).toMatchObject({ success: true, changed: false });
    expect(confirmed).not.toHaveBeenCalled();
  });

  it("re-enables a previously stopped reminder", async () => {
    fakeDb.seed({
      "users/u1": { whatsappPhone: PHONE },
      [`whatsapp_reminders/${PHONE}`]: { uid: "u1", phone: PHONE, reminderHour: 8, enabled: false },
    });
    const res = await request(app()).put("/api/reminders").set(as("u1")).send({ hour: 8 });
    expect(res.body).toMatchObject({ success: true, changed: true });
    expect(fakeDb.read(`whatsapp_reminders/${PHONE}`)).toMatchObject({ enabled: true });
  });
});

describe("POST /reminders/stop", () => {
  it("is a no-op when nothing is stored", async () => {
    fakeDb.seed({ "users/u1": { whatsappPhone: PHONE } });
    const res = await request(app()).post("/api/reminders/stop").set(as("u1"));
    expect(res.body).toMatchObject({ success: true, changed: false, reminder: null });
  });

  it("soft-disables on both channels, preserving the hour", async () => {
    fakeDb.seed({
      "users/u1": { whatsappPhone: PHONE },
      [`whatsapp_reminders/${PHONE}`]: {
        uid: "u1",
        phone: PHONE,
        reminderHour: 8,
        enabled: true,
        pushEnabled: true,
      },
    });
    const res = await request(app()).post("/api/reminders/stop").set(as("u1"));
    expect(res.body).toMatchObject({ success: true, changed: true });
    expect(res.body.reminder).toMatchObject({ hour: 8, enabled: false });
    expect(fakeDb.read(`whatsapp_reminders/${PHONE}`)).toMatchObject({
      enabled: false,
      pushEnabled: false,
      reminderHour: 8,
    });
  });
});
