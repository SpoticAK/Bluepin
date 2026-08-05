import { matchBiomarker } from './src/lib/registry/biomarkerLookup';
import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
// @ts-ignore
import pdfParse from "pdf-parse";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { Type } from "@google/genai";
import multer from "multer";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import nodemailer from 'nodemailer';

let aiClient: GoogleGenAI | null = null;
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

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}


// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// Authentication Middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'png', 'jpeg', 'jpg'];
    if (!ext || !allowedExtensions.includes(ext)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});

async function generateContentWithRetry(options: any, maxRetries = 5) {
  if (options.model && typeof options.model === 'string' && options.model.includes('3.6')) {
    options.config = options.config || {};
    options.config.thinkingConfig = { thinkingLevel: "minimal" };
  }
  const ai = getAiClient();
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(options);
    } catch (error: any) {
      const errorStr = JSON.stringify(error) + (error?.message || '');
      if (errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('high demand') || errorStr.includes('429') || errorStr.toLowerCase().includes('rate') || errorStr.toLowerCase().includes('quota')) {
        if (i === maxRetries - 1) throw error;
        
        // Fallback to a stable model if the current one is overloaded
        if (options.model === 'gemini-3.5-flash-lite') {
          console.log(`[Gemini API] Falling back from ${options.model} to gemini-3.5-flash-lite`);
          options.model = 'gemini-3.5-flash-lite';
        }

        const waitMs = Math.pow(2, i + 1) * 1000 + Math.random() * 2000;
        console.log(`[Gemini API] Rate limit or high demand (503/429). Retrying with model ${options.model} in ${Math.round(waitMs / 1000)}s... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }
}

const LAB_REPORT_PROMPT = `Extract biomarker values from this lab report. For each identified biomarker, provide its name, value, unit, and the reference minimum/maximum normally listed.

CATEGORIZATION RULES:
You must categorize each biomarker into one of these EXACT categories: 'Blood Profile', 'Glucose Profile', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Function', 'Vitamins', 'Urine Analysis', or 'Others'. Do not create any custom categories.

The parser should NOT immediately classify biomarkers. Instead it should work in this order:

STEP 1 — Parse the report structure
Before categorizing a single biomarker, detect the report hierarchy. Recognize common section headers such as:
- Complete Blood Count, CBC, Hemogram, Blood Profile -> Blood Profile
- Urine Routine, Urine Analysis, Urine Routine Examination, Urinalysis -> Urine Analysis
- Liver Function Test, Liver Profile, LFT -> Liver Function
- Kidney Function Test, Renal Function Test, KFT, RFT -> Kidney Function
- Lipid Profile -> Lipid Profile
- Diabetes Profile -> Glucose Profile
- Thyroid Profile -> Thyroid Profile
- Electrolytes -> Kidney Function

Every biomarker that appears beneath a section header should inherit that section until another section header is encountered. Do NOT flatten the report. Preserve the hierarchy.

STEP 2 — Categorize using section context
If a biomarker belongs to a recognized section, the section ALWAYS wins.
Example: Under 'URINE ROUTINE', 'Albumin', 'Protein', 'Glucose', 'RBC', 'WBC', 'Ketones' all belong to 'Urine Analysis'.
Example: Under 'LIVER FUNCTION TEST', 'Albumin' belongs to 'Liver Function'.

STEP 3 — Only if no section exists
Only when a biomarker appears outside any recognized section should standard fallback definitions be used.
Example (Standalone): 'Albumin' -> 'Liver Function', 'Glucose' -> 'Glucose Profile', 'RBC' -> 'Blood Profile'

Important Rule: The report structure is the strongest source of truth. It is the primary source. Standard definitions are only a fallback. The parser should never ignore explicit report sections.

CRITICAL: Complete biomarker names must ALWAYS be taken exactly as written in the report (e.g. 'Blood Urea Nitrogen', NOT 'Urea'). Whenever there is duplicacy of biomarker in the same profile, there should be a quick recheck to ensure you did not accidentally shorten different biomarkers to the same name. Also output 'status' as 'Low', 'Normal', 'High', or 'Borderline'. Do not discard any extracted medical information.`;

const GLUCOSE_PROMPT = "Extract the glucose reading (mg/dL or mmol/L) from this glucometer display. If there is a date and time, extract those too. If it is obviously not a glucometer reading, indicate that. Respond only in the requested JSON format.";

const LAB_REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: { type: Type.BOOLEAN, description: "True if any lab results were found." },
    reportDate: { type: Type.STRING, description: "The date of the report in YYYY-MM-DD format, if available." },
    reportType: { type: Type.STRING, description: "Infer report type, e.g. CBC, LFT, KFT, LIPID, URINE_ROUTINE, THYROID, GLUCOSE, VITAMINS, UNKNOWN" },
    specimenType: { type: Type.STRING, description: "Infer primary specimen type, e.g. Blood, Urine, Saliva, Stool, Unknown" },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionName: { type: Type.STRING, description: "The header of the section (e.g. 'URINE ROUTINE', 'LIVER FUNCTION TEST'). If standalone, use 'Standalone'" },
          category: { type: Type.STRING, description: "The categorized profile for this section from EXACT categories (e.g., 'Urine Analysis', 'Liver Function')" },
          biomarkers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                refMin: { type: Type.NUMBER, description: "Numeric minimum. For '< X', use 0." },
                refMax: { type: Type.NUMBER, description: "Numeric maximum. For '< X', use X." },
                refRangeText: { type: Type.STRING, description: "The exact reference range string from the report. ALWAYS extract this if present." },
                status: { type: Type.STRING, description: "One of: 'Low', 'Normal', 'High'" },
                categoryFallback: { type: Type.STRING, description: "Only used if this biomarker is completely standalone without any section header. Otherwise leave empty." }
              },
              required: ["name", "value", "unit", "refRangeText"]
            }
          }
        },
        required: ["sectionName", "category", "biomarkers"]
      }
    }
  },
  required: ["success", "sections"]
};

function processLabReportResult(result: any) {
  if (!result || !result.sections) return result;
  
  const biomarkers: any[] = [];
  for (const section of result.sections) {
    for (const b of section.biomarkers || []) {
       let cat = section.category;
       if (!cat || cat === 'Others') {
          cat = b.categoryFallback || cat || 'Others';
       }
       biomarkers.push({
         ...b,
         category: cat
       });
    }
  }
  
  result.biomarkers = biomarkers.map((b: any) => {
    const match = matchBiomarker(b.name, {
      reportType: result.reportType,
      section: b.category,
      unit: b.unit,
    });
    
    const validCategories = ['Blood Profile', 'Glucose Profile', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Function', 'Vitamins', 'Urine Analysis', 'Others'];
    let finalCategory = b.category;
    if (!validCategories.includes(finalCategory)) {
        finalCategory = match.profile;
    } else if (finalCategory === 'Others' && match.profile && match.profile !== 'Others') {
        finalCategory = match.profile;
    }
    return {
      ...b,
      originalName: b.name,
      name: match.canonicalName || b.name,
      biomarkerId: match.biomarkerId,
      category: finalCategory,
      confidence: match.confidence,
      matchedBy: match.matchedBy
    };
  });
  
  delete result.sections;
  return result;
}

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
  const PORT = 3000;

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

  // API constraints for extracting metrics from images
  const chunkStore = new Map<string, string[]>();

  app.post("/api/upload-chunk", requireAuth, aiUserLimiter, express.json({ limit: "50mb" }), async (req, res) => {
    
    
    const UploadChunkSchema = z.object({
      uploadId: z.string().min(1).max(100),
      chunkIndex: z.number().int().min(0),
      totalChunks: z.number().int().min(1).max(100),
      chunkData: z.string().max(14 * 1024 * 1024), // ~10MB in base64
      mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
      type: z.enum(["glucose", "lab-report"])
    });
    const parsedBody = UploadChunkSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.format() });
    }
    const { uploadId, chunkIndex, totalChunks, chunkData, mimeType, type } = parsedBody.data;


    
    // Security: Scope the uploadId to the authenticated user to prevent cross-user chunk corruption
    const userScopedUploadId = `${(req as any).user.uid}_${uploadId}`;

    if (!chunkStore.has(userScopedUploadId)) {
      chunkStore.set(userScopedUploadId, []);
    }
    const chunks = chunkStore.get(userScopedUploadId)!;
    chunks[chunkIndex] = chunkData;

    try {
      if (chunks.filter(Boolean).length === totalChunks) {
        let fullBase64 = chunks.join('');
        const estimatedSize = (fullBase64.length * 3) / 4;
        if (estimatedSize > 10 * 1024 * 1024) {
          chunkStore.delete(userScopedUploadId);
          return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        }
        chunkStore.delete(userScopedUploadId);
        
        let promptText = "";
        let schema: any = {};
        let modelToUse = "gemini-3.5-flash-lite"; // Default to cheaper capable model
        
        if (type === "glucose") {
          promptText = GLUCOSE_PROMPT;
          modelToUse = "gemini-3.5-flash-lite"; // Route simple tasks to cheapest 8b model
          schema = {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              value: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              readingDate: { type: Type.STRING },
              readingTime: { type: Type.STRING },
              errorMsg: { type: Type.STRING }
            },
            required: ["success"]
          };
        } else {
          promptText = LAB_REPORT_PROMPT;
          schema = LAB_REPORT_SCHEMA;
        }

        let response;
        let fileInfo = null;
        try {
          let extractedText = null;
          let activeMimeType = mimeType;
          let activeBase64 = fullBase64;
          
          // Removed Optimization 1: Extract Text Locally First for PDFs (user requested native processing)
          
          // Optimization 2: Aggressive Image Compression for images (downscale before sending)
          if (mimeType.startsWith('image/')) {
            try {
              const imageBuffer = Buffer.from(fullBase64, 'base64');
              const compressedBuffer = await sharp(imageBuffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }) // Downscale to max 1024x1024
                .jpeg({ quality: 65 }) // Heavily compress
                .toBuffer();
              activeBase64 = compressedBuffer.toString('base64');
              activeMimeType = 'image/jpeg';
            } catch (err) {
              console.error("Local image compression failed, proceeding with original.", err);
            }
          }

          if (extractedText) {
            // We successfully extracted text, send text tokens (costs pennies) instead of PDF tokens
            response = await generateContentWithRetry({
              model: modelToUse,
              contents: [{
                parts: [
                  { text: promptText },
                  { text: "\n--- DOCUMENT CONTENT ---\n" + extractedText }
                ]
              }],
              config: {
                responseMimeType: "application/json",
                responseSchema: schema
              }
            });
          } else {
            // Fallback: send the optimized image or original PDF
            if (activeBase64.length > 2 * 1024 * 1024) { // Use File API for base64 > 2MB
              const tmpFilePath = path.join('/tmp', `${userScopedUploadId.replace(/[^a-zA-Z0-9_]/g, '')}.tmp`);
              fs.writeFileSync(tmpFilePath, Buffer.from(activeBase64, 'base64'));
              try {
                fileInfo = await getAiClient().files.upload({ file: tmpFilePath, config: { mimeType: activeMimeType } });
              } finally {
                if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
              }
              response = await generateContentWithRetry({
                model: modelToUse,
                contents: [{
                  parts: [
                    { text: promptText },
                    { fileData: { fileUri: fileInfo.uri, mimeType: activeMimeType } }
                  ]
                }],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema
                }
              });
            } else {
              response = await generateContentWithRetry({
                model: modelToUse,
                contents: [{
                  parts: [
                    { text: promptText },
                    { inlineData: { data: activeBase64, mimeType: activeMimeType } }
                  ]
                }],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema
                }
              });
            }
          }
        } finally {
          if (fileInfo) {
            try {
              await getAiClient().files.delete({ name: fileInfo.name });
            } catch (e) {
              console.error("Failed to delete temp file from Gemini:", e);
            }
          }
        }

        let result = JSON.parse(response.text || "{}");
        
        if (type !== "glucose") {
          result = processLabReportResult(result);
        }
        
        return res.json(result);
      }
      return res.json({ status: "chunk_received" });
    } catch (error: any) {
      chunkStore.delete(userScopedUploadId);
      console.error("Chunk extraction error:", error.message || "Unknown error");
      return res.status(500).json({ error: "Failed to extract from chunks: " + (error.message || "Unknown error") });
    }
  });

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
