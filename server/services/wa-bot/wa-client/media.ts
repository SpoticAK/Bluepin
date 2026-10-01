const META_BASE_URL =
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Given a WhatsApp media ID, fetches its temporary download URL from the
 * Meta Graph API, then downloads and returns the binary Buffer.
 *
 * Completely self-contained — no dependency on the legacy Bluepin wa-client.
 */
export async function downloadMediaFromMeta(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  console.log(`[media] Downloading media ID: ${mediaId}`);
  const t0 = Date.now();

  if (!TOKEN) throw new Error("[media] WHATSAPP_TOKEN is not set.");

  // ── Step 1: Get the temporary download URL ──────────────────────────────────
  let metaData: { url: string; mime_type?: string; file_size?: number };
  try {
    const res = await fetch(`${META_BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[media] Metadata fetch failed (${res.status}):`, text.slice(0, 300));
      throw new Error(`Meta metadata fetch failed: ${res.status}`);
    }

    metaData = await res.json();
    if (!metaData.url) throw new Error("[media] Meta did not return a download URL.");
    console.log(`[media] Step 1 OK in ${Date.now() - t0}ms. Declared size: ${metaData.file_size ?? "unknown"} bytes.`);
  } catch (err) {
    console.error(`[media] Error fetching metadata for ${mediaId}:`, err);
    throw err;
  }

  // ── Step 2: Download the binary ─────────────────────────────────────────────
  let fileRes: Response;
  try {
    fileRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!fileRes.ok) {
      const text = await fileRes.text();
      console.error(`[media] Binary download failed (${fileRes.status}):`, text.slice(0, 300));
      throw new Error(`Media binary download failed: ${fileRes.status}`);
    }
  } catch (err) {
    console.error(`[media] Error downloading binary for ${mediaId}:`, err);
    throw err;
  }

  const declaredSize = Number(fileRes.headers.get("content-length") || "0");
  if (declaredSize > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(declaredSize / 1024 / 1024).toFixed(1)} MB, over the 5 MB limit.`,
    );
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the 5 MB limit.`,
    );
  }

  const mimeType = (
    metaData.mime_type ||
    fileRes.headers.get("content-type") ||
    "application/octet-stream"
  ).split(";")[0].trim();

  console.log(`[media] Step 2 OK. Buffer: ${buffer.length} bytes, MIME: ${mimeType}. Total: ${Date.now() - t0}ms.`);
  return { buffer, mimeType };
}
