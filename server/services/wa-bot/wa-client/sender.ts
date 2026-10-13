import { config } from "../../../config";

const META_BASE_URL =
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";

const GRAPH_API = `${META_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const AUTH_HEADER = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
};

/**
 * Posts a message payload to the WhatsApp Graph API.
 * All message builders should call this instead of fetch() directly.
 */
export async function postMessage(body: unknown): Promise<Response> {
  // Belt-and-braces: config.ts already refuses to boot non-prod in live mode,
  // but this catches anything that bypasses it (tests, direct imports).
  if (!config.isProduction && config.whatsapp.mode === "live") {
    throw new Error(
      `[whatsapp] Refusing to send: WHATSAPP_MODE=live outside production (ENV_NAME=${config.envName}).`,
    );
  }
  const res = await fetch(GRAPH_API, {
    method: "POST",
    headers: AUTH_HEADER,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Clone before reading so the caller can still consume the response
    const err = await res.clone().json().catch(() => ({}));
    console.error("Graph API error:", JSON.stringify(err));
  }

  return res;
}
