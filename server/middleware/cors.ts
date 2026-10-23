import cors, { type CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

/** Only this endpoint is origin-restricted; other APIs keep their old CORS. */
export const APPLICANT_REFERRAL_PATH = "/api/referrals/applicant";

/**
 * Browser origins allowed to call the API. Keep this list explicit: CORS is a
 * browser policy, so it stops other websites' JavaScript from reading API
 * responses, but it is not a substitute for authentication or rate limiting.
 *
 * Add extra preview/custom origins with CORS_ALLOWED_ORIGINS (comma-separated).
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://bluepin.in",
  "https://www.bluepin.in",
  "https://app.bluepin.in",
  "https://bluepin-f8a09.web.app",
  "https://bluepin-f8a09.firebaseapp.com",
];

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function envOrigins(): string[] {
  return [
    config.appUrl,
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => value !== null);
}

const allowedOrigins = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...envOrigins(),
]);

function isLocalDevelopmentOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function isAllowedOrigin(origin?: string | null): boolean {
  // Server-to-server clients (WhatsApp, cron, curl) do not send Origin. CORS
  // does not apply to them, so they must continue to reach the API.
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins.has(normalized)) return true;

  return !config.isProduction && isLocalDevelopmentOrigin(normalized);
}

/**
 * Reject browser requests from unknown origins before they reach an API route.
 * This gives a clear 403 for disallowed origins instead of relying only on the
 * browser to enforce the missing CORS header. A forged Origin is still possible
 * outside a browser; rate limiting and idempotency remain in place for that.
 */
export function requireAllowedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: "Forbidden origin" });
  }
  next();
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Firebase-AppCheck",
    "X-Requested-With",
  ],
  maxAge: 86400,
};

/**
 * Keep the previous permissive CORS behaviour for every route except the
 * public applicant endpoint. This avoids breaking existing app/API clients
 * while the full set of future public APIs is still unknown.
 */
export const corsMiddleware = cors((req: Request, callback) => {
  if (req.path.replace(/\/+$/, "") === APPLICANT_REFERRAL_PATH) {
    callback(null, corsOptions);
    return;
  }
  callback(null, { origin: "*" });
});
