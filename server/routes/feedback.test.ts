import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, installFetchStub } from "../test/setup";
import { sendFeedbackEmail } from "../mailer";
import feedbackRouter from "./feedback";

const fakeDb = new FakeFirestore();

vi.mock("../firebase", () => ({
  requireAuth: (_req: unknown, res: never, next: () => void) => next(),
  getAdminFirestore: () => fakeDb,
  getAdminAuth: () => ({}),
  getAdminApp: () => ({}),
}));

// Never touch SMTP in tests — assert the call instead.
vi.mock("../mailer", () => ({
  sendFeedbackEmail: vi.fn(async () => ({ sent: true })),
}));

const emailed = vi.mocked(sendFeedbackEmail);

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  vi.clearAllMocks();
});

const app = () => buildApp(feedbackRouter);

describe("POST /feedback", () => {
  it("requires subject and message", async () => {
    const res = await request(app()).post("/api/feedback").send({ subject: "hi" });
    expect(res.status).toBe(400);
    expect(emailed).not.toHaveBeenCalled();
  });

  it("stores the feedback and forwards the email", async () => {
    const res = await request(app()).post("/api/feedback").send({
      subject: "Bug",
      message: "dial is off",
      userEmail: "a@b.c",
    });
    expect(res.status).toBe(200);
    expect(emailed).toHaveBeenCalledWith({ subject: "Bug", message: "dial is off", userEmail: "a@b.c" });

    const stored = (await fakeDb.collection("feedbacks").get()).docs;
    expect(stored).toHaveLength(1);
    expect(stored[0].data()).toMatchObject({ subject: "Bug", userEmail: "a@b.c" });
  });

  it("defaults anonymous reporters and still emails on DB failure", async () => {
    const res = await request(app()).post("/api/feedback").send({ subject: "x", message: "y" });
    expect(res.status).toBe(200);
    const stored = (await fakeDb.collection("feedbacks").get()).docs;
    expect(stored[0].data()).toMatchObject({ userEmail: "Anonymous" });
  });
});
