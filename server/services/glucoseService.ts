import { GoogleGenAI, Type } from "@google/genai";

export const GLUCOSE_PROMPT = `Extract the glucose reading (mg/dL or mmol/L) from this glucometer display image.
- If there is a date and time shown on the device screen, extract them too.
- If the image is not a glucometer display or is illegible, set success to false and provide a clean, helpful errorMsg (e.g. 'Could not read glucose value. Please make sure the glucometer screen is clearly visible.'). Do not mention AI, bots, or language models.
- Respond strictly matching the JSON schema.`;

export const GLUCOSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: {
      type: Type.BOOLEAN,
      description:
        "True if a valid glucose reading was identified on the glucometer display.",
    },
    value: {
      type: Type.NUMBER,
      description: "The numeric blood glucose value (e.g. 110, 5.6).",
    },
    unit: {
      type: Type.STRING,
      description: "Unit of measurement: 'mg/dL' or 'mmol/L'.",
    },
    readingDate: {
      type: Type.STRING,
      description: "Date shown on device in YYYY-MM-DD format if available.",
    },
    readingTime: {
      type: Type.STRING,
      description: "Time shown on device in HH:mm format if available.",
    },
    errorMsg: {
      type: Type.STRING,
      description: "Error explanation if image is blurry or not a glucometer.",
    },
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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Extracts glucose readings from a base64 encoded image using Gemini AI.
 * Loose coupling: Independent service that handles prompt engineering, AI invocation, and response parsing.
 */
export async function extractGlucoseFromBase64(
  base64Data: string,
  mimeType: string,
): Promise<GlucoseExtractionResult> {
  const response = await ai.interactions.create({
    model: "gemini-3.5-flash-lite",
    input: [
      {
        type: "image",
        mime_type: mimeType,
        data: base64Data,
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

  console.log("Glucose Service response: ", response);

  const rawText = (response as any)?.output_text ?? (response as any)?.text;

  if (!response || !rawText) {
    throw new Error("Could not process reading. Please try again.");
  }

  const result: GlucoseExtractionResult = JSON.parse(rawText);
  if (result.value !== undefined && result.value !== null) {
    const num = Number(result.value);
    if (!isNaN(num)) {
      result.value = Math.round(num);
    }
  }
  return result;
}
