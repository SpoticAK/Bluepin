import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export async function generateContentWithRetry(options: any, maxRetries = 5) {
  if (options.model && typeof options.model === 'string' && options.model.includes('3.6')) {
    options.config = options.config || {};
    options.config.thinkingConfig = { thinkingLevel: "minimal" };
  }
  const ai = getAiClient();
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(options);
    } catch (error: any) {
      const errorStr = JSON.stringify(error) + (error?.message || '');
      if (
        errorStr.includes('503') ||
        errorStr.includes('UNAVAILABLE') ||
        errorStr.includes('high demand') ||
        errorStr.includes('429') ||
        errorStr.toLowerCase().includes('rate') ||
        errorStr.toLowerCase().includes('quota')
      ) {
        if (i === maxRetries - 1) throw error;
        
        // Fallback to a stable model if the current one is overloaded
        if (options.model === 'gemini-3.5-flash-lite') {
          console.log(`[Gemini API] Falling back from ${options.model} to gemini-3.5-flash-lite`);
          options.model = 'gemini-3.5-flash-lite';
        }

        const waitMs = Math.pow(2, i + 1) * 1000 + Math.random() * 2000;
        console.log(`[Gemini API] Rate limit or high demand (503/429). Retrying with model ${options.model} in ${Math.round(waitMs / 1000)}s... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }
}
