import { Type } from "@google/genai";
import pdfParse from "pdf-parse";
import sharp from "sharp";
import { matchBiomarker } from "../../src/lib/registry/biomarkerLookup";
import { client } from "../gemini";
import { createLruCache, hashBuffer } from "../utils/cache";
import { extractPdfToMarkdown } from "./pdfMarkdownService";
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
                  type: Type.NUMBER,
                  description:
                    "Numeric minimum of reference range. For '< X' ranges, use 0.",
                },
                refMax: {
                  type: Type.NUMBER,
                  description:
                    "Numeric maximum of reference range. For '> X' or '< X' ranges, use X.",
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
        // Mixed sections: each biomarker declares its own category via categoryOverride
        // Fall back to "Others" if not provided — matchBiomarker will correct it
        inheritedCategory = b.categoryOverride || "Others";
      } else {
        // Typed sections: inherit section category
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

    // ── Biomarker identity matching ────────────────────────────────────────
    const match = matchBiomarker(b.name, {
      reportType: result.reportType,
      section: b._inheritedCategory,
      unit: b.unit,
    });

    // ── Category resolution ────────────────────────────────────────────────
    // Priority order:
    // 1. For typed sections (non-mixed): trust section inheritance — it's
    //    the most reliable signal. Only let matchBiomarker win if the
    //    inherited category itself is invalid or "Others".
    // 2. For mixed sections: trust matchBiomarker (High confidence) since
    //    the section gave no categorical guidance. Fall back to categoryOverride
    //    if match confidence is not High.

    let finalCategory: string = b._inheritedCategory;

    if (b._sectionIsMixed) {
      // Mixed section: biomarker identity is the source of truth
      if (
        match.confidence === "High" &&
        match.profile &&
        isValidCategory(match.profile)
      ) {
        finalCategory = match.profile;
      } else if (isValidCategory(b._inheritedCategory)) {
        finalCategory = b._inheritedCategory; // use categoryOverride from AI if valid
      } else {
        finalCategory = "Others";
      }
    } else {
      // Typed section: only override if inherited category is unusable
      if (!isValidCategory(finalCategory) || finalCategory === "Others") {
        if (match.profile && isValidCategory(match.profile)) {
          finalCategory = match.profile;
        } else {
          finalCategory = "Others";
        }
      }
      // else: inherited section category is valid and trusted — keep it
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
      // Numeric value for calculations; null if qualitative
      value: isQualitative ? null : numericValue,
      // Preserve the raw string for display and qualitative results
      rawValue,
      isQualitative,
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
  let buffer = Buffer.from(arrayBuffer);
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10MB limit.");
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

  // 1. If PDF, extract markdown using PyMuPDF4LLM (with pdfParse fallback)
  let extractedText = "";
  if (detectedMime === "application/pdf") {
    try {
      const markdown = await extractPdfToMarkdown({ buffer, fileUrl });
      if (markdown && markdown.length >= 20) {
        extractedText = markdown;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[PyMuPDF4LLM] Successfully extracted ${markdown.length} chars of structured Markdown.`,
          );
        }
      } else {
        const parsedPdf = await pdfParse(buffer);
        if (parsedPdf.text && parsedPdf.text.trim().length >= 50) {
          extractedText = parsedPdf.text.trim();
        }
      }
    } catch {
      // Fallback to pdfParse or visual document analysis
      try {
        const parsedPdf = await pdfParse(buffer);
        if (parsedPdf.text && parsedPdf.text.trim().length >= 50) {
          extractedText = parsedPdf.text.trim();
        }
      } catch {
        /* Scanned PDF / non-extractable text falls back to visual document analysis */
      }
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

  const preparedText = prepareMarkdownForModel(extractedText);

  // 3. Build input parts: text prompt for digital PDFs/markdown, base64 document/image for visual files
  const input = preparedText
    ? [
        {
          type: "text",
          text: `${LAB_REPORT_PROMPT}\n\nLAB REPORT STRUCTURED CONTENT:\n${preparedText}`,
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
  // console.log(response.usage);

  // const rawResult = JSON.parse(rawText);
  const rawResult = safeParseJSON(rawText);
  const result = processLabReportResult(rawResult);

  if (result.success) {
    reportCache.set(fileHash, result);
  }

  // ── Write output to a JSON file ──────────────────────────────────────────
  const outputDir = path.join(process.cwd(), "output");
  await fs.mkdir(outputDir, { recursive: true }); // Ensure the directory exists

  const filePath = path.join(outputDir, `lab-report-md-input.json`);

  // Format with 2-space indentation for human readability
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`Saved JSON output to: ${filePath}`);

  return result;
}

export function cleanLabReportMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const cleaned: string[] = [];
  const seenLines = new Set<string>();

  // These signal the start of explanatory blocks — skip until next table/header
  const skipSectionTriggers = [
    /^#+\s*(explanation|interpretation|summary and uses|limitations|reference|additional information)/i,
    /^(explanation|interpretation)[\s:-]/i,
  ];

  // Resume extraction when we see these
  const resumeTriggers = [
    /^\|/, // markdown table row
    /^#{1,3}\s+\w/, // new section header
    /^\*\*[A-Z]/, // bold header
  ];

  const noisePatterns = [
    /scan qr code/i,
    /electronically authenticated/i,
    /page \d+ of \d+/i,
    /^\s*dr[\s.]+\w/i, // doctor name lines
    /m\.?d\.?\s*(path|pathology)/i,
    /^\s*[a-z0-9]{1,3}\s*$/i, // stray artifact characters
    /national reference lab/i,
    /pathology lab that cares/i,
  ];

  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length < 2) {
      if (!skipping) cleaned.push(line);
      continue;
    }

    // Check if we should start skipping explanatory content
    if (skipSectionTriggers.some((p) => p.test(trimmed))) {
      skipping = true;
      continue;
    }

    // Check if we should resume (new data section started)
    if (skipping && resumeTriggers.some((p) => p.test(trimmed))) {
      skipping = false;
    }

    if (skipping) continue;

    // Skip noise
    if (noisePatterns.some((p) => p.test(trimmed))) continue;

    // Deduplicate short repeated lines (patient info, headers)
    if (trimmed.length < 120) {
      if (seenLines.has(trimmed)) continue;
      seenLines.add(trimmed);
    }

    cleaned.push(line);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n");
}

const MAX_MARKDOWN_CHARS = 80_000; // tune based on your model's context window

export function prepareMarkdownForModel(markdown: string): string {
  const cleaned = cleanLabReportMarkdown(markdown);

  if (cleaned.length > MAX_MARKDOWN_CHARS) {
    console.warn(
      `[LabReport] Markdown still ${cleaned.length} chars after cleaning, ` +
        `truncating to ${MAX_MARKDOWN_CHARS}. Consider splitting report pages.`,
    );
    // Truncate but try to end at a clean line boundary
    const truncated = cleaned.slice(0, MAX_MARKDOWN_CHARS);
    const lastNewline = truncated.lastIndexOf("\n");
    return lastNewline > MAX_MARKDOWN_CHARS * 0.9
      ? truncated.slice(0, lastNewline)
      : truncated;
  }

  return cleaned;
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
    // Find the sections array start
    const sectionsStart = raw.indexOf('"sections"');
    if (sectionsStart === -1) return null;

    // Try progressively shorter substrings to find parseable JSON
    // by closing open brackets
    let attempt = raw;
    for (let i = 0; i < 5; i++) {
      // Count unclosed brackets and close them
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
        // Trim to last complete-looking object and retry
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
