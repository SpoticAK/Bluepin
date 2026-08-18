import { jsonrepair } from "jsonrepair";

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
