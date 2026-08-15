import { Router } from "express";
import express from "express";
import { requireAuth } from "../firebase";
import { aiUserLimiter } from "../middleware/security";
import { handleUploadChunk } from "../upload";

const router = Router();

router.post(
  "/upload-chunk",
  requireAuth,
  aiUserLimiter,
  express.json({ limit: "50mb" }),
  handleUploadChunk
);

export default router;
