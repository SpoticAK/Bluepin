import type { Request, Response, NextFunction } from "express";

/**
 * Full admin access: can create/modify referral codes, inspect feedback, etc.
 */
export const ADMIN_EMAILS = new Set([
  "sparsh@bluepin.in",
  ...(process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : []),
]);

/**
 * Referral tracking viewers: can inspect referral summary, analytics, and leaderboard.
 * Includes all ADMIN_EMAILS plus any developer or analytics emails.
 */
export const REFERRAL_VIEWER_EMAILS = new Set([
  "sparsh@bluepin.in",
  ...(process.env.REFERRAL_VIEWER_EMAILS
    ? process.env.REFERRAL_VIEWER_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : []),
]);

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const email = user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.has(email)) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};

export const requireReferralAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const email = user?.email?.toLowerCase();
  if (!email || (!ADMIN_EMAILS.has(email) && !REFERRAL_VIEWER_EMAILS.has(email))) {
    return res.status(403).json({ error: "Forbidden: Referral tracking access required" });
  }
  next();
};
