import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { buildApp, installFetchStub } from "../test/setup";
import { generateContentWithRetry } from "../gemini";
import insightsRouter from "./insights";

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
  getAdminFirestore: () => ({}),
  getAdminAuth: () => ({}),
  getAdminApp: () => ({}),
}));

vi.mock("../gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../gemini")>()),
  generateContentWithRetry: vi.fn(),
}));

const generateMock = vi.mocked(generateContentWithRetry);
const auth = { "x-test-uid": "u1" };

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  vi.clearAllMocks();
});

const app = () => buildApp(insightsRouter);
const body = { reports: [{ id: "r1", biomarkers: [] }] };

describe("POST /generate-insights", () => {
  it("requires auth and a valid body", async () => {
    const anon = await request(app()).post("/api/generate-insights").send(body);
    expect(anon.status).toBe(401);
    const bad = await request(app()).post("/api/generate-insights").set(auth).send({ reports: "nope" });
    expect(bad.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("passes the model output through", async () => {
    const insights = { good: [], concern: [], advice: ["Walk daily"] };
    generateMock.mockResolvedValue({ text: JSON.stringify(insights) } as never);
    const res = await request(app()).post("/api/generate-insights").set(auth).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(insights);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.5-flash-lite" }),
    );
  });

  it("returns 500 when Gemini fails or returns no text", async () => {
    generateMock.mockRejectedValueOnce(new Error("overloaded"));
    const failed = await request(app()).post("/api/generate-insights").set(auth).send(body);
    expect(failed.status).toBe(500);

    generateMock.mockResolvedValueOnce({} as never);
    const empty = await request(app()).post("/api/generate-insights").set(auth).send(body);
    expect(empty.status).toBe(500);
  });
});
