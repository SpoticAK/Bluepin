import io
import json
import sys
import base64
import urllib.request
from typing import Optional

# Firebase Cloud Functions (v2) imports
try:
    from firebase_functions import https_fn, options
    from firebase_admin import initialize_app
    initialize_app()
    HAS_FIREBASE = True
except ImportError:
    HAS_FIREBASE = False

import pymupdf
import pymupdf4llm


def convert_pdf_bytes_to_markdown(pdf_bytes: bytes) -> dict:
    """Converts raw PDF bytes to structured Markdown using PyMuPDF4LLM."""
    if not pdf_bytes or len(pdf_bytes) < 10:
        raise ValueError("Invalid or empty PDF byte stream.")

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    
    if page_count == 0:
        doc.close()
        raise ValueError("PDF contains 0 pages.")

    # Convert to markdown preserving tables and formatting for LLM analysis
    markdown_text = pymupdf4llm.to_markdown(doc)
    doc.close()

    return {
        "success": True,
        "markdown": markdown_text,
        "page_count": page_count,
    }


def download_pdf_from_url(url: str) -> bytes:
    """Downloads PDF bytes from a given URL."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Bluepin-PDF-Extractor/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def process_extraction_request(data: dict) -> dict:
    """Processes either URL or Base64 PDF data and returns Markdown."""
    file_url = data.get("fileUrl") or data.get("url")
    file_base64 = data.get("fileBase64") or data.get("base64")

    if file_base64:
        # Strip data URL prefix if present (e.g., 'data:application/pdf;base64,...')
        if "," in file_base64:
            file_base64 = file_base64.split(",", 1)[1]
        pdf_bytes = base64.b64decode(file_base64)
    elif file_url:
        pdf_bytes = download_pdf_from_url(file_url)
    else:
        raise ValueError("Either 'fileUrl' or 'fileBase64' must be provided.")

    return convert_pdf_bytes_to_markdown(pdf_bytes)


# ─── Firebase Cloud Function Handler ────────────────────────────────────────

if HAS_FIREBASE:
    @https_fn.on_request(
        cors=options.CorsOptions(cors_origins="*", cors_methods=["POST", "OPTIONS"]),
        memory=options.MemoryOption.MB_512,
        timeout_sec=60,
    )
    def extract_pdf_markdown(req: https_fn.Request) -> https_fn.Response:
        """Firebase Cloud Function endpoint to convert PDF to Markdown."""
        if req.method == "OPTIONS":
            return https_fn.Response(status=204)

        if req.method != "POST":
            return https_fn.Response(
                json.dumps({"error": "Method Not Allowed. Use POST."}),
                status=405,
                mimetype="application/json",
            )

        try:
            req_data = req.get_json(silent=True) or {}
            result = process_extraction_request(req_data)
            return https_fn.Response(
                json.dumps(result),
                status=200,
                mimetype="application/json",
            )
        except Exception as exc:
            return https_fn.Response(
                json.dumps({"success": False, "error": str(exc)}),
                status=400,
                mimetype="application/json",
            )


# ─── Local CLI / Subprocess Runner ──────────────────────────────────────────

if __name__ == "__main__":
    """Allows running directly from Node.js child_process or terminal."""
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"success": False, "error": "No input JSON received on stdin."}))
            sys.exit(1)

        payload = json.loads(input_data)
        res = process_extraction_request(payload)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
