import { Type } from "@google/genai";
import pdfParse from "pdf-parse";
import sharp from "sharp";
import { matchBiomarker } from "../../src/lib/registry/biomarkerLookup";
import { client } from "../gemini";
import { createLruCache, hashBuffer } from "../utils/cache";

// ─── Prompts & Schema ─────────────────────────────────────────────────────────

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

// ─── Post-processing ─────────────────────────────────────────────────────────

export function processLabReportResult(result: any) {
  if (!result || !result.sections) return result;

  const biomarkers: any[] = [];
  for (const section of result.sections) {
    for (const b of section.biomarkers || []) {
      let cat = section.category;
      if (!cat || cat === "Others") {
        cat = b.categoryFallback || cat || "Others";
      }
      biomarkers.push({
        ...b,
        category: cat,
      });
    }
  }

  result.biomarkers = biomarkers.map((b: any) => {
    const match = matchBiomarker(b.name, {
      reportType: result.reportType,
      section: b.category,
      unit: b.unit,
    });

    const validCategories = [
      "Blood Profile",
      "Glucose Profile",
      "Lipid Profile",
      "Liver Function",
      "Kidney Function",
      "Thyroid Function",
      "Vitamins",
      "Urine Analysis",
      "Others",
    ];
    let finalCategory = b.category;
    if (!validCategories.includes(finalCategory)) {
      finalCategory = match.profile;
    } else if (finalCategory === "Others" && match.profile && match.profile !== "Others") {
      finalCategory = match.profile;
    }
    return {
      ...b,
      originalName: b.name,
      name: match.canonicalName || b.name,
      biomarkerId: match.biomarkerId,
      category: finalCategory,
      confidence: match.confidence,
      matchedBy: match.matchedBy,
    };
  });

  delete result.sections;
  return result;
}

// ─── Image Optimization & Cache ─────────────────────────────────────────────

const reportCache = createLruCache<any>(100);

const REPORT_TARGET_WIDTH = 1800; // Optimal for A4 medical document table readability
const REPORT_JPEG_QUALITY = 85;

async function optimiseReportImage(
  inputBuffer: Buffer,
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const needsResize = originalWidth > REPORT_TARGET_WIDTH;

  const outputBuffer = await sharp(inputBuffer)
    .resize(
      needsResize
        ? { width: REPORT_TARGET_WIDTH, withoutEnlargement: true }
        : undefined,
    )
    .jpeg({ quality: REPORT_JPEG_QUALITY })
    .toBuffer();

  return { buffer: outputBuffer, mimeType: "image/jpeg" };
}

// ─── AI Extraction ──────────────────────────────────────────────────────────

export async function extractLabReportFromUrl(fileUrl: string, mimeType?: string) {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error("Failed to fetch file from storage URL");
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10MB limit.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const fileHash = hashBuffer(buffer);
  const cached = reportCache.get(fileHash);
  if (cached) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[LabReportCache] HIT  ${fileHash.slice(0, 12)}… (${reportCache.size()}/100 entries)`);
    }
    return cached;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[LabReportCache] MISS ${fileHash.slice(0, 12)}… — calling Gemini`);
  }

  let detectedMime = (
    mimeType ||
    fileRes.headers.get("content-type") ||
    "application/pdf"
  )
    .split(";")[0]
    .trim();

  let payloadData = buffer.toString("base64");

  // 1. If digital PDF, extract text directly to save latency and token usage
  let extractedText = "";
  if (detectedMime === "application/pdf") {
    try {
      const parsedPdf = await pdfParse(buffer);
      if (parsedPdf.text && parsedPdf.text.trim().length >= 50) {
        extractedText = parsedPdf.text.trim();
      }
    } catch {
      // Scanned PDF / non-extractable text falls back to visual document analysis
    }
  }

  // 2. If image, optimize resolution and compress to compact JPEG
  if (!extractedText && detectedMime.startsWith("image/")) {
    try {
      const optimised = await optimiseReportImage(buffer);
      payloadData = optimised.buffer.toString("base64");
      detectedMime = optimised.mimeType;
    } catch {
      /* fallback to original image buffer */
    }
  }

  // 3. Build input parts: text prompt for digital PDFs, base64 document/image for visual files
  const input = extractedText
    ? [
        {
          type: "text",
          text: `${LAB_REPORT_PROMPT}\n\nLAB REPORT TEXT CONTENT:\n${extractedText}`,
        },
      ]
    : [
        {
          type: detectedMime === "application/pdf" ? "document" : "image",
          mime_type: detectedMime,
          data: payloadData,
        },
        {
          type: "text",
          text: LAB_REPORT_PROMPT,
        },
      ];

  const response = await (client as any).interactions.create({
    model: "gemini-3.5-flash-lite",
    input,
    response_format: [
      {
        type: "text",
        mime_type: "application/json",
        schema: LAB_REPORT_SCHEMA,
      },
    ],
    generation_config: {
      thinking_level: "minimal",
    },
  });

  const rawText = (response as any)?.output_text ?? (response as any)?.text;
  if (!rawText) {
    throw new Error("No response from AI model");
  }

  const rawResult = JSON.parse(rawText);
  const result = processLabReportResult(rawResult);

  if (result.success) {
    reportCache.set(fileHash, result);
  }

  return result;
}
