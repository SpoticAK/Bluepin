# Firebase Cloud Functions: PyMuPDF4LLM PDF-to-Markdown Extraction

This module extracts structured Markdown (including formatted tables, section headers, and tabular lab values) from PDF medical reports using **PyMuPDF4LLM**, dramatically improving AI extraction accuracy for Gemini.

---

## 📁 Directory Structure

```text
functions/
├── main.py             # Firebase Function handler & local CLI runner
├── requirements.txt    # Python dependencies (latest versions)
├── venv/               # Local virtual environment (ignored by Git)
├── .gitignore          # Ignores venv and temporary files
└── README.md           # Instructions and usage documentation
```

---

## 🚀 How It Works

1. **Local Development (Automatic)**:
   The Node.js backend automatically detects `functions/venv` and invokes `functions/main.py` directly via a subprocess. No cloud deployment or emulators required to test locally.

2. **Firebase Cloud Functions (Production)**:
   Deploy the function to Firebase / Google Cloud Functions (2nd Gen):
   ```bash
   firebase deploy --only functions
   ```
   After deployment, set the function URL in your `.env`:
   ```env
   PDF_MARKDOWN_FUNCTION_URL="https://extract-pdf-markdown-<project-hash>-uc.a.run.app"
   ```

3. **Fallback Resiliency**:
   If Python or PyMuPDF4LLM is ever unavailable, the system automatically falls back to `pdf-parse` or visual document analysis seamlessly.

---

## 🗑️ How to Remove (If No Longer Needed)

Because this feature is completely modularized:
1. Delete the `functions/` directory.
2. In `firebase.json`, remove the `"functions"` entry.
3. In `server/services/labReportService.ts`, remove the call to `extractPdfToMarkdown`.
4. Delete `server/services/pdfMarkdownService.ts`.
