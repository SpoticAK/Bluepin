const META_BASE_URL =
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";
const TOKEN = process.env.WHATSAPP_TOKEN || "";

/**
 * Metadata is a small JSON lookup and normally answers in under 300ms, so it
 * gets a tight budget. The binary body gets a much larger one because the
 * caller has already acknowledged the user before downloading — nothing is
 * blocked waiting on us, so there is no cost to being generous.
 */
const METADATA_TIMEOUT_MS =
  Number(process.env.WHATSAPP_MEDIA_METADATA_TIMEOUT_MS) || 5_000;
const DOWNLOAD_TIMEOUT_MS =
  Number(process.env.WHATSAPP_MEDIA_DOWNLOAD_TIMEOUT_MS) || 60_000;

/** Transient timeouts and connection resets are common; retry before bothering the user. */
const MAX_ATTEMPTS = Number(process.env.WHATSAPP_MEDIA_DOWNLOAD_ATTEMPTS) || 3;
const RETRY_BASE_DELAY_MS = 500;

/** Hard cap on a single download. Shared with the handler's pre-flight check. */
export const MAX_FILE_BYTES =
  Number(process.env.WHATSAPP_MEDIA_MAX_BYTES) || 5 * 1024 * 1024;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs a GET with a fresh timeout per attempt and exponential backoff.
 *
 * Only network failures and timeouts are retried. Callers keep their own
 * validation outside this helper so a rejected response is never retried.
 */
async function fetchWithRetry(
  url: string,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err;
      const isLast = attempt === MAX_ATTEMPTS;
      console.warn(
        `[media] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err}`,
      );
      if (isLast) break;

      // Jittered backoff so several concurrent uploads do not retry in lockstep.
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay + Math.floor(Math.random() * 250));
    }
  }

  throw lastError;
}

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
    const res = await fetchWithRetry(
      `${META_BASE_URL}/${mediaId}`,
      METADATA_TIMEOUT_MS,
      "metadata fetch",
    );

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
    fileRes = await fetchWithRetry(
      metaData.url,
      DOWNLOAD_TIMEOUT_MS,
      "binary download",
    );

    if (!fileRes.ok) {
      const text = await fileRes.text().catch(() => "");
      console.error(
        `[media] Binary download failed (${fileRes.status}):`,
        text.slice(0, 300),
      );
      throw new Error(`Media binary download failed: ${fileRes.status}`);
    }
  } catch (err) {
    console.error(`[media] Error downloading binary for ${mediaId}:`, err);
    throw err;
  }

  const declaredSize = Number(fileRes.headers.get("content-length") || "0");
  if (declaredSize > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(declaredSize / 1024 / 1024).toFixed(1)} MB, over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`,
    );
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`,
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
