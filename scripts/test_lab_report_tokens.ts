import "../server/env";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { client } from "../server/gemini";
import {
  LAB_REPORT_PROMPT,
  LAB_REPORT_SCHEMA,
  prepareMarkdownForModel,
  processLabReportResult,
  safeParseJSON,
} from "../server/services/labReportService";
import { extractPdfToMarkdown } from "../server/services/pdfMarkdownService";

interface TokenUsage {
  prompt_tokens?: number;
  input_tokens?: number;
  promptTokenCount?: number;
  candidates_tokens?: number;
  output_tokens?: number;
  candidatesTokenCount?: number;
  total_tokens?: number;
  totalTokenCount?: number;
  thinking_tokens?: number;
  [key: string]: any;
}

interface MethodResult {
  name: string;
  durationMs: number;
  usage: TokenUsage | null;
  rawUsage: any;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  biomarkerCount: number;
  reportType?: string;
  reportDate?: string;
  specimenType?: string;
  parsedJson: any;
  error?: string;
}

function normalizeUsage(rawUsage: any): {
  usage: TokenUsage | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  if (!rawUsage) {
    return { usage: null, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  const inputTokens =
    rawUsage.prompt_tokens ??
    rawUsage.input_tokens ??
    rawUsage.promptTokenCount ??
    0;

  const outputTokens =
    rawUsage.candidates_tokens ??
    rawUsage.output_tokens ??
    rawUsage.candidatesTokenCount ??
    0;

  const totalTokens =
    rawUsage.total_tokens ??
    rawUsage.totalTokenCount ??
    inputTokens + outputTokens;

  return {
    usage: rawUsage,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

async function loadPdfBuffer(inputPathOrUrl: string): Promise<{
  buffer: Buffer;
  sourceName: string;
  fileUrl?: string;
}> {
  if (
    inputPathOrUrl.startsWith("http://") ||
    inputPathOrUrl.startsWith("https://")
  ) {
    console.log(`\n[Input] Fetching PDF from URL: ${inputPathOrUrl}`);
    const res = await fetch(inputPathOrUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sourceName =
      path.basename(new URL(inputPathOrUrl).pathname) || "remote_report.pdf";
    return { buffer, sourceName, fileUrl: inputPathOrUrl };
  }

  const resolvedPath = path.resolve(process.cwd(), inputPathOrUrl);
  if (!fsSync.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  console.log(`\n[Input] Reading PDF from local file: ${resolvedPath}`);
  const buffer = await fs.readFile(resolvedPath);
  const sourceName = path.basename(resolvedPath);
  return { buffer, sourceName };
}

/**
 * METHOD 1: Text / Markdown extraction pipeline (uses PyMuPDF4LLM -> Clean Markdown -> AI)
 */
async function runMethod1(
  buffer: Buffer,
  fileUrl?: string,
): Promise<MethodResult> {
  console.log("\n" + "=".repeat(60));
  console.log(
    "▶ RUNNING METHOD 1: Text/Markdown Extraction (extractLabReportFromUrl pipeline)",
  );
  console.log("=".repeat(60));

  const startTime = Date.now();

  // 1. Extract markdown using PyMuPDF4LLM or pdfParse fallback
  let extractedText = "";
  try {
    console.log("  Step 1: Extracting markdown via PyMuPDF4LLM / pdfParse...");
    const markdown = await extractPdfToMarkdown({ buffer, fileUrl });
    if (markdown && markdown.length >= 20) {
      extractedText = markdown;
      console.log(
        `  [PyMuPDF4LLM] Extracted ${markdown.length} characters of structured Markdown.`,
      );
    } else {
      console.log(
        "  [PyMuPDF4LLM] Empty or short output, falling back to pdf-parse...",
      );
      const parsedPdf = await pdfParse(buffer);
      if (parsedPdf.text && parsedPdf.text.trim().length >= 50) {
        extractedText = parsedPdf.text.trim();
        console.log(
          `  [pdf-parse] Extracted ${extractedText.length} characters of text.`,
        );
      }
    }
  } catch (err: any) {
    console.warn(
      `  [Extraction Warning] Markdown extraction encountered an issue: ${err.message}. Trying pdf-parse...`,
    );
    try {
      const parsedPdf = await pdfParse(buffer);
      if (parsedPdf.text && parsedPdf.text.trim().length >= 50) {
        extractedText = parsedPdf.text.trim();
        console.log(
          `  [pdf-parse] Extracted ${extractedText.length} characters of text.`,
        );
      }
    } catch (parseErr: any) {
      console.warn(
        `  [Extraction Warning] pdf-parse also failed: ${parseErr.message}`,
      );
    }
  }

  const preparedText = prepareMarkdownForModel(extractedText);
  console.log(
    `  Step 2: Cleaned & prepared markdown for model (${preparedText.length} chars).`,
  );

  // 2. Build input prompt
  const input = preparedText
    ? [
        {
          type: "text",
          text: `${LAB_REPORT_PROMPT}\n\nLAB REPORT STRUCTURED CONTENT:\n${preparedText}`,
        },
      ]
    : [
        {
          type: "document",
          mime_type: "application/pdf",
          data: buffer.toString("base64"),
        },
        {
          type: "text",
          text: LAB_REPORT_PROMPT,
        },
      ];

  // 3. Call Gemini AI
  console.log("  Step 3: Calling Gemini AI (gemini-3.5-flash-lite)...");
  const response: any = await (client as any).interactions.create({
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
      thinking_level: "medium",
    },
  });

  const durationMs = Date.now() - startTime;
  const rawUsage =
    response?.usage ??
    response?.usageMetadata ??
    response?.usage_metadata ??
    null;
  const { usage, inputTokens, outputTokens, totalTokens } =
    normalizeUsage(rawUsage);

  const rawText = response?.output_text ?? response?.text;
  if (!rawText) {
    throw new Error("No response text returned from AI model in Method 1");
  }

  const rawResult = safeParseJSON(rawText);
  const result = processLabReportResult(rawResult);

  const biomarkerCount = Array.isArray(result.biomarkers)
    ? result.biomarkers.length
    : 0;

  return {
    name: "Method 1 (Text/Markdown Extracted)",
    durationMs,
    usage,
    rawUsage,
    inputTokens,
    outputTokens,
    totalTokens,
    biomarkerCount,
    reportType: result.reportType,
    reportDate: result.reportDate,
    specimenType: result.specimenType,
    parsedJson: result,
  };
}

/**
 * METHOD 2: Direct PDF to AI (Direct multimodal document sending, no text extraction)
 */
async function runMethod2(buffer: Buffer): Promise<MethodResult> {
  console.log("\n" + "=".repeat(60));
  console.log("▶ RUNNING METHOD 2: Direct PDF to AI (No text extraction)");
  console.log("=".repeat(60));

  const startTime = Date.now();

  // 1. Directly encode PDF as base64 document
  console.log(
    `  Step 1: Direct base64 encoding of PDF (${buffer.length} bytes)...`,
  );
  const payloadData = buffer.toString("base64");

  // 2. Build input parts with document directly
  const input = [
    {
      type: "document",
      mime_type: "application/pdf",
      data: payloadData,
    },
    {
      type: "text",
      text: LAB_REPORT_PROMPT,
    },
  ];

  // 3. Call Gemini AI
  console.log(
    "  Step 2: Calling Gemini AI with direct PDF document (gemini-3.5-flash-lite)...",
  );
  const response: any = await (client as any).interactions.create({
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
      thinking_level: "medium",
    },
  });

  const durationMs = Date.now() - startTime;
  const rawUsage =
    response?.usage ??
    response?.usageMetadata ??
    response?.usage_metadata ??
    null;
  const { usage, inputTokens, outputTokens, totalTokens } =
    normalizeUsage(rawUsage);

  const rawText = response?.output_text ?? response?.text;
  if (!rawText) {
    throw new Error("No response text returned from AI model in Method 2");
  }

  const rawResult = safeParseJSON(rawText);
  const result = processLabReportResult(rawResult);

  const biomarkerCount = Array.isArray(result.biomarkers)
    ? result.biomarkers.length
    : 0;

  return {
    name: "Method 2 (Direct PDF Multi-modal)",
    durationMs,
    usage,
    rawUsage,
    inputTokens,
    outputTokens,
    totalTokens,
    biomarkerCount,
    reportType: result.reportType,
    reportDate: result.reportDate,
    specimenType: result.specimenType,
    parsedJson: result,
  };
}

async function main() {
  const targetPdf = process.argv[2];

  if (!targetPdf) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                   LAB REPORT TOKEN COMPARISON TEST SCRIPT                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

Usage:
  npx tsx scripts/test_lab_report_tokens.ts <path-to-pdf-file-or-url>

Examples:
  npx tsx scripts/test_lab_report_tokens.ts test.pdf
  npx tsx scripts/test_lab_report_tokens.ts ./sample_reports/blood_test.pdf
  npx tsx scripts/test_lab_report_tokens.ts https://example.com/sample_report.pdf

Checking if a default test PDF exists in current directory...
`);

    const defaultPdf = "test.pdf";
    if (fsSync.existsSync(path.resolve(process.cwd(), defaultPdf))) {
      console.log(`Found default '${defaultPdf}', proceeding with it...\n`);
      await runComparison(defaultPdf);
    } else {
      console.error(
        `Error: No PDF file specified, and '${defaultPdf}' was not found in current directory.`,
      );
      console.error(
        "Please supply a PDF file or URL: npx tsx scripts/test_lab_report_tokens.ts <your-pdf-file>",
      );
      process.exit(1);
    }
  } else {
    await runComparison(targetPdf);
  }
}

async function runComparison(targetPath: string) {
  const { buffer, sourceName, fileUrl } = await loadPdfBuffer(targetPath);

  console.log(
    `PDF loaded successfully: ${sourceName} (${(buffer.length / 1024).toFixed(1)} KB)`,
  );

  // Run Method 1
  let res1: MethodResult;
  try {
    res1 = await runMethod1(buffer, fileUrl);
  } catch (err: any) {
    console.error(`Method 1 Failed: ${err.message}`);
    res1 = {
      name: "Method 1 (Text/Markdown Extracted)",
      durationMs: 0,
      usage: null,
      rawUsage: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      biomarkerCount: 0,
      parsedJson: null,
      error: err.message,
    };
  }

  // Run Method 2
  let res2: MethodResult;
  try {
    res2 = await runMethod2(buffer);
  } catch (err: any) {
    console.error(`Method 2 Failed: ${err.message}`);
    res2 = {
      name: "Method 2 (Direct PDF Multi-modal)",
      durationMs: 0,
      usage: null,
      rawUsage: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      biomarkerCount: 0,
      parsedJson: null,
      error: err.message,
    };
  }

  // ── Logging Raw response.usage ─────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("📊 RAW TOKEN USAGE (response.usage):");
  console.log("=".repeat(60));
  console.log("\nMethod 1 (Text/Markdown Extraction) response.usage:");
  console.dir(res1.rawUsage, { depth: null, colors: true });

  console.log("\nMethod 2 (Direct PDF) response.usage:");
  console.dir(res2.rawUsage, { depth: null, colors: true });

  // ── Save JSON Results ──────────────────────────────────────────────────────
  const outputDir = path.join(process.cwd(), "output");
  await fs.mkdir(outputDir, { recursive: true });

  const cleanBase = path
    .basename(sourceName, path.extname(sourceName))
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const file1 = path.join(
    outputDir,
    `test-method1-extracted-text-${cleanBase}.json`,
  );
  const file2 = path.join(
    outputDir,
    `test-method2-direct-pdf-${cleanBase}.json`,
  );
  const summaryFile = path.join(
    outputDir,
    `test-token-comparison-${cleanBase}.json`,
  );

  if (res1.parsedJson) {
    await fs.writeFile(
      file1,
      JSON.stringify(res1.parsedJson, null, 2),
      "utf-8",
    );
    console.log(`\n📁 Saved Method 1 JSON to: ${file1}`);
  }
  if (res2.parsedJson) {
    await fs.writeFile(
      file2,
      JSON.stringify(res2.parsedJson, null, 2),
      "utf-8",
    );
    console.log(`📁 Saved Method 2 JSON to: ${file2}`);
  }

  const comparisonData = {
    pdfSource: sourceName,
    pdfSizeBytes: buffer.length,
    timestamp: new Date().toISOString(),
    method1_extracted_text: {
      inputTokens: res1.inputTokens,
      outputTokens: res1.outputTokens,
      totalTokens: res1.totalTokens,
      rawUsage: res1.rawUsage,
      durationMs: res1.durationMs,
      biomarkerCount: res1.biomarkerCount,
      reportType: res1.reportType,
      error: res1.error,
    },
    method2_direct_pdf: {
      inputTokens: res2.inputTokens,
      outputTokens: res2.outputTokens,
      totalTokens: res2.totalTokens,
      rawUsage: res2.rawUsage,
      durationMs: res2.durationMs,
      biomarkerCount: res2.biomarkerCount,
      reportType: res2.reportType,
      error: res2.error,
    },
    tokenSavingsWithMethod1: {
      tokenDifference: res2.totalTokens - res1.totalTokens,
      percentageSavings:
        res2.totalTokens > 0
          ? `${(((res2.totalTokens - res1.totalTokens) / res2.totalTokens) * 100).toFixed(1)}%`
          : "N/A",
    },
  };

  await fs.writeFile(
    summaryFile,
    JSON.stringify(comparisonData, null, 2),
    "utf-8",
  );
  console.log(`📁 Saved Comparison Summary to: ${summaryFile}`);

  // ── Print Comparison Table ────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("📈 TOKEN & PERFORMANCE COMPARISON SUMMARY");
  console.log("=".repeat(70));

  console.table([
    {
      Metric: "Input / Prompt Tokens",
      "Method 1 (Text Extracted)": res1.inputTokens,
      "Method 2 (Direct PDF)": res2.inputTokens,
      Difference: `${res1.inputTokens - res2.inputTokens > 0 ? "+" : ""}${res1.inputTokens - res2.inputTokens}`,
    },
    {
      Metric: "Output / Candidate Tokens",
      "Method 1 (Text Extracted)": res1.outputTokens,
      "Method 2 (Direct PDF)": res2.outputTokens,
      Difference: `${res1.outputTokens - res2.outputTokens > 0 ? "+" : ""}${res1.outputTokens - res2.outputTokens}`,
    },
    {
      Metric: "TOTAL TOKENS",
      "Method 1 (Text Extracted)": res1.totalTokens,
      "Method 2 (Direct PDF)": res2.totalTokens,
      Difference: `${res1.totalTokens - res2.totalTokens > 0 ? "+" : ""}${res1.totalTokens - res2.totalTokens}`,
    },
    {
      Metric: "Biomarkers Extracted",
      "Method 1 (Text Extracted)": res1.biomarkerCount,
      "Method 2 (Direct PDF)": res2.biomarkerCount,
      Difference: `${res1.biomarkerCount - res2.biomarkerCount > 0 ? "+" : ""}${res1.biomarkerCount - res2.biomarkerCount}`,
    },
    {
      Metric: "Execution Time (ms)",
      "Method 1 (Text Extracted)": `${res1.durationMs} ms`,
      "Method 2 (Direct PDF)": `${res2.durationMs} ms`,
      Difference: `${res1.durationMs - res2.durationMs} ms`,
    },
  ]);

  if (res1.totalTokens > 0 && res2.totalTokens > 0) {
    const diff = res2.totalTokens - res1.totalTokens;
    if (diff > 0) {
      const pct = ((diff / res2.totalTokens) * 100).toFixed(1);
      console.log(
        `\n💡 Method 1 (Text Extraction) uses ${diff.toLocaleString()} fewer tokens (${pct}% savings) compared to Direct PDF.`,
      );
    } else if (diff < 0) {
      const pct = ((Math.abs(diff) / res1.totalTokens) * 100).toFixed(1);
      console.log(
        `\n💡 Method 2 (Direct PDF) uses ${Math.abs(diff).toLocaleString()} fewer tokens (${pct}% savings) compared to Text Extraction.`,
      );
    } else {
      console.log(`\n💡 Both methods used the exact same total token count.`);
    }
  }
  console.log("=".repeat(70) + "\n");
}

main().catch((err) => {
  console.error("\n[Fatal Error]:", err);
  process.exit(1);
});
