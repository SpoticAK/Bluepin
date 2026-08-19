import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { extractLabReportFromUrl } from "./services/labReportServiceDirect";
import { extractGlucoseFromBase64 } from "./services/glucoseService";
import { extractPdfToMarkdown } from "./services/pdfMarkdownService";
import { getAdminFirestore } from "./firebase";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Multer configuration for file uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "png", "jpeg", "jpg"];
    if (!ext || !allowedExtensions.includes(ext)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

// ─── Lab Report: Firebase URL → Gemini ──────────────────────────────────────

export const AnalyzeReportSchema = z.object({
  fileUrl: z.string().url(),
  mimeType: z.string().optional(),
  reportId: z.string().min(1),
  reportName: z.string().min(1),
  reportDate: z.string().min(1),
});


export async function handleAnalyzeReport(req: Request, res: Response) {
  const parsed = AnalyzeReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const { fileUrl, mimeType, reportId, reportName, reportDate } = parsed.data;
  const uid = (req as any).user.uid;
  const db = getAdminFirestore();

  // ── Fix 4: Idempotency check ─────────────────────────────────────────────
  // If this reportId already exists in Firestore (e.g. client retried after a
  // disconnect that happened after the server had already finished), return the
  // saved record immediately — no AI call needed.
  const existingDoc = await db.doc(`users/${uid}/labReports/${reportId}`).get();
  if (existingDoc.exists) {
    const d = existingDoc.data()!;
    console.log(`[AnalyzeReport] Idempotency hit for reportId=${reportId}`);
    return res.json({
      success: true,
      savedToFirestore: true,
      biomarkers: d.biomarkers ?? [],
      reportType: d.reportType ?? null,
      specimenType: d.specimenType ?? null,
    });
  }

  try {
    // ── AI extraction ────────────────────────────────────────────────────────
    const result = await extractLabReportFromUrl(fileUrl, mimeType);

    // ── Fix 1 + 3: Write to Firestore server-side (survives client disconnect)
    // and handle limits atomically in the same batch.
    if (result.success && Array.isArray(result.biomarkers) && result.biomarkers.length > 0) {
      const batch = db.batch();

      // ── Limits (mirrors store.tsx:146-199 updateLimits) ────────────────────
      const limitsRef = db.doc(`users/${uid}/stats/limits`);
      const limitsSnap = await limitsRef.get();
      const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const day = now.getUTCDate();
      const isNewDay =
        limitsData.rYear !== year ||
        limitsData.rMonth !== month ||
        limitsData.rDay !== day;
      const rCount = isNewDay ? 1 : (limitsData.rCount || 0) + 1;
      const rTotal = (limitsData.rTotal || 0) + 1;

      if (rCount > 20) {
        return res.status(429).json({ error: "Daily limit of 20 health reports exceeded." });
      }
      if (rTotal > 100) {
        return res.status(429).json({ error: "Maximum limit of 100 health reports exceeded." });
      }

      batch.set(
        limitsRef,
        { rYear: year, rMonth: month, rDay: day, rCount, rTotal },
        { merge: true },
      );

      // ── Report document ─────────────────────────────────────────────────────
      const reportRef = db.doc(`users/${uid}/labReports/${reportId}`);
      batch.set(reportRef, {
        id: reportId,
        name: reportName,
        fileUrl,
        date: reportDate,
        reportType: result.reportType ?? null,
        specimenType: result.specimenType ?? null,
        biomarkers: result.biomarkers,
        userId: uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      // ── Biomarker sub-documents (mirrors store.tsx:259-271) ─────────────────
      for (const bm of result.biomarkers) {
        const safeId = (bm.name as string).replace(/[^a-zA-Z0-9]/g, "");
        const bmRef = db.doc(`users/${uid}/biomarkers/${reportId}_${safeId}`);
        batch.set(bmRef, {
          userId: uid,
          reportId,
          name: bm.name,
          value: bm.value,
          reportDate,
          status: bm.status,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      result.savedToFirestore = true;
    }

    return res.json(result);
  } catch (error: any) {
    console.error("Report analysis error:", error.message || error);

    // ── Fix 2: Best-effort delete orphaned Storage file on AI failure ─────────
    // The file was already uploaded to Storage in Phase 1. If AI fails, remove
    // it so it doesn't accumulate as an orphan.
    try {
      const bucket = getStorage().bucket();
      // Firebase Storage download URLs encode the object path after /o/
      const url = new URL(fileUrl);
      const objectPath = decodeURIComponent(
        (url.pathname.split("/o/")[1] ?? "").split("?")[0],
      );
      if (objectPath) {
        await bucket.file(objectPath).delete();
        console.log(`[AnalyzeReport] Deleted orphaned Storage file: ${objectPath}`);
      }
    } catch (_) {
      // Non-fatal — cleanup is best-effort
    }

    return res.status(500).json({
      error:
        error.message ||
        "Failed to analyze document with AI. Please try again.",
    });
  }
}


export const ExtractPdfMarkdownSchema = z.object({
  fileUrl: z.string().url().optional(),
  fileBase64: z.string().optional(),
});

export async function handleExtractPdfMarkdown(req: Request, res: Response) {
  const parsed = ExtractPdfMarkdownSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const { fileUrl, fileBase64 } = parsed.data;
  if (!fileUrl && !fileBase64) {
    return res
      .status(400)
      .json({ error: "Either 'fileUrl' or 'fileBase64' must be provided." });
  }

  try {
    const markdown = await extractPdfToMarkdown({ fileUrl, fileBase64 });
    if (!markdown) {
      return res
        .status(422)
        .json({ error: "Could not extract Markdown from the provided PDF." });
    }
    return res.json({ success: true, markdown });
  } catch (error: any) {
    console.error("PDF Markdown extraction error:", error.message || error);
    return res.status(500).json({
      error: error.message || "Failed to extract markdown from PDF.",
    });
  }
}

// ─── Legacy Chunk Store for Glucometer Uploads ───────────────────────────────

export const chunkStore = new Map<string, string[]>();

export const UploadChunkSchema = z.object({
  uploadId: z.string().min(1).max(100),
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1).max(100),
  chunkData: z.string().max(14 * 1024 * 1024),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/jpg"]),
  type: z.enum(["glucose", "lab-report"]),
});

export async function handleUploadChunk(req: Request, res: Response) {
  const parsedBody = UploadChunkSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsedBody.error.issues,
    });
  }
  const { uploadId, chunkIndex, totalChunks, chunkData, mimeType, type } =
    parsedBody.data;
  const userScopedUploadId = `${(req as any).user.uid}_${uploadId}`;

  if (!chunkStore.has(userScopedUploadId)) {
    chunkStore.set(userScopedUploadId, []);
  }
  const chunks = chunkStore.get(userScopedUploadId)!;
  chunks[chunkIndex] = chunkData;

  try {
    if (chunks.filter(Boolean).length === totalChunks) {
      const fullBase64 = chunks.join("");
      chunkStore.delete(userScopedUploadId);

      if (type === "glucose") {
        const result = await extractGlucoseFromBase64(fullBase64, mimeType);
        return res.json(result);
      }
    }
    return res.json({ status: "chunk_received" });
  } catch (error: any) {
    chunkStore.delete(userScopedUploadId);
    console.error("Chunk extraction error:", error.message || error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to process upload." });
  }
}
