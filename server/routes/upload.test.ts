import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { FakeFirestore } from "../test/fakeFirestore";
import { buildApp, installFetchStub } from "../test/setup";
import { extractLabReportFromUrl } from "../services/labReportServiceDirect";
import { extractPdfToMarkdown } from "../services/pdfMarkdownService";
import { chunkStore } from "../upload";
import uploadRouter from "./upload";

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

vi.mock("../services/labReportServiceDirect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/labReportServiceDirect")>()),
  extractLabReportFromUrl: vi.fn(),
}));

vi.mock("../services/pdfMarkdownService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/pdfMarkdownService")>()),
  extractPdfToMarkdown: vi.fn(),
}));

const extractMock = vi.mocked(extractLabReportFromUrl);
const markdownMock = vi.mocked(extractPdfToMarkdown);

const UID = "u1";
const auth = { "x-test-uid": UID };
const report = (over: Record<string, unknown> = {}) => ({
  fileUrl: "https://example.com/report.pdf",
  reportId: "r1",
  reportName: "CBC",
  reportDate: "2026-10-14",
  ...over,
});

beforeEach(() => {
  vi.unstubAllGlobals();
  installFetchStub();
  fakeDb.clear();
  chunkStore.clear();
  vi.clearAllMocks();
});

const app = () => buildApp(uploadRouter);

describe("POST /analyze-report", () => {
  it("requires auth and a valid body", async () => {
    const anon = await request(app()).post("/api/analyze-report").send(report());
    expect(anon.status).toBe(401);
    const bad = await request(app()).post("/api/analyze-report").set(auth).send({ reportId: "r1" });
    expect(bad.status).toBe(400);
  });

  it("returns the saved record without calling AI on retry (idempotency)", async () => {
    fakeDb.seed({
      [`users/${UID}/labReports/r1`]: {
        biomarkers: [{ name: "Hb", value: 13 }],
        reportType: "CBC",
        specimenType: null,
      },
    });
    const res = await request(app()).post("/api/analyze-report").set(auth).send(report());
    expect(res.body).toMatchObject({ success: true, savedToFirestore: true });
    expect(res.body.biomarkers).toHaveLength(1);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("extracts, writes report + biomarker docs + limits, and flags saved", async () => {
    extractMock.mockResolvedValue({
      success: true,
      biomarkers: [{ name: "Hemoglobin", value: 13.5, status: "Healthy" }],
      reportType: "CBC",
      specimenType: null,
    } as never);

    const res = await request(app()).post("/api/analyze-report").set(auth).send(report());
    expect(res.status).toBe(200);
    expect(res.body.savedToFirestore).toBe(true);
    expect(fakeDb.read(`users/${UID}/labReports/r1`)).toMatchObject({ name: "CBC" });
    expect(fakeDb.read(`users/${UID}/biomarkers/r1_Hemoglobin`)).toMatchObject({ value: 13.5 });
    expect(fakeDb.read(`users/${UID}/stats/limits`)).toMatchObject({ rCount: 1, rTotal: 1 });
  });

  it("enforces the 20/day and 100/total report limits", async () => {
    extractMock.mockResolvedValue({
      success: true,
      biomarkers: [{ name: "Hb", value: 1 }],
    } as never);
    const now = new Date();
    const today = {
      rYear: now.getUTCFullYear(),
      rMonth: now.getUTCMonth() + 1,
      rDay: now.getUTCDate(),
    };
    fakeDb.seed({ [`users/${UID}/stats/limits`]: { ...today, rCount: 20, rTotal: 20 } });
    const daily = await request(app())
      .post("/api/analyze-report")
      .set(auth)
      .send(report({ reportId: "r2" }));
    expect(daily.status).toBe(429);

    fakeDb.seed({ [`users/${UID}/stats/limits`]: { ...today, rCount: 1, rTotal: 100 } });
    const total = await request(app())
      .post("/api/analyze-report")
      .set(auth)
      .send(report({ reportId: "r3" }));
    expect(total.status).toBe(429);
  });

  it("returns 500 when AI fails (orphan cleanup is best-effort)", async () => {
    extractMock.mockRejectedValue(new Error("model overloaded"));
    const res = await request(app())
      .post("/api/analyze-report")
      .set(auth)
      .send(report({ reportId: "r9" }));
    expect(res.status).toBe(500);
    expect(fakeDb.read(`users/${UID}/labReports/r9`)).toBeUndefined();
  });
});

describe("POST /extract-pdf-markdown", () => {
  it("requires one of fileUrl/fileBase64", async () => {
    const res = await request(app()).post("/api/extract-pdf-markdown").set(auth).send({});
    expect(res.status).toBe(400);
  });

  it("returns markdown on success and 422 when empty", async () => {
    markdownMock.mockResolvedValue("# Report");
    const ok = await request(app())
      .post("/api/extract-pdf-markdown")
      .set(auth)
      .send({ fileUrl: "https://example.com/a.pdf" });
    expect(ok.body).toMatchObject({ success: true, markdown: "# Report" });

    markdownMock.mockResolvedValue("");
    const empty = await request(app())
      .post("/api/extract-pdf-markdown")
      .set(auth)
      .send({ fileUrl: "https://example.com/a.pdf" });
    expect(empty.status).toBe(422);
  });
});

describe("POST /upload-chunk", () => {
  const chunk = (over: Record<string, unknown> = {}) => ({
    uploadId: "up1",
    chunkIndex: 0,
    totalChunks: 1,
    chunkData: "aGVsbG8=",
    mimeType: "image/png",
    type: "lab-report",
    ...over,
  });

  it("validates the chunk envelope", async () => {
    const res = await request(app()).post("/api/upload-chunk").set(auth).send({ uploadId: "up1" });
    expect(res.status).toBe(400);
  });

  it("acks incomplete multi-chunk uploads without AI", async () => {
    const res = await request(app())
      .post("/api/upload-chunk")
      .set(auth)
      .send(chunk({ totalChunks: 2 }));
    expect(res.body).toMatchObject({ status: "chunk_received" });
  });

  it("assembles lab-report chunks without an AI call", async () => {
    const res = await request(app()).post("/api/upload-chunk").set(auth).send(chunk());
    expect(res.body).toMatchObject({ status: "chunk_received" });
    expect(chunkStore.size).toBe(0);
  });
});
