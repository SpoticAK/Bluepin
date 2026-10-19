import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { fetchCalls, installFetchStub } from "../test/setup";
import whatsappRouter from "./whatsapp";

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

const VERIFY_TOKEN = "test-verify-token";
const APP_SECRET = "test-app-secret";
const PHONE_ID = "999888777";

// NOTE: no global express.json() here — the webhook route installs its own
// parser to capture req.rawBody. A global parser would consume the stream first
// and break signature verification (the route guards against exactly that).
const app = () => {
  const a = express();
  a.use("/api", whatsappRouter);
  return a;
};

function sign(raw: string) {
  return `sha256=${crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
}

function textPayload(over: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_ID },
              messages: [
                { id: "wamid.1", from: "911234567890", type: "text", text: { body: "hi" } },
              ],
            },
          },
        ],
      },
    ],
    ...over,
  };
}

async function postWebhook(payload: unknown, sig: string | null) {
  const raw = JSON.stringify(payload);
  const t = request(app())
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .send(raw);
  return sig === null ? t : t.set("X-Hub-Signature-256", sig);
}

const flush = () => new Promise((r) => setTimeout(r, 100));

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.WHATSAPP_APP_SECRET = APP_SECRET;
  process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_ID;
  process.env.WHATSAPP_TOKEN = "test-token";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /whatsapp/webhook (Meta verification)", () => {
  it("echoes the challenge for a correct subscribe request", async () => {
    const res = await request(app())
      .get("/api/whatsapp/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "abc123" });
    expect(res.status).toBe(200);
    expect(res.text).toBe("abc123");
  });

  it("rejects a wrong verify token without echoing it", async () => {
    const res = await request(app())
      .get("/api/whatsapp/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "abc123" });
    expect(res.status).toBe(403);
    expect(res.text).not.toContain("wrong");
  });
});

describe("POST /whatsapp/webhook (ingestion)", () => {
  it("rejects a missing signature", async () => {
    const res = await postWebhook(textPayload(), null);
    expect(res.status).toBe(401);
  });

  it("rejects a forged signature", async () => {
    const res = await postWebhook(textPayload(), "sha256=deadbeef");
    expect(res.status).toBe(401);
    expect(fetchCalls).toHaveLength(0);
  });

  it("acks non-message objects without dispatching", async () => {
    const payload = { object: "page", entry: [] };
    const res = await postWebhook(payload, sign(JSON.stringify(payload)));
    expect(res.status).toBe(200);
    expect(res.text).toBe("EVENT_RECEIVED");
    await flush();
    expect(fetchCalls).toHaveLength(0);
  });

  it("ignores traffic for a different phone_number_id", async () => {
    const payload = textPayload();
    (payload.entry[0].changes[0].value as { metadata: object }).metadata = {
      phone_number_id: "other-number",
    };
    const res = await postWebhook(payload, sign(JSON.stringify(payload)));
    expect(res.status).toBe(200);
    await flush();
    expect(fetchCalls).toHaveLength(0);
  });

  it("dispatches a text message and dedupes Meta redeliveries", async () => {
    const payload = textPayload();
    const sig = sign(JSON.stringify(payload));

    const first = await postWebhook(payload, sig);
    expect(first.status).toBe(200);
    expect(first.text).toBe("EVENT_RECEIVED");
    await flush();
    const sentAfterFirst = fetchCalls.length;
    expect(sentAfterFirst).toBeGreaterThan(0);
    expect(fakeDb.read("whatsapp_processed/wamid.1")).toBeDefined();

    const second = await postWebhook(payload, sig);
    expect(second.status).toBe(200);
    await flush();
    expect(fetchCalls.length).toBe(sentAfterFirst);
  });
});
