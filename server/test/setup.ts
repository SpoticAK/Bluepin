/**
 * Shared harness for API route tests (supertest + fakes, no network).
 *
 * - `installFetchStub()` replaces global fetch with a recording stub that
 *   answers `{ok:true}` so no Meta/Gemini call can ever leave the process.
 * - `buildApp(router)` wraps a router with JSON body parsing.
 * - `setTestUid(app, uid)` is a convenience for the mocked requireAuth below:
 *   routes import requireAuth from "../firebase", which every route test file
 *   mocks via `vi.mock("../firebase", ...)` to honour the `x-test-uid` header.
 */
import express, { type Router } from "express";
import { vi } from "vitest";

export const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

export function installFetchStub() {
  fetchCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

export function buildApp(router: Router) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", router);
  return app;
}

/** Header the mocked requireAuth (see route test files) reads. */
export const testAuthHeader = (uid: string | null) =>
  uid === null ? {} : { "x-test-uid": uid };
