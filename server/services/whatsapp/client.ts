import crypto from "crypto";
import { InteractiveButton } from "./types";

export const getWhatsAppToken = () =>
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";

export const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export const getAppSecret = () => process.env.WHATSAPP_APP_SECRET || "";

export const getMetaBaseUrl = () =>
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";

const META_TIMEOUT_MS = Number(process.env.WHATSAPP_API_TIMEOUT_MS) || 15_000;
const MEDIA_MAX_BYTES = Number(process.env.WHATSAPP_MEDIA_MAX_BYTES) || 5 * 1024 * 1024;

/** Template language code, used consistently by OTP and utility templates. */
export const getTemplateLang = () => process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

/**
 * Canonical recipient form: E.164 digits with no "+" (e.g. 919876543210).
 * Every Firestore key derived from a phone number must use this, because Meta
 * webhook payloads always report `from` in this format.
 */
export function normalizePhone(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Same canonical form, but "+"-prefixed for Firebase Auth phoneNumber fields. */
export const toE164 = (input: string): string | null => {
  const canonical = normalizePhone(input);
  return canonical ? `+${canonical}` : null;
};

/** Masks a phone number for logs: 919876543210 -> 9198******10 */
export const maskPhone = (input: string): string => {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 4)}${"*".repeat(digits.length - 6)}${digits.slice(-2)}`;
};

interface MetaApiResponse {
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  raw?: string;
}

/**
 * Single entry point for every outbound Meta Cloud API call.
 * Applies auth, a request timeout, and structured error parsing.
 */
async function postMessage(payload: Record<string, unknown>): Promise<MetaApiResponse> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();

  if (!token || !phoneId) {
    console.warn(
      "[WhatsApp] Cannot send message: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
    );
    return {
      ok: false,
      errorMessage: "WhatsApp service credentials not configured on server.",
    };
  }

  try {
    const res = await fetch(`${metaBaseUrl}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...payload,
      }),
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
    });

    if (res.ok) return { ok: true };

    const raw = await res.text();
    let errorCode: number | undefined;
    let errorMessage = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.code) errorCode = Number(parsed.error.code);
      if (parsed?.error?.message) errorMessage = String(parsed.error.message);
    } catch {
      // Non-JSON error body; keep the truncated text.
    }

    if (errorCode === 131047) {
      console.warn("[WhatsApp] Outside the 24-hour customer service window.", { errorCode });
    } else if (errorCode === 131030) {
      console.warn("[WhatsApp] Recipient has not accepted messages from this number.", { errorCode });
    }

    return { ok: false, errorCode, errorMessage, raw };
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error("[WhatsApp] Exception calling Meta API:", message);
    return { ok: false, errorMessage: message };
  }
}

/**
 * Sends a plain text WhatsApp message via Meta Cloud API.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<boolean> {
  const cleanTo = normalizePhone(to);
  if (!cleanTo) {
    console.warn("[WhatsApp] Refusing to send: invalid recipient number.", { to: maskPhone(to) });
    return false;
  }

  const res = await postMessage({
    to: cleanTo,
    type: "text",
    text: { body: text, preview_url: false },
  });

  if (!res.ok) {
    console.error("[WhatsApp] Error sending message:", res.errorMessage);
    return false;
  }
  return true;
}

/**
 * Sends a pre-approved Utility or Marketing template via Meta Cloud API.
 * Use this to initiate conversations outside the 24-hour window.
 */
export async function sendWhatsAppUtilityTemplate(
  to: string,
  templateName: string,
  languageCode?: string,
): Promise<boolean> {
  const cleanTo = normalizePhone(to);
  if (!cleanTo) return false;

  const res = await postMessage({
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || getTemplateLang() },
    },
  });

  if (!res.ok) {
    console.error(`[WhatsApp] Error sending template '${templateName}':`, res.errorMessage);
    return false;
  }
  return true;
}

// Codes indicating the template body/button component shape did not match the
// approved template. Only these justify retrying without the button component.
const TEMPLATE_SHAPE_MISMATCH_CODES = new Set([132000, 132001, 132005, 132007, 132012]);

/**
 * Sends a 6-digit verification code to the recipient's WhatsApp.
 * Prefers an approved Authentication template; falls back to a text message,
 * which Meta only delivers inside an active 24-hour window.
 */
export async function sendWhatsAppOtp(
  to: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanTo = normalizePhone(to);
  if (!cleanTo) {
    return { success: false, error: "Invalid WhatsApp phone number." };
  }

  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  if (!templateName && process.env.NODE_ENV === "production") {
    console.error(
      "[WhatsApp OTP] WHATSAPP_OTP_TEMPLATE_NAME is not set. OTP delivery relies on the text " +
        "fallback, which Meta only delivers inside a 24-hour customer service window. " +
        "Users who have never messaged the bot will not receive codes.",
    );
  }

  if (templateName) {
    const templateWithButton = await postMessage({
      to: cleanTo,
      type: "template",
      template: {
        name: templateName,
        language: { code: getTemplateLang() },
        components: [
          { type: "body", parameters: [{ type: "text", text: otp }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    });

    if (templateWithButton.ok) return { success: true };

    console.warn(
      `[WhatsApp OTP] Template send with button failed for '${templateName}':`,
      { errorCode: templateWithButton.errorCode, errorMessage: templateWithButton.errorMessage },
    );

    if (!TEMPLATE_SHAPE_MISMATCH_CODES.has(templateWithButton.errorCode ?? -1)) {
      return {
        success: false,
        error: templateWithButton.errorMessage || "Failed to send verification code.",
      };
    }

    // Retry without the button component for templates without a URL button.
    const bodyOnly = await postMessage({
      to: cleanTo,
      type: "template",
      template: {
        name: templateName,
        language: { code: getTemplateLang() },
        components: [{ type: "body", parameters: [{ type: "text", text: otp }] }],
      },
    });

    if (bodyOnly.ok) return { success: true };

    console.error("[WhatsApp OTP] Body-only template retry failed:", {
      errorCode: bodyOnly.errorCode,
      errorMessage: bodyOnly.errorMessage,
    });
    return {
      success: false,
      error: bodyOnly.errorMessage || "Failed to send verification code.",
    };
  }

  const textBody =
    `🔒 *${otp}* is your Bluepin verification code.\n\n` +
    `For your security, do not share this code with anyone. It expires in 5 minutes.`;

  const textRes = await postMessage({
    to: cleanTo,
    type: "text",
    text: { body: textBody, preview_url: false },
  });

  if (!textRes.ok) {
    console.error("[WhatsApp OTP] Error sending WhatsApp OTP:", textRes.errorMessage);
    return {
      success: false,
      error: textRes.errorMessage || "Failed to dispatch WhatsApp message. Check number and Meta API quota.",
    };
  }

  return { success: true };
}

/**
 * Sends an interactive payload to WhatsApp, falling back to plaintext if rejected.
 */
export async function sendMetaInteractive(
  to: string,
  interactive: unknown,
  fallbackText: string,
): Promise<boolean> {
  const cleanTo = normalizePhone(to);
  if (!cleanTo) return false;

  const res = await postMessage({
    to: cleanTo,
    type: "interactive",
    interactive,
  });

  if (!res.ok) {
    console.warn(
      "[WhatsApp] Interactive rejected, falling back to text:",
      { errorCode: res.errorCode, errorMessage: res.errorMessage },
    );
    return sendWhatsAppMessage(cleanTo, fallbackText);
  }
  return true;
}

/**
 * Sends an interactive reply button message (up to 3 buttons) via Meta Cloud API.
 *
 * `fallbackReplyHint` overrides the "Reply with 1, 2, or 3" line in the plaintext
 * fallback. Callers whose buttons overlap with other numbered prompts (such as
 * the glucose timing selection) should pass keyword-based hints to avoid the
 * fallback path colliding with a different 1/2/3 menu.
 */
export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: InteractiveButton[],
  fallbackReplyHint?: string,
): Promise<boolean> {
  const numbered = buttons.map((b, i) => `${i + 1}️⃣ *${b.title}*`).join("\n");
  const hint =
    fallbackReplyHint ?? `\n\nReply with *1*, *2*, or *3*.`;
  const fallback = `${bodyText}\n\n${numbered}${hint}`;

  return sendMetaInteractive(
    to,
    {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
    fallback,
  );
}

export interface InteractiveListSection {
  title?: string;
  rows: { id: string; title: string; description?: string }[];
}

/**
 * Sends an interactive List Message (up to 10 rows).
 */
export async function sendWhatsAppList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: InteractiveListSection[],
): Promise<boolean> {
  const fallback =
    `${bodyText}\n\n` +
    sections
      .flatMap((s) => s.rows)
      .map((r, i) => `${i + 1}. *${r.title}*`)
      .join("\n") +
    "\n\nReply with your choice.";
    
  return sendMetaInteractive(
    to,
    {
      type: "list",
      header: { type: "text", text: "Menu" },
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title ? s.title.slice(0, 24) : "Options",
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description ? r.description.slice(0, 72) : undefined,
          })),
        })),
      },
    },
    fallback,
  );
}

export const WHATSAPP_MAIN_MENU_SECTIONS: InteractiveListSection[] = [
  {
    title: "Bluepin Features",
    rows: [
      { id: "menu_log_glucose", title: "Log glucose", description: "Send a reading or meter photo" },
      { id: "menu_upload_report", title: "Upload health report", description: "Send a PDF report under 5 MB" },
      { id: "menu_set_reminder", title: "Set a reminder", description: "Get reminded to log glucose" },
      { id: "menu_view_profile", title: "View health profile", description: "See history and insights" },
    ],
  },
];

/**
 * Sends the main interactive menu with the appropriate greeting text.
 */
export async function sendWhatsAppMainMenu(
  to: string,
  introType: "welcome" | "help" | "fallback"
): Promise<boolean> {
  let bodyText = "";
  if (introType === "welcome") {
    bodyText = 
      "Hi, I am Aarika from Bluepin. 🙏\n" +
      "I will be your WhatsApp companion for managing your diabetes, right here every day.\n\n" +
      "Here is what I can help you with:";
  } else if (introType === "help") {
    bodyText = "Of course. Here is what I can help you with:";
  } else {
    bodyText = "Hi, I am Aarika from Bluepin.\nHere is what I can help you with:";
  }

  return sendWhatsAppList(to, bodyText, "Main Menu", WHATSAPP_MAIN_MENU_SECTIONS);
}

/**
 * Sends an interactive Call-To-Action (CTA) URL button.
 */
export async function sendWhatsAppCtaUrl(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
): Promise<boolean> {
  return sendMetaInteractive(
    to,
    {
      type: "cta_url",
      body: { text: bodyText },
      action: {
        name: "cta_url",
        parameters: { display_text: buttonText.slice(0, 20), url },
      },
    },
    `${bodyText}\n\n📊 *View in dashboard:*\n${url}`,
  );
}

/**
 * Downloads media (image, PDF, etc.) from WhatsApp servers using the media ID.
 * Enforces a hard size cap and request timeouts so a large or slow payload
 * cannot exhaust memory or hold the worker open.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  if (!token) {
    throw new Error("WHATSAPP_TOKEN is not configured.");
  }

  // 1. Retrieve the temporary media download URL
  const metaRes = await fetch(`${metaBaseUrl}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Failed to fetch media metadata: ${errText.slice(0, 200)}`);
  }

  const metaData = await metaRes.json();
  if (!metaData.url) {
    throw new Error("Meta Graph API did not return a media URL.");
  }

  // 2. Download the binary payload using the Bearer token
  const fileRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });

  if (!fileRes.ok) {
    throw new Error("Failed to download media binary from WhatsApp servers.");
  }

  const declaredLength = Number(fileRes.headers.get("content-length") || "0");
  if (declaredLength > MEDIA_MAX_BYTES) {
    throw new Error(
      `Media is ${(declaredLength / 1024 / 1024).toFixed(1)} MB, over the ${
        MEDIA_MAX_BYTES / 1024 / 1024
      } MB limit.`,
    );
  }

  const arrayBuf = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length > MEDIA_MAX_BYTES) {
    throw new Error(
      `Media is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the ${
        MEDIA_MAX_BYTES / 1024 / 1024
      } MB limit.`,
    );
  }

  const mimeType = (
    metaData.mime_type ||
    fileRes.headers.get("content-type") ||
    "application/octet-stream"
  )
    .split(";")[0]
    .trim();

  return { buffer, mimeType };
}

/**
 * Validates Meta's X-Hub-Signature-256 header against the raw request body.
 * Fails closed in production: a missing app secret rejects the request rather
 * than silently accepting forged webhooks.
 */
export function verifyMetaSignature(
  rawBody: Buffer | string,
  signatureHeader?: string,
): boolean {
  const appSecret = getAppSecret();
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[WhatsApp] WHATSAPP_APP_SECRET is not set; rejecting webhook in production.",
      );
      return false;
    }
    console.warn(
      "[WhatsApp] WHATSAPP_APP_SECRET is not set; signature verification skipped (dev only).",
    );
    return true;
  }

  if (!signatureHeader) return false;

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256" || !/^[0-9a-f]+$/.test(parts[1])) {
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const given = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(expectedSig, "hex");

  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
