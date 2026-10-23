import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  APPLICANT_REFERRAL_PATH,
  corsMiddleware,
  requireAllowedOrigin,
} from "./cors";

function buildApp() {
  const app = express();
  app.use(APPLICANT_REFERRAL_PATH, requireAllowedOrigin);
  app.use(corsMiddleware);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post(APPLICANT_REFERRAL_PATH, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("applicant endpoint CORS allowlist", () => {
  const app = buildApp();

  it.each([
    "https://bluepin.in",
    "https://www.bluepin.in",
    "https://app.bluepin.in",
  ])("allows the Bluepin origin %s", async (origin) => {
    const res = await request(app)
      .post(APPLICANT_REFERRAL_PATH)
      .set("Origin", origin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("allows the applicant endpoint without an Origin header", async () => {
    const res = await request(app)
      .post(APPLICANT_REFERRAL_PATH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows localhost only outside production", async () => {
    const res = await request(app)
      .post(APPLICANT_REFERRAL_PATH)
      .set("Origin", "http://localhost:5173")
      .send({});

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("rejects unknown origins with 403", async () => {
    const res = await request(app)
      .post(APPLICANT_REFERRAL_PATH)
      .set("Origin", "https://evil.example.com")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Forbidden origin");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers an allowed preflight request", async () => {
    const res = await request(app)
      .options(APPLICANT_REFERRAL_PATH)
      .set("Origin", "https://bluepin.in")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://bluepin.in",
    );
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("rejects a preflight request from an unknown origin", async () => {
    const res = await request(app)
      .options(APPLICANT_REFERRAL_PATH)
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps other API routes permissive", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://other-client.example.com");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("keeps preflight for other API routes permissive", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://other-client.example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
