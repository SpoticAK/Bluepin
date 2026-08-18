import path from "path";
import fs from "fs";
import { spawn } from "child_process";

export interface PdfMarkdownResult {
  success: boolean;
  markdown?: string;
  page_count?: number;
  error?: string;
}

/**
 * Executes the Python PyMuPDF4LLM script locally via child_process using the virtual environment.
 */
async function extractViaLocalPython(payload: { fileUrl?: string; fileBase64?: string }): Promise<string | null> {
  const isWindows = process.platform === "win32";
  const pythonPath = path.resolve(
    process.cwd(),
    "functions",
    "venv",
    isWindows ? "Scripts/python.exe" : "bin/python"
  );
  const scriptPath = path.resolve(process.cwd(), "functions", "main.py");

  if (!fs.existsSync(pythonPath) || !fs.existsSync(scriptPath)) {
    return null;
  }

  return new Promise((resolve) => {
    const pyProcess = spawn(pythonPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    pyProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pyProcess.on("close", (code) => {
      if (code !== 0) {
        console.warn(`[PyMuPDF4LLM] Local Python process exited with code ${code}. Stderr: ${stderr.trim()}`);
        return resolve(null);
      }

      try {
        const parsed: PdfMarkdownResult = JSON.parse(stdout.trim());
        if (parsed.success && parsed.markdown && parsed.markdown.trim().length > 0) {
          resolve(parsed.markdown.trim());
        } else {
          console.warn(`[PyMuPDF4LLM] Extraction failed or returned empty: ${parsed.error || "No content"}`);
          resolve(null);
        }
      } catch (err: any) {
        console.warn(`[PyMuPDF4LLM] Failed to parse Python stdout: ${err.message}`);
        resolve(null);
      }
    });

    pyProcess.on("error", (err) => {
      console.warn(`[PyMuPDF4LLM] Failed to spawn Python process: ${err.message}`);
      resolve(null);
    });

    // Write input JSON to Python process stdin
    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
}

/**
 * Calls the deployed Firebase Cloud Function endpoint if PDF_MARKDOWN_FUNCTION_URL is configured.
 */
async function extractViaCloudFunction(url: string, payload: { fileUrl?: string; fileBase64?: string }): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[PyMuPDF4LLM] Cloud Function responded with status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as PdfMarkdownResult;
    if (data.success && data.markdown && data.markdown.trim().length > 0) {
      return data.markdown.trim();
    }
    return null;
  } catch (err: any) {
    console.warn(`[PyMuPDF4LLM] Cloud Function request failed: ${err.message}`);
    return null;
  }
}

/**
 * Extracts structured Markdown from a PDF document using PyMuPDF4LLM.
 * Tries Firebase Cloud Function endpoint first (if configured), then local virtualenv Python runner.
 */
export async function extractPdfToMarkdown(options: {
  fileUrl?: string;
  fileBase64?: string;
  buffer?: Buffer;
}): Promise<string | null> {
  const { fileUrl, fileBase64, buffer } = options;
  const payload: { fileUrl?: string; fileBase64?: string } = {};

  if (fileUrl) {
    payload.fileUrl = fileUrl;
  } else if (fileBase64) {
    payload.fileBase64 = fileBase64;
  } else if (buffer) {
    payload.fileBase64 = buffer.toString("base64");
  } else {
    return null;
  }

  // 1. If Firebase Cloud Function URL is provided in env, use it
  const cloudFunctionUrl = process.env.PDF_MARKDOWN_FUNCTION_URL;
  if (cloudFunctionUrl) {
    const result = await extractViaCloudFunction(cloudFunctionUrl, payload);
    if (result) return result;
  }

  // 2. Otherwise/Fallback: Run local Python in functions/venv
  return await extractViaLocalPython(payload);
}
