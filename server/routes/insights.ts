import { Router } from "express";
import { z } from "zod";
import { Type } from "@google/genai";
import { generateContentWithRetry } from "../gemini";
import { requireAuth } from "../firebase";
import { aiUserLimiter } from "../middleware/security";
import express from "express";

const router = Router();

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

const insightResponseSchema = {
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

router.post(
  "/generate-insights",
  requireAuth,
  aiUserLimiter,
  express.json({ limit: "5mb" }),
  async (req, res) => {
    try {
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

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash-lite", // Route insights to cheaper 8b model
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: insightResponseSchema
        }
      });

      if (!response || !response.text) {
        throw new Error("No response text received from Gemini");
      }

      const result = JSON.parse(response.text);
      res.json(result);
    } catch (error: any) {
      console.error("AI Insights error:", error.message || "Unknown error");
      res.status(500).json({ error: "Failed to generate AI insights" });
    }
  }
);

export default router;
