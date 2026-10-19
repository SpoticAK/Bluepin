import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "../../../test/fakeFirestore";
import { fetchCalls, installFetchStub } from "../../../test/setup";
import { routeMessage } from "./messageRouter";
import { extractGlucoseValue } from "./glucoseHandler";
import type { WAMessage } from "../types";

const fakeDb = new FakeFirestore();

vi.mock("../../../firebase", () => ({
  requireAuth: (_req: unknown, _res: never, next: () => void) => next(),
  getAdminFirestore: () => fakeDb,
  getAdminAuth: () => ({
    async getUser() {
      const err = new Error("not found") as Error & { code: string };
      err.code = "auth/user-not-found";
      throw err;
    },
  }),
  getAdminApp: () => ({}),
}));

vi.mock("../../glucoseService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../glucoseService")>()),
  extractGlucoseFromBase64: vi.fn(async () => ({ success: false })),
}));

vi.mock("../wa-client", async (importOriginal) => {
  const real = await importOriginal<typeof import("../wa-client")>();
  return {
    ...real,
    downloadMediaFromMeta: vi.fn(async () => {
      throw new Error("not stubbed per-test");
    }),
  };
});

import { extractGlucoseFromBase64 } from "../../glucoseService";
import { downloadMediaFromMeta, MediaTooLargeError } from "../wa-client";

const extractMock = vi.mocked(extractGlucoseFromBase64);
const downloadMock = vi.mocked(downloadMediaFromMeta);

let phoneSeq = 0;
let msgSeq = 0;
const phone = () => `91900000${String(100 + phoneSeq++).slice(-3)}`;
const mid = () => `wamid.test${msgSeq++}`;

const textMsg = (from: string, body: string): WAMessage =>
  ({ id: mid(), from, type: "text", text: { body } }) as WAMessage;
const buttonMsg = (from: string, buttonId: string): WAMessage =>
  ({
    id: mid(),
    from,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: buttonId, title: buttonId } },
  }) as unknown as WAMessage;
const listMsg = (from: string, listId: string): WAMessage =>
  ({
    id: mid(),
    from,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: listId, title: listId } },
  }) as unknown as WAMessage;
const imageMsg = (from: string): WAMessage =>
  ({
    id: mid(),
    from,
    type: "image",
    image: { id: "media-img-1", mime_type: "image/jpeg", sha256: "x" },
  }) as unknown as WAMessage;
const docMsg = (from: string, fileSize?: number): WAMessage =>
  ({
    id: mid(),
    from,
    type: "document",
    document: {
      id: "media-doc-1",
      filename: "report.pdf",
      mime_type: "application/pdf",
      ...(fileSize === undefined ? {} : { file_size: fileSize }),
    },
  }) as unknown as WAMessage;

const sentTexts = () =>
  fetchCalls.map((c) => JSON.parse((c.init?.body as string) ?? "{}"));
const lastText = () => {
  const texts = sentTexts().filter((b) => b.type === "text");
  return texts.at(-1)?.text?.body as string | undefined;
};
/** Matches across every outbound payload (text AND interactive lists). */
const sentIncludes = (re: RegExp) =>
  fetchCalls.some((c) => re.test((c.init?.body as string) ?? ""));

const linkUser = (p: string, uid: string) =>
  fakeDb.seed({ [`whatsapp_users/${p}`]: { uid, phone: p } });

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
  extractMock.mockResolvedValue({ success: false } as never);
});

describe("extractGlucoseValue", () => {
  it.each([
    ["126", 126],
    ["my sugar is 130", 130],
    ["5.4", 5.4],
    ["LINK 482913", 482913], // router checks link codes BEFORE extraction
  ])("extracts %s → %s", (input, expected) => {
    expect(extractGlucoseValue(input)).toBe(expected);
  });

  it("returns null without digits", () => {
    expect(extractGlucoseValue("hello there")).toBeNull();
  });
});

describe("glucose text flow", () => {
  it("refuses unlinked senders before the timing prompt", async () => {
    const p = phone();
    await routeMessage(textMsg(p, "126"));
    expect(lastText()).toMatch(/must be linked/i);
    // No pending session was created: a timing tap gets the no-pending reply.
    await routeMessage(buttonMsg(p, "fasting"));
    expect(sentIncludes(/already been logged|timed out/)).toBe(true);
  });

  it("runs the full linked flow: number → timing prompt → saved reading", async () => {
    const p = phone();
    linkUser(p, "u1");

    await routeMessage(textMsg(p, "126"));
    const prompt = sentTexts().at(-1);
    expect(prompt.type).toBe("interactive"); // timing buttons

    await routeMessage(buttonMsg(p, "fasting"));
    const readings = (await fakeDb.collection("users/u1/glucoseReadings").get()).docs;
    expect(readings).toHaveLength(1);
    expect(readings[0].data()).toMatchObject({ value: 126, timing: "Fasting" });
    expect(sentIncludes(/126/)).toBe(true);
  });

  it("rejects out-of-range numbers without writing", async () => {
    const p = phone();
    linkUser(p, "u1");
    await routeMessage(textMsg(p, "9999"));
    expect(lastText()).toMatch(/valid|between|range/i);
    const readings = (await fakeDb.collection("users/u1/glucoseReadings").get()).docs;
    expect(readings).toHaveLength(0);
  });

  it("routes six-digit numbers to linking, never to glucose", async () => {
    const p = phone();
    linkUser(p, "u1");
    await routeMessage(textMsg(p, "482913"));
    expect(lastText()).toMatch(/link code is invalid/i);
    const readings = (await fakeDb.collection("users/u1/glucoseReadings").get()).docs;
    expect(readings).toHaveLength(0);
  });

  it("enforces the daily cap before prompting", async () => {
    const p = phone();
    linkUser(p, "u1");
    const now = new Date();
    fakeDb.seed({
      "users/u1/stats/limits": {
        gYear: now.getUTCFullYear(),
        gMonth: now.getUTCMonth() + 1,
        gDay: now.getUTCDate(),
        gCount: 10,
      },
    });
    await routeMessage(textMsg(p, "126"));
    expect(lastText()).toMatch(/daily limit of 10/i);
  });
});

describe("link-code flow", () => {
  it("links on a valid code: mapping written, code consumed, greeted", async () => {
    const p = phone();
    fakeDb.seed({
      "whatsapp_links/482913": { uid: "u9", code: "482913", expiresAt: Date.now() + 600_000 },
    });
    await routeMessage(textMsg(p, "LINK 482913"));
    expect(fakeDb.read(`whatsapp_users/${p}`)).toMatchObject({ uid: "u9" });
    expect(fakeDb.read("whatsapp_links/482913")).toBeUndefined();
    expect(fetchCalls.length).toBeGreaterThan(0);
  });

  it("rejects expired codes and clears them", async () => {
    const p = phone();
    fakeDb.seed({
      "whatsapp_links/482913": { uid: "u9", code: "482913", expiresAt: Date.now() - 1000 },
    });
    await routeMessage(textMsg(p, "482913"));
    expect(lastText()).toMatch(/expired/i);
    expect(fakeDb.read("whatsapp_links/482913")).toBeUndefined();
    expect(fakeDb.read(`whatsapp_users/${p}`)).toBeUndefined();
  });
});

describe("menu, help and unknown input", () => {
  it("answers help and greets strangers vs known users differently", async () => {
    const stranger = phone();
    await routeMessage(textMsg(stranger, "help"));
    expect(sentIncludes(/what i can help you with/i)).toBe(true);

    await routeMessage(textMsg(stranger, "hi"));
    expect(sentIncludes(/whatsapp companion/i)).toBe(true);

    const p = phone();
    linkUser(p, "u1");
    const before = fetchCalls.length;
    await routeMessage(textMsg(p, "hi"));
    const after = fetchCalls.slice(before).join(" ");
    expect(after.length).toBeGreaterThan(0);
    expect(/whatsapp companion/i.test(after)).toBe(false);
  });

  it("handles every main-menu option", async () => {
    const p = phone();
    linkUser(p, "u1");

    await routeMessage(listMsg(p, "log_glucose"));
    expect(lastText()).toMatch(/number/i);

    await routeMessage(listMsg(p, "upload_report"));
    expect(lastText()).toMatch(/pdf/i);

    await routeMessage(listMsg(p, "view_profile"));
    expect(fetchCalls.length).toBeGreaterThan(0);

    await routeMessage(listMsg(p, "bogus_option"));
    expect(lastText()).toMatch(/didn't recognise/i);
  });

  it("ignores unrecognised interactive payloads silently", async () => {
    const p = phone();
    const before = fetchCalls.length;
    await routeMessage({
      id: mid(),
      from: p,
      type: "interactive",
      interactive: { type: "flow" },
    } as unknown as WAMessage);
    expect(fetchCalls.length).toBe(before);
  });

  it("requires linking for the reminder prompt when unlinked", async () => {
    const p = phone();
    await routeMessage(listMsg(p, "set_reminder"));
    expect(lastText()).toMatch(/must be linked/i);
  });
});

describe("reminder selection", () => {
  it("saves the slot and confirms for linked users", async () => {
    const p = phone();
    linkUser(p, "u1");
    await routeMessage(listMsg(p, "remind_8"));
    expect(fakeDb.read(`whatsapp_reminders/${p}`)).toMatchObject({
      uid: "u1",
      reminderHour: 8,
      enabled: true,
    });
    expect(sentIncludes(/remind you at 8:00 AM/)).toBe(true);
  });

  it("writes nothing for unlinked senders", async () => {
    const p = phone();
    await routeMessage(listMsg(p, "remind_8"));
    expect(fakeDb.read(`whatsapp_reminders/${p}`)).toBeUndefined();
  });
});

describe("glucometer images", () => {
  const bytes = Buffer.from("fake-jpeg-bytes");

  it("feeds an extracted value into the glucose flow", async () => {
    const p = phone();
    linkUser(p, "u1");
    downloadMock.mockResolvedValue({ buffer: bytes, mimeType: "image/jpeg" });
    extractMock.mockResolvedValue({ success: true, value: 142, unit: "mg/dL" } as never);

    await routeMessage(imageMsg(p));
    expect(downloadMock).toHaveBeenCalledWith("media-img-1", expect.anything());
    expect(sentTexts().at(-1)?.type).toBe("interactive"); // timing prompt

    await routeMessage(buttonMsg(p, "random"));
    const readings = (await fakeDb.collection("users/u1/glucoseReadings").get()).docs;
    expect(readings).toHaveLength(1);
    expect(readings[0].data()).toMatchObject({ value: 142, timing: "Random" });
  });

  it("asks for a manual number when extraction finds nothing", async () => {
    const p = phone();
    linkUser(p, "u1");
    downloadMock.mockResolvedValue({ buffer: bytes, mimeType: "image/jpeg" });
    extractMock.mockResolvedValue({ success: false } as never);
    await routeMessage(imageMsg(p));
    expect(sentIncludes(/Invalid Glucose Input/)).toBe(true);
  });

  it("handles oversized and failed downloads distinctly", async () => {
    const p = phone();
    linkUser(p, "u1");
    const { MediaTooLargeError: TooLarge } = await import("../wa-client");
    const { MAX_FILE_BYTES } = await import("../wa-client/media");

    downloadMock.mockRejectedValueOnce(new TooLarge(MAX_FILE_BYTES + 1));
    await routeMessage(imageMsg(p));
    expect(sentIncludes(/Photo Too Large/)).toBe(true);

    downloadMock.mockRejectedValueOnce(new Error("network down"));
    await routeMessage(imageMsg(p));
    expect(sentIncludes(/could not download your photo/)).toBe(true);
  });
});

describe("document guards", () => {
  it("requires linking before anything else", async () => {
    const p = phone();
    await routeMessage(docMsg(p));
    expect(lastText()).toMatch(/not linked/i);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("rejects oversized files without downloading", async () => {
    const p = phone();
    linkUser(p, "u1");
    const { MAX_FILE_BYTES } = await import("../wa-client/media");
    await routeMessage(docMsg(p, MAX_FILE_BYTES + 1));
    expect(downloadMock).not.toHaveBeenCalled();
    expect(fetchCalls.length).toBeGreaterThan(0);
  });

  it("enforces the daily report cap", async () => {
    const p = phone();
    linkUser(p, "u1");
    const today = new Date().toISOString().split("T")[0];
    fakeDb.seed({ "users/u1/botLimits/reports": { date: today, count: 3 } });
    await routeMessage(docMsg(p, 1024));
    expect(lastText()).toMatch(/maximum.*limit|limit.*today/i);
    expect(downloadMock).not.toHaveBeenCalled();
  });
});
