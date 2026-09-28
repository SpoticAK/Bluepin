import crypto from "crypto";
import { InteractiveButton } from "./types";

export const getWhatsAppToken = () =>
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";

export const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export const getAppSecret = () => process.env.WHATSAPP_APP_SECRET || "";

export const getMetaBaseUrl = () =>
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";

/**
 * Sends a plain text WhatsApp message via Meta Cloud API.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<boolean> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();

  if (!token || !phoneId) {
    console.warn(
      "[WhatsApp] Cannot send message: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
    );
    return false;
  }

  try {
    const url = `${metaBaseUrl}/${phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[WhatsApp] Error sending message:", errText);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("[WhatsApp] Exception sending message:", err.message || err);
    return false;
  }
}

/**
 * Sends a pre-approved Utility or Marketing template via Meta Cloud API.
 * Use this to initiate conversations outside the 24-hour window.
 */
export async function sendWhatsAppUtilityTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en", // Often "en" or "en_US"
): Promise<boolean> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();

  if (!token || !phoneId) return false;

  try {
    const url = `${metaBaseUrl}/${phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          // If your template has variables like {{1}}, you would add the `components` array here.
          // Since the reminder copy has no variables, we can omit it.
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[WhatsApp] Error sending template '${templateName}':`, errText);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error(`[WhatsApp] Exception sending template '${templateName}':`, err.message || err);
    return false;
  }
}

/**
 * Sends a 6-digit verification code to the recipient's WhatsApp.
 * Supports Meta Authentication templates as well as direct text messages.
 */
export async function sendWhatsAppOtp(
  to: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();

  if (!token || !phoneId) {
    console.warn(
      "[WhatsApp OTP] Cannot send OTP: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
    );
    return {
      success: false,
      error: "WhatsApp service credentials not configured on server.",
    };
  }

  // Meta expects E.164 without '+' or special characters (e.g. 919876543210)
  const cleanTo = to.replace(/\D/g, "");
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;

  try {
    const url = `${metaBaseUrl}/${phoneId}/messages`;

    // 1. If an approved Authentication / OTP template is configured, try it first
    if (templateName) {
      const templatePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en_US" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: otp }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ],
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
      });

      if (res.ok) {
        return { success: true };
      }

      // If button-style failed (e.g. template has no button), retry with body parameters only
      const bodyOnlyPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en_US" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: otp }],
            },
          ],
        },
      };

      const retryRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyOnlyPayload),
      });

      if (retryRes.ok) {
        return { success: true };
      }

      const errText = await retryRes.text();
      console.warn("[WhatsApp OTP] Template send failed, falling back to text payload:", errText);
    }

    // 2. Direct text payload (supported in sandbox or within active window)
    const textBody =
      `🔒 *${otp}* is your Bluepin verification code.\n\n` +
      `For your security, do not share this code with anyone. It expires in 5 minutes.`;

    const textRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body: textBody, preview_url: false },
      }),
    });

    if (!textRes.ok) {
      const errText = await textRes.text();
      console.error("[WhatsApp OTP] Error sending WhatsApp OTP:", errText);
      return {
        success: false,
        error: "Failed to dispatch WhatsApp message. Check number and Meta API quota.",
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[WhatsApp OTP] Exception sending OTP:", err.message || err);
    return { success: false, error: err.message || "Failed to send WhatsApp OTP" };
  }
}

/**
 * Sends an interactive payload to WhatsApp, falling back to plaintext if rejected.
 */
export async function sendMetaInteractive(
  to: string,
  interactive: any,
  fallbackText: string,
): Promise<boolean> {
  const metaBaseUrl = getMetaBaseUrl();
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();
  if (!token || !phoneId) return false;

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
        to,
        type: "interactive",
        interactive,
      }),
    });

    if (!res.ok) {
      console.warn(
        "[WhatsApp] Interactive rejected, falling back to text:",
        await res.text(),
      );
      return sendWhatsAppMessage(to, fallbackText);
    }
    return true;
  } catch (err: any) {
    console.error("[WhatsApp] Error sending interactive:", err);
    return sendWhatsAppMessage(to, fallbackText);
  }
}

/**
 * Sends an interactive reply button message (up to 3 buttons) via Meta Cloud API.
 */
export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: InteractiveButton[],
): Promise<boolean> {
  const fallback =
    `${bodyText}\n\n` +
    buttons.map((b, i) => `${i + 1}️⃣ *${b.title}*`).join("\n") +
    "\n\nReply with *1*, *2*, or *3*.";
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
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Failed to fetch media metadata: ${errText}`);
  }

  const metaData = await metaRes.json();
  if (!metaData.url) {
    throw new Error("Meta Graph API did not return a media URL.");
  }

  // 2. Download the binary payload using the Bearer token
  const fileRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileRes.ok) {
    throw new Error(`Failed to download media binary from ${metaData.url}`);
  }

  const arrayBuf = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
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
 */
export function verifyMetaSignature(
  rawBody: Buffer | string,
  signatureHeader?: string,
): boolean {
  const appSecret = getAppSecret();
  if (!appSecret) {
    // If not configured in dev/testing, log warning and allow
    return true;
  }
  if (!signatureHeader) {
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(parts[1], "hex"),
    Buffer.from(expectedSig, "hex"),
  );
}
