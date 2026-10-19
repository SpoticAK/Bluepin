import { Router } from "express";
import { config } from "../config";

const router = Router();

/**
 * GET /api/health — deploy verification + load-balancer health check.
 * Returns environment identity only. Never secrets.
 */
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: config.envName,
    whatsappMode: config.whatsapp.mode,
    now: new Date().toISOString(),
  });
});

export default router;
