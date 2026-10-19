import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, fetchCalls, installFetchStub } from "../test/setup";
import * as notifications from "../services/notifications";
import cronRouter from "./cron";

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

const SECRET = "cron-test-secret";

const SAVED_ENV = {
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
};

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  // Dummy sender credentials so the real client builds real requests
  // against the fetch stub (never the network).
  process.env.WHATSAPP_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "999888777";
});

afterEach(() => {
  if (SAVED_ENV.WHATSAPP_TOKEN === undefined) delete process.env.WHATSAPP_TOKEN;
  else process.env.WHATSAPP_TOKEN = SAVED_ENV.WHATSAPP_TOKEN;
  if (SAVED_ENV.WHATSAPP_PHONE_NUMBER_ID === undefined)
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  else process.env.WHATSAPP_PHONE_NUMBER_ID = SAVED_ENV.WHATSAPP_PHONE_NUMBER_ID;
});

function postCron(auth: string | null, body = {}) {
  const t = request(buildApp(cronRouter)).post("/api/cron/whatsapp-reminders").send(body);
  return auth === null ? t : t.set("Authorization", auth);
}

describe("POST /api/cron/whatsapp-reminders — auth", () => {
  it("rejects a wrong secret in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await postCron("Bearer wrong");
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });

  it("lets scheduler traffic through with the right secret", async () => {
    const res = await postCron(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe("POST /api/cron/whatsapp-reminders — 20:00 IST sweep", () => {
  // 20:00 IST == 14:30 UTC.
  const SWEEP_TIME = new Date("2026-10-14T14:30:00.000Z");

  it("sweeps unlogged users, honouring opt-outs, 20h reminders and logged days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(SWEEP_TIME);
    try {
      fakeDb.seed({
        // Missed everything → gets the sweep template.
        "whatsapp_users/911111111111": { uid: "u1", phone: "911111111111" },
        // Logged today → skipped.
        "whatsapp_users/912222222222": { uid: "u2", phone: "912222222222" },
        "users/u2/glucoseReadings/r1": { date: "2026-10-14" },
        // Explicitly stopped → skipped.
        "whatsapp_users/913333333333": { uid: "u3", phone: "913333333333" },
        "whatsapp_reminders/913333333333": { enabled: false },
        // Already has a 20:00 reminder (got Guideline 9) → skipped.
        "whatsapp_users/914444444444": { uid: "u4", phone: "914444444444" },
        "whatsapp_reminders/914444444444": { uid: "u4", phone: "914444444444", reminderHour: 20, enabled: true },
      });

      vi.spyOn(notifications, "sendGlucosePushNudges").mockResolvedValue({
        delivered: 0,
        prunedTokens: 0,
        errors: 0,
      });

      const res = await postCron(`Bearer ${SECRET}`);
      expect(res.status).toBe(200);
      // u4's own 20:00 reminder fires as a scheduled send; the sweep skips them.
      expect(res.body).toMatchObject({ scheduledSent: 1, sweepSent: 1 });

      const sentTo = fetchCalls.map((c) => JSON.parse((c.init?.body as string) ?? "{}").to);
      expect(sentTo).toContain("911111111111"); // sweep
      expect(sentTo).toContain("914444444444"); // scheduled, not sweep
      expect(sentTo).not.toContain("912222222222");
      expect(sentTo).not.toContain("913333333333");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays quiet at other hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T03:30:00.000Z")); // 09:00 IST
    try {
      fakeDb.seed({
        "whatsapp_users/911111111111": { uid: "u1", phone: "911111111111" },
      });
      vi.spyOn(notifications, "sendGlucosePushNudges").mockResolvedValue({
        delivered: 0,
        prunedTokens: 0,
        errors: 0,
      });
      const res = await postCron(`Bearer ${SECRET}`);
      expect(res.body.sweepSent).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("POST /api/cron/whatsapp-reminders — scheduled hour", () => {
  // Freeze "now" so currentHourIST is deterministic: 09:00 IST == 03:30 UTC.
  const FROZEN = new Date("2026-10-14T03:30:00.000Z");

  function seedHour(hour: number) {
    fakeDb.seed({
      "whatsapp_reminders/911234567890": {
        uid: "u1",
        phone: "911234567890",
        reminderHour: hour,
        enabled: true,
        pushEnabled: false,
      },
      "whatsapp_reminders/919999999999": {
        uid: "u2",
        phone: "919999999999",
        reminderHour: hour,
        enabled: false, // opted out — must be skipped
      },
    });
  }

  it("sends the template to due users who have not logged, skips opt-outs and other hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
    try {
      seedHour(9);
      fakeDb.seed({
        "users/u2/glucoseReadings/r1": { date: "2026-10-14" },
        "whatsapp_reminders/911111111111": {
          uid: "u3",
          phone: "911111111111",
          reminderHour: 10, // different hour — must be skipped
        },
      });

      const notifySpy = vi
        .spyOn(notifications, "sendGlucosePushNudges")
        .mockResolvedValue({ delivered: 0, prunedTokens: 0, errors: 0 });

      const res = await postCron(`Bearer ${SECRET}`);
      expect(res.status).toBe(200);
      expect(res.body.scheduledSent).toBe(1);

      const sentTo = fetchCalls.map((c) => JSON.parse((c.init?.body as string) ?? "{}").to);
      expect(sentTo).toContain("911234567890");
      expect(sentTo).not.toContain("919999999999");
      expect(sentTo).not.toContain("911111111111");
      expect(notifySpy).not.toHaveBeenCalled(); // no push candidates
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips users who already logged today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
    try {
      seedHour(9);
      fakeDb.seed({ "users/u1/glucoseReadings/r1": { date: "2026-10-14" } });

      vi.spyOn(notifications, "sendGlucosePushNudges").mockResolvedValue({
        delivered: 0,
        prunedTokens: 0,
        errors: 0,
      });

      const res = await postCron(`Bearer ${SECRET}`);
      expect(res.body.scheduledSent).toBe(0);
      expect(fetchCalls).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("collects push candidates and reports the push result", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
    try {
      fakeDb.seed({
        "whatsapp_reminders/911234567890": {
          uid: "u1",
          phone: null, // push-only user: no WhatsApp send, still nudged
          reminderHour: 9,
          enabled: true,
          pushEnabled: true,
        },
      });
      const notifySpy = vi
        .spyOn(notifications, "sendGlucosePushNudges")
        .mockResolvedValue({ delivered: 2, prunedTokens: 1, errors: 0 });

      const res = await postCron(`Bearer ${SECRET}`);
      expect(res.body).toMatchObject({
        scheduledSent: 0,
        pushDelivered: 2,
        pushPrunedTokens: 1,
      });
      expect(notifySpy).toHaveBeenCalledWith([{ uid: "u1" }]);
    } finally {
      vi.useRealTimers();
    }
  });
});
