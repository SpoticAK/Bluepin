import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Type } from "@google/genai";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import nodemailer from 'nodemailer';
import { generateContentWithRetry } from './server/gemini';
import { handleUploadChunk } from './server/upload';

let mailTransporter: nodemailer.Transporter | null = null;

function getMailTransporter(): nodemailer.Transporter | null {
  if (!mailTransporter && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return mailTransporter;
}

// Initialize Firebase Admin
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
if (!getApps().length) {
  let adminConfig: any = {
    projectId: firebaseProjectId,
  };
  const serviceAccountPath = path.resolve(process.cwd(), 'firebase-adminsdk.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminConfig.credential = cert(serviceAccount);
    } catch (e) {
      console.warn("Could not load service account from firebase-adminsdk.json:", e);
    }
  }
  initializeApp(adminConfig);
}

// Authentication Middleware
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error.message || "Unknown error");
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

async function startServer() {
            const app = express();
  app.use(cors());
  
  app.use(helmet({
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
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.firebase.com", "https://*.firebaseapp.com", "https://*.gstatic.com", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://apis.google.com", "https://accounts.google.com"],
        objectSrc: ["'none'"]
      }
    }
  }));
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  const globalIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after 15 minutes" }
  });

  const aiUserLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => {
      return (req as any).user?.uid || 'anonymous';
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many AI requests from this user, please try again after an hour" }
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.use("/api", globalIpLimiter);

  // Upload route
  app.post("/api/upload-chunk", requireAuth, aiUserLimiter, express.json({ limit: "50mb" }), handleUploadChunk);

  app.post("/api/generate-insights", requireAuth, aiUserLimiter, express.json({ limit: "5mb" }), async (req, res) => {
    try {
      
      const InsightsSchema = z.object({
        reports: z.array(
          z.object({
            id: z.string().optional(),
            date: z.string().optional(),
            type: z.string().optional(),
            biomarkers: z.array(z.any()).optional()
          }).passthrough()
        ).max(100)
      });
      const parsedBody = InsightsSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.format() });
      }
      const { reports } = parsedBody.data;

      
      const promptText = `As a functional medical AI assistant, analyze the lab reports and provide an overview of trends.
Break down the response into three categories:
1. good: improvements or healthy trends.
2. concern: worsening trends or areas of concern.
3. advice: very short, actionable advice.

CRITICAL RULES:
- Be extremely concise.
- Club biomarkers from the same profile with similar trends together (e.g., "AST & ALT have improved and are now healthy").
- Do NOT use asterisks for highlighting.
- For 'good' and 'concern', return an array of objects containing 'profile' (one of: 'Liver', 'Lipid', 'Thyroid', 'Kidney', 'Blood', 'Glucose', 'Vitamins', 'Urinary', 'Inflammatory', 'Others' representing the profile of the biomarkers) and 'text' (the concise sentence).
- For 'advice', just return an array of strings.

Here are the lab reports: ${JSON.stringify(reports)}`;
      
      const schema = {
        type: Type.OBJECT,
        properties: {
          good: { 
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["profile", "text"]
            },
            description: "Improvements or good trends."
          },
          concern: { 
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["profile", "text"]
            },
            description: "Worsening trends or areas of concern."
          },
          advice: { 
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Very short and concise advice points."
          }
        },
        required: ["good", "concern", "advice"]
      };

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash-lite", // Route insights to cheaper 8b model
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("AI Insights error:", error.message || "Unknown error");
      res.status(500).json({ error: "Failed to generate AI insights" });
    }
  });

  app.post("/api/feedback", express.json(), async (req, res) => {
    try {
      const { subject, message, userEmail } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and message are required" });
      }

      try {
        const db = getFirestore();
        await db.collection('feedbacks').add({
          subject,
          message,
          userEmail: userEmail || 'Anonymous',
          createdAt: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error("Failed to save feedback to database:", dbError);
      }

      const transporter = getMailTransporter();
      if (!transporter) {
        console.warn("SMTP credentials are not fully configured. Feedback would be:", { subject, message, userEmail });
        // Simulate success if no key (so frontend works while setting up)
        return res.json({ success: true, simulated: true });
      }

      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "hello@bluepin.in";

      await transporter.sendMail({
        from: `"Bluepin Feedback" <${fromEmail}>`,
        to: 'sparsh@bluepin.in',
        subject: subject,
        text: `From: ${userEmail || 'Anonymous'}\n\nMessage:\n${message}`,
        replyTo: userEmail || undefined
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Feedback error:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Catch all unhandled API routes and return 404 JSON
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  // Global API error handler to ensure JSON responses for API routes
    app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Error:", err.message || "Unknown error");
    if (err.message === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: "Invalid file type. Only PDF, PNG, JPEG, and JPG are allowed." });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
    }
    res.status(err.status || 500).json({ error: "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
