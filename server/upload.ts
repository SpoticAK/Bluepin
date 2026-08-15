import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { Type } from "@google/genai";
import { matchBiomarker } from "../src/lib/registry/biomarkerLookup";
import { getAiClient, generateContentWithRetry } from "./gemini";
import { extractGlucoseFromBase64 } from "./services/glucoseService";

// Multer configuration for file uploads
export const upload = multer({ 
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

// Prompts for AI extraction
export const LAB_REPORT_PROMPT = `Extract biomarker values from this lab report. For each identified biomarker, provide its name, value, unit, and the reference minimum/maximum normally listed.

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


export const LAB_REPORT_SCHEMA = {
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

export function processLabReportResult(result: any) {
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

// In-memory chunk store for multipart chunk uploads
export const chunkStore = new Map<string, string[]>();

export const UploadChunkSchema = z.object({
  uploadId: z.string().min(1).max(100),
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1).max(100),
  chunkData: z.string().max(14 * 1024 * 1024), // ~10MB in base64
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
  type: z.enum(["glucose", "lab-report"])
});

export async function handleUploadChunk(req: Request, res: Response) {
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
      
      console.log(`[Upload Chunk Test] File assembled successfully. User: ${userScopedUploadId}, Type: ${type}, MimeType: ${mimeType}, Size: ~${Math.round(estimatedSize / 1024)} KB`);

      if (type === "glucose") {
        const result = await extractGlucoseFromBase64(fullBase64, mimeType);
        return res.json(result);
      } else {
        return res.json({
          success: true,
          testDate: new Date().toISOString().split('T')[0],
          biomarkers: [
            {
              id: "test-hba1c",
              name: "HbA1c",
              originalName: "Hemoglobin A1c",
              value: 5.6,
              unit: "%",
              refMin: 4.0,
              refMax: 5.6,
              status: "Normal",
              refRangeText: "4.0 - 5.6"
            },
            {
              id: "test-fasting-glucose",
              name: "Fasting Blood Sugar",
              originalName: "Fasting Blood Glucose",
              value: 95,
              unit: "mg/dL",
              refMin: 70,
              refMax: 99,
              status: "Normal",
              refRangeText: "70 - 99"
            }
          ]
        });
      }
    }
    return res.json({ status: "chunk_received" });
  } catch (error: any) {
    chunkStore.delete(userScopedUploadId);
    const errStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const errMsg = error.message || errStr;
    console.error("Chunk extraction error:", errMsg);
    let userMsg = errMsg;
    const errLower = errMsg.toLowerCase();
    if (errLower.includes("the document has no pages") || errLower.includes("invalid argument") || errLower.includes("400")) {
      userMsg = type === "glucose" 
        ? "Could not read the glucose value from the image. Please ensure the display is clear and legible." 
        : "The uploaded file could not be processed. If this is a PDF, it might be too large, encrypted, or contain unsupported images. Please try taking a screenshot or photo of the report instead.";
    } else if (errLower.includes("rate") || errLower.includes("quota") || errLower.includes("429") || errLower.includes("503")) {
      userMsg = "Service is currently busy. Please try again in a few moments.";
    } else {
      userMsg = type === "glucose"
        ? "An error occurred while reading the image. Please try again or enter the value manually."
        : "An error occurred while analyzing the document. Please try uploading an image instead of a PDF.";
    }
    return res.status(400).json({ error: userMsg });
  }
}
