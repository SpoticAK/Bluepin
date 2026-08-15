import { Router } from "express";
import express from "express";
import { requireAuth } from "../firebase";
import { aiUserLimiter } from "../middleware/security";
import { handleUploadChunk, handleAnalyzeReport } from "../upload";

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

export default router;
