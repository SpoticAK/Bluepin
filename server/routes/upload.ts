import { Router } from "express";
import express from "express";
import { requireAuth } from "../firebase";
import { aiUserLimiter } from "../middleware/security";
import { handleUploadChunk, handleAnalyzeReport, handleExtractPdfMarkdown } from "../upload";

const router = Router();

router.post(
  "/upload-chunk",
  requireAuth,
  aiUserLimiter,
  express.json({ limit: "50mb" }),
  handleUploadChunk
);

router.post(
  "/analyze-report",
  requireAuth,
  aiUserLimiter,
  express.json(),
  handleAnalyzeReport
);

router.post(
  "/extract-pdf-markdown",
  requireAuth,
  aiUserLimiter,
  express.json({ limit: "50mb" }),
  handleExtractPdfMarkdown
);

export default router;
