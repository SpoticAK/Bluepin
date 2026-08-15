import { Router } from "express";
import { globalIpLimiter } from "../middleware/security";
import uploadRouter from "./upload";
import insightsRouter from "./insights";
import feedbackRouter from "./feedback";

const apiRouter = Router();

// Apply global rate limiting to all /api routes
apiRouter.use(globalIpLimiter);

// Mount feature routes
apiRouter.use(uploadRouter);
apiRouter.use(insightsRouter);
apiRouter.use(feedbackRouter);

// Catch all unhandled API routes and return 404 JSON
apiRouter.all("/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found", path: req.baseUrl + req.path });
});

export default apiRouter;
