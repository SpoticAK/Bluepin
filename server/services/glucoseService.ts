import { createHash } from "crypto";
import { Type } from "@google/genai";
import sharp from "sharp";
import { client } from "../gemini";

// ─── Prompt & Schema ────────────────────────────────────────────────────────

export const GLUCOSE_PROMPT = `Extract data from this glucometer image and return ONLY a JSON object matching the schema.
- success: true if readable glucometer image, false otherwise
- value: the glucose reading as a plain numeric string only, e.g. "108" or "5.4" — no explanations, no extra text
- unit: exactly "mg/dL" or "mmol/L"
- readingDate: YYYY-MM-DD if the full date including year is visible, otherwise omit
- readingTime: HH:mm 24-hour format if visible, otherwise omit
- errorMsg: user-friendly message only when success is false
Do not include any reasoning, notes, or explanation in any field.`;

export const GLUCOSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: { type: Type.BOOLEAN },
    value: { type: Type.STRING },
    unit: { type: Type.STRING },
    readingDate: { type: Type.STRING },
    readingTime: { type: Type.STRING },
    errorMsg: { type: Type.STRING },
  },
  required: ["success"],
};

export interface GlucoseExtractionResult {
  success: boolean;
  value?: number;
  unit?: string;
  readingDate?: string;
  readingTime?: string;
  errorMsg?: string;
}

// ─── Image Hash Cache ────────────────────────────────────────────────────────

const CACHE_MAX_SIZE = 100; // max entries kept in memory

/**
 * Simple LRU cache backed by a Map (insertion-order iteration).
 * On a hit the entry is promoted to most-recently-used by re-insertion.
 */
const extractionCache = new Map<string, GlucoseExtractionResult>();

function cacheGet(key: string): GlucoseExtractionResult | undefined {
  const value = extractionCache.get(key);
  if (value !== undefined) {
    // Promote to MRU position
    extractionCache.delete(key);
    extractionCache.set(key, value);
  }
  return value;
}

function cacheSet(key: string, value: GlucoseExtractionResult): void {
  if (extractionCache.has(key)) extractionCache.delete(key);
  else if (extractionCache.size >= CACHE_MAX_SIZE) {
    // Evict least-recently-used (first entry in insertion order)
    extractionCache.delete(extractionCache.keys().next().value!);
  }
  extractionCache.set(key, value);
}

function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

const TARGET_WIDTH = 350; // px — enough for any glucometer display
const JPEG_QUALITY = 82; // good balance of size vs. legibility

interface OptimisedImage {
  buffer: Buffer;
  base64Data: string;
  mimeType: "image/jpeg";
}

/**
 * Prepares an image for AI processing:
 * - Images wider than TARGET_WIDTH are downscaled.
 * - Images already at or below TARGET_WIDTH are left at their original size
 *   (withoutEnlargement ensures we never upscale).
 * - Output is always converted to JPEG for consistent, compact encoding.
 */
async function optimiseImage(
  base64Data: string,
  mimeType: string,
): Promise<OptimisedImage> {
  const inputBuffer = Buffer.from(base64Data, "base64");

  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width ?? 0;

  const needsResize = originalWidth > TARGET_WIDTH;

  const outputBuffer = await sharp(inputBuffer)
    .resize(
      needsResize
        ? { width: TARGET_WIDTH, withoutEnlargement: true }
        : undefined, // skip resize entirely for small images
    )
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  if (process.env.NODE_ENV !== "production") {
    const savedBytes = inputBuffer.length - outputBuffer.length;
    console.log(
      `[ImageOptimiser] ${originalWidth}px wide | ` +
        `${needsResize ? `resized to ${TARGET_WIDTH}px` : "kept original size"} | ` +
        `${inputBuffer.length} → ${outputBuffer.length} bytes ` +
        `(${savedBytes > 0 ? `-${Math.round((savedBytes / inputBuffer.length) * 100)}%` : "no size reduction"})`,
    );
  }

  return {
    buffer: outputBuffer,
    base64Data: outputBuffer.toString("base64"),
    mimeType: "image/jpeg",
  };
}

// ─── AI Client ──────────────────────────────────────────────────────────────

/**
 * Extracts glucose readings from a base64 encoded image using Gemini AI.
 * Optimises the image before sending to minimise token usage.
 * Results are cached by the SHA-256 hash of the optimised JPEG buffer so that
 * re-uploading the same image never triggers a second API call.
 */
export async function extractGlucoseFromBase64(
  base64Data: string,
  mimeType: string,
): Promise<GlucoseExtractionResult> {
  const optimised = await optimiseImage(base64Data, mimeType);

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const imageHash = hashBuffer(optimised.buffer);
  const cached = cacheGet(imageHash);
  if (cached) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[GlucoseCache] HIT  ${imageHash.slice(0, 12)}… (${extractionCache.size}/${CACHE_MAX_SIZE} entries)`,
      );
    }
    return cached;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[GlucoseCache] MISS ${imageHash.slice(0, 12)}… — calling Gemini`,
    );
  }

  const response = await client.interactions.create({
    model: "gemini-3.5-flash-lite",
    input: [
      {
        type: "image",
        mime_type: optimised.mimeType,
        data: optimised.base64Data,
      },
      {
        type: "text",
        text: GLUCOSE_PROMPT,
      },
    ],
    response_format: [
      {
        type: "text",
        mime_type: "application/json",
        schema: GLUCOSE_SCHEMA,
      },
    ],
    generation_config: {
      thinking_level: "minimal",
    },
  });

  // console.log(response.usage);
  // console.log(response.output_text);

  const rawText = (response as any)?.output_text ?? (response as any)?.text;

  if (!response || !rawText) {
    throw new Error("Could not process reading. Please try again.");
  }

  const result: GlucoseExtractionResult = JSON.parse(rawText);

  if (result.value != null) {
    const num = parseFloat(result.value as unknown as string);
    if (!isNaN(num)) {
      // mg/dL is always a whole number; mmol/L keeps one decimal place
      result.value =
        result.unit === "mmol/L" ? Math.round(num * 10) / 10 : Math.round(num);
    }
  }

  // Only cache successful extractions; errors may be transient
  if (result.success) {
    cacheSet(imageHash, result);
  }

  return result;
}
