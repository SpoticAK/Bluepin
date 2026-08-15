import { Type } from "@google/genai";
import sharp from "sharp";
import { client } from "../gemini";

// ─── Prompt & Schema ────────────────────────────────────────────────────────

export const GLUCOSE_PROMPT = `Extract from this glucometer image: glucose value, unit (mg/dL or mmol/L), date (YYYY-MM-DD), time (HH:mm).
If not a glucometer or unreadable, set success=false and errorMsg to a user-friendly message.
Respond in the given JSON schema.`;

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

// ─── Image Optimisation ─────────────────────────────────────────────────────

const TARGET_WIDTH = 350; // px — enough for any glucometer display
const JPEG_QUALITY = 82; // good balance of size vs. legibility

interface OptimisedImage {
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
    base64Data: outputBuffer.toString("base64"),
    mimeType: "image/jpeg",
  };
}

// ─── AI Client ──────────────────────────────────────────────────────────────

/**
 * Extracts glucose readings from a base64 encoded image using Gemini AI.
 * Optimises the image before sending to minimise token usage.
 */
export async function extractGlucoseFromBase64(
  base64Data: string,
  mimeType: string,
): Promise<GlucoseExtractionResult> {
  const optimised = await optimiseImage(base64Data, mimeType);

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

  console.log(response.usage);
  console.log(response.output_text);

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

  return result;
}
