import { Type } from "@google/genai";
import sharp from "sharp";
import { matchBiomarker } from "../../src/lib/registry/biomarkerLookup";
import { client } from "../gemini";
import { createLruCache, hashBuffer } from "../utils/cache";
import fs from "fs/promises";
import path from "path";
import { jsonrepair } from "jsonrepair";

// ─── Prompts & Schema ─────────────────────────────────────────────────────────

export const LAB_REPORT_PROMPT = `Extract biomarker values from this lab report. For each identified biomarker, provide its name, value, unit, and the reference minimum/maximum normally listed.

CATEGORIZATION RULES:
You must categorize each biomarker into one of these EXACT categories: 'Blood Profile', 'Glucose Profile', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Function', 'Vitamins', 'Urine Analysis', or 'Others'. Do not create any custom categories.

The parser should NOT immediately classify biomarkers. Instead it should work in this order:

STEP 1 — Parse the report structure
Before categorizing a single biomarker, detect the report hierarchy. Recognize common section headers:

TYPED SECTIONS — all biomarkers inherit the section category:
- Complete Blood Count, CBC, Hemogram, Blood Profile, Haematology -> Blood Profile
- Urine Routine, Urine Analysis, Urine Routine Examination, Urinalysis -> Urine Analysis
- Liver Function Test, Liver Profile, LFT, Hepatic Function -> Liver Function
- Kidney Function Test, Renal Function Test, KFT, RFT, Renal Profile -> Kidney Function
- Lipid Profile, Lipid Panel -> Lipid Profile
- Diabetes Profile, Glucose Profile -> Glucose Profile
- Thyroid Profile, Thyroid Function Test, TFT -> Thyroid Function
- Vitamins, Micronutrients -> Vitamins
- Electrolytes -> Kidney Function

MIXED SECTIONS — these headers contain biomarkers from multiple profiles.
Set isMixedSection: true for these. Do NOT inherit the section name as a category.
Each biomarker inside must be categorized individually using STEP 3 rules:
- Biochemistry
- Clinical Chemistry
- Chemistry Panel
- Metabolic Panel
- Blood Chemistry
- Serology
- Immunoassay
- Others
- Standalone

Every biomarker beneath a TYPED section header should inherit that section's category until another header is encountered.
Do NOT flatten the report. Preserve the hierarchy.

STEP 2 — Categorize using section context
If a biomarker belongs to a TYPED section, the section category ALWAYS wins.
Example: Under 'URINE ROUTINE', 'Albumin', 'Protein', 'Glucose', 'RBC', 'WBC', 'Ketones' all belong to 'Urine Analysis'.
Example: Under 'LIVER FUNCTION TEST', 'Albumin' belongs to 'Liver Function'.
Example: Under 'BIOCHEMISTRY' (MIXED), 'SGPT' belongs to 'Liver Function', 'Creatinine' belongs to 'Kidney Function'.

STEP 3 — Biomarker-level categorization (used for MIXED sections and standalone biomarkers)
When a biomarker is in a MIXED section or appears outside any recognized section, use standard definitions:
- Albumin -> Liver Function (unless in Urine section)
- Glucose, HbA1c, Fasting Blood Sugar -> Glucose Profile
- ALT, AST, SGPT, SGOT, Bilirubin, GGT, ALP -> Liver Function
- Creatinine, Urea, BUN, Uric Acid, eGFR, Calcium, Sodium, Potassium, Chloride -> Kidney Function
- RBC, WBC, Hemoglobin, Platelets, MCV, MCH, MCHC, ESR, Iron -> Blood Profile
- TSH, T3, T4 -> Thyroid Function
- Vitamin D, Vitamin B12, Folate -> Vitamins
- Cholesterol, Triglycerides, HDL, LDL, VLDL -> Lipid Profile
- PSA, IgE, Homocysteine, HIV, HBsAg -> Others

CRITICAL RULES:
- Value may be numeric (7.1) OR qualitative ("Present", "Absent", "Trace", "Non Reactive", "Positive"). Always extract it as a string.
- Complete biomarker names must ALWAYS be taken exactly as written in the report.
- Whenever there is duplicacy of biomarker in the same profile, recheck to ensure you did not accidentally shorten different biomarkers to the same name.
- Output status as 'Low', 'Normal', 'High', or 'Borderline'.
- Do not discard any extracted medical information, including qualitative results.`;

export const LAB_REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: {
      type: Type.BOOLEAN,
      description: "True if any lab results were found.",
    },
    reportDate: {
      type: Type.STRING,
      description: "The date of the report in YYYY-MM-DD format, if available.",
    },
    reportType: {
      type: Type.STRING,
      description:
        "Infer report type, e.g. CBC, LFT, KFT, LIPID, URINE_ROUTINE, THYROID, GLUCOSE, VITAMINS, UNKNOWN",
    },
    specimenType: {
      type: Type.STRING,
      description:
        "Infer primary specimen type, e.g. Blood, Urine, Saliva, Stool, Unknown",
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionName: {
            type: Type.STRING,
            description:
              "The header of the section exactly as written in the report (e.g. 'URINE ROUTINE', 'Biochemistry'). Use 'Standalone' if no header.",
          },
          category: {
            type: Type.STRING,
            description:
              "The categorized profile for TYPED sections. For MIXED sections, set this to 'Mixed'.",
          },
          isMixedSection: {
            type: Type.BOOLEAN,
            description:
              "True for sections like Biochemistry, Immunoassay, Serology, Clinical Chemistry that contain biomarkers from multiple profiles. When true, each biomarker is categorized individually.",
          },
          biomarkers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description:
                    "Biomarker name exactly as written in the report.",
                },
                value: {
                  type: Type.STRING,
                  description:
                    "The result value as a string. May be numeric ('7.10', '141.0') or qualitative ('Present', 'Absent', 'Trace', 'Non Reactive', 'Positive', 'Negative'). Never omit a biomarker because its value is non-numeric.",
                },
                unit: {
                  type: Type.STRING,
                  description: "Unit of measurement. Empty string if none.",
                },
                refMin: {
                  type: Type.STRING,
                  description:
                    "Numeric minimum of reference range as string (e.g. '0', '13.5'). For '< X' ranges, use '0'.",
                },
                refMax: {
                  type: Type.STRING,
                  description:
                    "Numeric maximum of reference range as string (e.g. '150', '4.5'). For '> X' or '< X' ranges, use 'X'.",
                },
                refRangeText: {
                  type: Type.STRING,
                  description:
                    "The exact reference range string from the report. Always extract if present.",
                },
                status: {
                  type: Type.STRING,
                  description: "One of: 'Low', 'Normal', 'High', 'Borderline'",
                },
                categoryOverride: {
                  type: Type.STRING,
                  description:
                    "Only for biomarkers inside MIXED sections: the specific category this biomarker belongs to (e.g. 'Liver Function', 'Kidney Function'). Leave empty for TYPED section biomarkers.",
                },
              },
              required: ["name", "value", "unit", "refRangeText", "status"],
            },
          },
        },
        required: ["sectionName", "category", "isMixedSection", "biomarkers"],
      },
    },
  },
  required: ["success", "sections"],
};

// ─── Post-processing ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Blood Profile",
  "Glucose Profile",
  "Lipid Profile",
  "Liver Function",
  "Kidney Function",
  "Thyroid Function",
  "Vitamins",
  "Urine Analysis",
  "Others",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(cat: string): cat is ValidCategory {
  return VALID_CATEGORIES.includes(cat as ValidCategory);
}

export function processLabReportResult(result: any) {
  if (!result || !result.sections) return result;

  const biomarkers: any[] = [];

  for (const section of result.sections) {
    const isMixed: boolean = section.isMixedSection === true;

    for (const b of section.biomarkers || []) {
      let inheritedCategory: string;

      if (isMixed) {
        inheritedCategory = b.categoryOverride || "Others";
      } else {
        inheritedCategory = section.category || "Others";
      }

      biomarkers.push({
        ...b,
        _inheritedCategory: inheritedCategory,
        _sectionIsMixed: isMixed,
      });
    }
  }

  result.biomarkers = biomarkers.map((b: any) => {
    // ── Value parsing ──────────────────────────────────────────────────────
    const rawValue: string = String(b.value ?? "");
    const numericValue = parseFloat(rawValue);
    const isQualitative = isNaN(numericValue);

    // ── Ref min/max parsing ────────────────────────────────────────────────
    const parseRef = (val: any): number | null => {
      if (val == null || val === "") return null;
      const num = typeof val === "number" ? val : parseFloat(String(val).trim());
      return isNaN(num) ? null : parseFloat(num.toFixed(4));
    };
    const refMin = parseRef(b.refMin);
    const refMax = parseRef(b.refMax);

    // ── Biomarker identity matching ────────────────────────────────────────
    const match = matchBiomarker(b.name, {
      reportType: result.reportType,
      section: b._inheritedCategory,
      unit: b.unit,
    });

    // ── Category resolution ────────────────────────────────────────────────
    let finalCategory: string = b._inheritedCategory;

    if (b._sectionIsMixed) {
      if (
        match.confidence === "High" &&
        match.profile &&
        isValidCategory(match.profile)
      ) {
        finalCategory = match.profile;
      } else if (isValidCategory(b._inheritedCategory)) {
        finalCategory = b._inheritedCategory;
      } else {
        finalCategory = "Others";
      }
    } else {
      if (!isValidCategory(finalCategory) || finalCategory === "Others") {
        if (match.profile && isValidCategory(match.profile)) {
          finalCategory = match.profile;
        } else {
          finalCategory = "Others";
        }
      }
    }

    // ── Clean up internal fields ───────────────────────────────────────────
    const {
      _inheritedCategory,
      _sectionIsMixed,
      categoryOverride,
      ...cleanBiomarker
    } = b;

    return {
      ...cleanBiomarker,
      originalName: b.name,
      name: match.canonicalName || b.name,
      value: isQualitative ? null : numericValue,
      rawValue,
      isQualitative,
      refMin,
      refMax,
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

export async function extractLabReportFromUrl(
  fileUrl: string,
  mimeType?: string,
) {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error("Failed to fetch file from storage URL");
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > 20 * 1024 * 1024) {
    // Increased to 20MB for larger native PDFs
    throw new Error("File exceeds size limit.");
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const fileHash = hashBuffer(buffer);
  const cached = reportCache.get(fileHash);
  if (cached) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[LabReportCache] HIT  ${fileHash.slice(0, 12)}… (${reportCache.size()}/100 entries)`,
      );
    }
    return cached;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[LabReportCache] MISS ${fileHash.slice(0, 12)}… — calling Gemini`,
    );
  }

  let detectedMime = (
    mimeType ||
    fileRes.headers.get("content-type") ||
    "application/pdf"
  )
    .split(";")[0]
    .trim();

  let payloadData = buffer.toString("base64");

  // If image, optimize resolution and compress to compact JPEG
  if (detectedMime.startsWith("image/")) {
    try {
      const optimised = await optimiseReportImage(buffer);
      payloadData = optimised.buffer.toString("base64");
      detectedMime = optimised.mimeType;
    } catch {
      /* fallback to original image buffer */
    }
  }

  // Build input parts: base64 document/image alongside the prompt
  const input = [
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

  // console.log(response.usage);

  const rawResult = safeParseJSON(rawText);
  const result = processLabReportResult(rawResult);

  if (result.success) {
    reportCache.set(fileHash, structuredClone(result));
  }

  // ── Write output to a JSON file ──────────────────────────────────────────
  // const outputDir = path.join(process.cwd(), "output");
  // await fs.mkdir(outputDir, { recursive: true });

  // const filePath = path.join(outputDir, `lab-report-direct-input.json`);

  // await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
  // console.log(`Saved JSON output to: ${filePath}`);

  return result;
}

export function safeParseJSON(raw: string): any {
  // First try clean parse
  try {
    return JSON.parse(raw);
  } catch (firstError) {
    // Try jsonrepair — handles truncation, trailing commas, unescaped chars
    try {
      const repaired = jsonrepair(raw);
      const result = JSON.parse(repaired);
      console.warn("[LabReport] JSON was malformed and required repair");
      return result;
    } catch (repairError) {
      // Last resort: try to extract partial valid JSON
      const partialResult = extractPartialJSON(raw);
      if (partialResult) {
        console.warn(
          "[LabReport] JSON was truncated — partial result recovered",
        );
        return partialResult;
      }
      // Re-throw original error with context
      throw new Error(
        `JSON parse failed after repair attempt. ` +
          `Raw length: ${raw.length}. ` +
          `Original error: ${(firstError as Error).message}`,
      );
    }
  }
}

// Attempts to recover a valid sections array even from truncated JSON
function extractPartialJSON(raw: string): any | null {
  try {
    const sectionsStart = raw.indexOf('"sections"');
    if (sectionsStart === -1) return null;

    let attempt = raw;
    for (let i = 0; i < 5; i++) {
      const openBraces = (attempt.match(/\{/g) || []).length;
      const closeBraces = (attempt.match(/\}/g) || []).length;
      const openBrackets = (attempt.match(/\[/g) || []).length;
      const closeBrackets = (attempt.match(/\]/g) || []).length;

      const closing =
        "]".repeat(Math.max(0, openBrackets - closeBrackets)) +
        "}".repeat(Math.max(0, openBraces - closeBraces));

      try {
        return JSON.parse(attempt + closing);
      } catch {
        const lastComplete = attempt.lastIndexOf("},");
        if (lastComplete === -1) break;
        attempt = attempt.slice(0, lastComplete + 1);
      }
    }
    return null;
  } catch {
    return null;
  }
}
