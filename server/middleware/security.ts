import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import type { HelmetOptions } from "helmet";

export const helmetConfig: HelmetOptions = {
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://*.firebase.com", 
        "https://*.firebaseapp.com", 
        "https://*.gstatic.com", 
        "https://apis.google.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://*.clarity.ms"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      frameSrc: [
        "'self'", 
        "https://*.firebaseapp.com", 
        "https://apis.google.com", 
        "https://accounts.google.com",
        "https://www.googletagmanager.com"
      ],
      objectSrc: ["'none'"]
    }
  }
};

export const globalIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

export const aiUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    return (req as any).user?.uid || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests from this user, please try again after an hour" }
});

export const apiErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("API Error:", err.message || "Unknown error");
  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: "Invalid file type. Only PDF, PNG, JPEG, and JPG are allowed." });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
  }
  res.status(err.status || 500).json({ error: "Internal Server Error" });
};
