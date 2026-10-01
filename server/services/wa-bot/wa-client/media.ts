import { createHash } from "crypto";

const META_BASE_URL =
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

/**
 * Timeouts are generous by default. A metadata lookup that has not answered in
 * 30s is not going to answer in 31s — but under-reporting it as a fast failure
 * hides whether we are being throttled, which the per-attempt elapsed logs are
 * there to expose. Raise these via env rather than lowering them in code.
 */
const METADATA_TIMEOUT_MS =
  Number(process.env.WHATSAPP_MEDIA_METADATA_TIMEOUT_MS) || 30_000;
const DOWNLOAD_TIMEOUT_MS =
  Number(process.env.WHATSAPP_MEDIA_DOWNLOAD_TIMEOUT_MS) || 60_000;

/** Transient timeouts and connection resets are common; retry before bothering the user. */
const MAX_ATTEMPTS = Number(process.env.WHATSAPP_MEDIA_DOWNLOAD_ATTEMPTS) || 3;
const RETRY_BASE_DELAY_MS = 500;

/** Hard cap on a single download. Shared with the handler's pre-flight check. */
export const MAX_FILE_BYTES =
  Number(process.env.WHATSAPP_MEDIA_MAX_BYTES) || 5 * 1024 * 1024;

/**
 * Media fields Meta may hand us directly on the inbound webhook. Meta's Media
 * guide states webhook media objects carry `url`; its Messages webhook field
 * reference omits it. We therefore treat every field as optional and fall back
 * to GET /{media_id} whenever `url` is absent, which is correct either way.
 */
export type MediaHint = {
  url?: string;
  mimeType?: string;
  sha256?: string;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const backoffDelay = (attempt: number) =>
  RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);

/** 408/429/5xx are transient and worth another attempt; other 4xx never are. */
const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

const describeError = (err: unknown): string => {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return `${err.name}: request timed out`;
    }
    return `${err.name}: ${err.message}`;
  }
  return String(err);
};

/**
 * Runs a GET with a fresh timeout per attempt and exponential backoff, and
 * retries transient HTTP statuses rather than only network-level throws.
 *
 * Status validation lives *inside* this helper so that a 429 or 500 actually
 * consumes an attempt. Doing it outside would make MAX_ATTEMPTS a lie for every
 * non-2xx response, which is exactly the case that most warrants a retry.
 */
async function fetchWithRetry(
  url: string,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  let lastError: Error = new Error(`[media] ${label} never ran`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Connect failure, DNS failure, or abort — all safely retriable.
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[media] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed after ` +
          `${Date.now() - t0}ms: ${describeError(err)}`,
      );
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffDelay(attempt));
      continue;
    }

    const elapsed = Date.now() - t0;

    if (res.ok) {
      console.log(
        `[media] ${label} attempt ${attempt}/${MAX_ATTEMPTS} OK in ${elapsed}ms (HTTP ${res.status})`,
      );
      return res;
    }

    lastError = new Error(`[media] ${label} failed with HTTP ${res.status}`);
    const usage = res.headers.get("x-app-usage");
    const body = (await res.text().catch(() => "")).slice(0, 200);
    const detail =
      `[media] ${label} attempt ${attempt}/${MAX_ATTEMPTS} HTTP ${res.status} ` +
      `in ${elapsed}ms` +
      (usage ? ` x-app-usage=${usage}` : "") +
      (body ? ` :: ${body.replace(/\s+/g, " ")}` : "");

    if (!isRetryableStatus(res.status)) {
      console.error(`${detail} (not retryable)`);
      throw lastError;
    }

    console.warn(detail);
    if (attempt === MAX_ATTEMPTS) break;
    await sleep(backoffDelay(attempt));
  }

  throw lastError;
}

type ResolvedMeta = {
  url: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
};

/**
 * Resolves the short-lived binary URL for a media id.
 *
 * Prefers the URL Meta may already have put on the webhook, which removes the
 * GET /{media_id} call entirely — that call is the one that times out. Passing
 * forceRefresh skips the hint, because a 404 on the binary leg usually means
 * the URL we held had already expired and we must query for a new one.
 */
async function resolveMetadata(
  mediaId: string,
  hint: MediaHint | undefined,
  forceRefresh: boolean,
): Promise<ResolvedMeta> {
  if (hint?.url && !forceRefresh) {
    console.log(
      `[media] Using media URL from webhook; skipping GET /${mediaId} entirely.`,
    );
    return {
      url: hint.url,
      mime_type: hint.mimeType,
      sha256: hint.sha256,
    };
  }

  // Optional per Meta: confirms the media belongs to the number we own, turning
  // a number mismatch into a clear 400 instead of a silent empty response.
  const query = PHONE_NUMBER_ID
    ? `?phone_number_id=${encodeURIComponent(PHONE_NUMBER_ID)}`
    : "";
  const res = await fetchWithRetry(
    `${META_BASE_URL}/${mediaId}${query}`,
    METADATA_TIMEOUT_MS,
    "metadata fetch",
  );

  const meta = (await res.json()) as ResolvedMeta;
  if (!meta?.url) throw new Error("[media] Meta did not return a download URL.");
  console.log(
    `[media] GET /${mediaId} returned a URL; declared size ${meta.file_size ?? "unknown"} bytes.`,
  );
  return meta;
}

/**
 * Downloads a media URL into a Buffer, enforcing the size cap against both the
 * declared content-length and the bytes actually received.
 */
async function fetchBinary(
  url: string,
  label: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const res = await fetchWithRetry(url, DOWNLOAD_TIMEOUT_MS, label);

  const declaredSize = Number(res.headers.get("content-length") || "0");
  if (declaredSize > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(declaredSize / 1024 / 1024).toFixed(1)} MB, over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`,
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`,
    );
  }

  return { buffer, contentType: res.headers.get("content-type") };
}

/**
 * Given a WhatsApp media ID, fetches its temporary download URL from the
 * Meta Graph API, then downloads and returns the binary Buffer.
 *
 * Completely self-contained — no dependency on the legacy Bluepin wa-client.
 */
export async function downloadMediaFromMeta(
  mediaId: string,
  hint?: MediaHint,
): Promise<{ buffer: Buffer; mimeType: string }> {
  console.log(`[media] Downloading media ID: ${mediaId}`);
  const t0 = Date.now();

  if (!TOKEN) throw new Error("[media] WHATSAPP_TOKEN is not set.");

  let meta = await resolveMetadata(mediaId, hint, false);

  // ── Download the binary ─────────────────────────────────────────────────────
  // Meta documents that a failed download returns 404, and that the remedy is to
  // fetch a fresh URL and try again — retrying the same (expired) URL cannot
  // help, because URLs are only valid for 5 minutes.
  let buffer: Buffer;
  let contentType: string | null;
  try {
    ({ buffer, contentType } = await fetchBinary(
      meta.url,
      "binary download",
    ));
  } catch (err) {
    if (!(err instanceof Error) || !/HTTP 404/.test(err.message)) {
      console.error(`[media] Error downloading binary for ${mediaId}:`, err);
      throw err;
    }
    console.warn(
      "[media] Binary download returned 404; re-querying the media id for a fresh URL.",
    );
    meta = await resolveMetadata(mediaId, hint, true);
    ({ buffer, contentType } = await fetchBinary(
      meta.url,
      "binary download (after URL refresh)",
    ));
  }

  // Both the webhook and GET /{media_id} supply sha256. A truncated body is the
  // realistic cause of a mismatch, so re-fetch once before failing outright.
  const expectedSha = meta.sha256?.trim().toLowerCase();
  if (expectedSha) {
    const sha256Of = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    const actualSha = sha256Of(buffer);
    if (actualSha !== expectedSha) {
      console.warn(
        `[media] SHA-256 mismatch (got ${actualSha}); re-fetching once in case the body was truncated.`,
      );
      const retry = await fetchBinary(
        meta.url,
        "binary download (sha retry)",
      );
      const retrySha = sha256Of(retry.buffer);
      if (retrySha !== expectedSha) {
        throw new Error(
          `Downloaded file failed its SHA-256 check twice (expected ${expectedSha}, got ${retrySha}).`,
        );
      }
      buffer = retry.buffer;
      contentType = retry.contentType;
      console.log(`[media] SHA-256 verified for ${mediaId} after re-fetch.`);
    } else {
      console.log(`[media] SHA-256 verified for ${mediaId}.`);
    }
  }

  const mimeType = (
    meta.mime_type || contentType || "application/octet-stream"
  )
    .split(";")[0]
    .trim();

  console.log(
    `[media] Done. Buffer: ${buffer.length} bytes, MIME: ${mimeType}. Total: ${Date.now() - t0}ms.`,
  );
  return { buffer, mimeType };
}