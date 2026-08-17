import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { extractLabReportFromUrl } from "./services/labReportService";
import { extractGlucoseFromBase64 } from "./services/glucoseService";
import { extractPdfToMarkdown } from "./services/pdfMarkdownService";

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
});

export async function handleAnalyzeReport(req: Request, res: Response) {
  const parsed = AnalyzeReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const { fileUrl, mimeType } = parsed.data;

  try {
    const result = await extractLabReportFromUrl(fileUrl, mimeType);
    return res.json(result);
  } catch (error: any) {
    console.error("Report analysis error:", error.message || error);
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
      return res.status(422).json({ error: "Could not extract Markdown from the provided PDF." });
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
