// ─── Shared helpers (put these in lib/fileUtils.ts ideally) ──────────────────

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    // Fix #2: rejects with a proper Error, not a raw ProgressEvent
    reader.onerror = () =>
      reject(new Error("Failed to read file. Please try again."));
  });
}

export function detectMimeType(file: File): string {
  // Fix #1: single, shared ext lookup — no shadowing
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return file.type || "image/jpeg";
}

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const CHUNK_SIZE = 10 * 1024 * 1024;
