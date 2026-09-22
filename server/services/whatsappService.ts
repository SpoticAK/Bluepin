import { getAdminFirestore } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import crypto from "crypto";
import { extractGlucoseFromBase64 } from "./glucoseService";
import { extractLabReportFromUrl } from "./labReportServiceDirect";

// ─── Environment Config ────────────────────────────────────────────────────────
const getWhatsAppToken = () =>
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const getAppSecret = () => process.env.WHATSAPP_APP_SECRET || "";
const getStorageBucket = () =>
  getStorage().bucket(
    process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      "myhealthyfam-28c2c.firebasestorage.app",
  );
const getMetaBaseUrl = () =>
  process.env.META_BASE_URL || "https://graph.facebook.com/v26.0";
const getDashboardUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "https://app.bluepin.in").replace(/\/+$/, "");

const getUtcDay = (d = new Date()) => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
  day: d.getUTCDate(),
});

/**
 * Resolves local date and time strings (YYYY-MM-DD, HH:mm) based on user's phone country code.
 */
function getFormattedUserTime(
  senderPhone: string,
  dateObj = new Date(),
): { dateStr: string; timeStr: string } {
  let timeZone = "Asia/Kolkata";
  if (senderPhone.startsWith("1")) timeZone = "America/New_York";
  else if (senderPhone.startsWith("44")) timeZone = "Europe/London";
  else if (senderPhone.startsWith("971")) timeZone = "Asia/Dubai";
  else if (senderPhone.startsWith("65")) timeZone = "Asia/Singapore";
  else if (senderPhone.startsWith("61")) timeZone = "Australia/Sydney";
  if (process.env.APP_TIMEZONE) timeZone = process.env.APP_TIMEZONE;

  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    dateObj,
  ); // YYYY-MM-DD
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj); // HH:mm

  return { dateStr, timeStr };
}

function getBiomarkerDisplayStatus(bm: any): { label: string; icon: string } {
  const s = String(bm.status || "")
    .toLowerCase()
    .trim();
  const raw = String(bm.rawValue || "")
    .toLowerCase()
    .trim();

  if (
    s === "normal" ||
    s === "healthy" ||
    raw === "absent" ||
    raw === "nil" ||
    raw === "negative" ||
    raw === "clear"
  ) {
    return { label: "Normal", icon: "🟢" };
  }
  if (s === "borderline" || raw.includes("trace")) {
    return { label: "Borderline", icon: "🟡" };
  }
  if (
    s === "high" ||
    s === "low" ||
    s.includes("attention") ||
    raw === "positive" ||
    raw === "present" ||
    raw === "reactive"
  ) {
    return { label: s ? s.toUpperCase() : "Out of Range", icon: "🔴" };
  }
  return { label: "Recorded", icon: "⚪" };
}

function formatKeyBiomarkersSummary(biomarkers: any[]): string {
  if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
    return "• No specific biomarkers listed.";
  }

  // Filter out non-actionable physical specimen metadata if more specific clinical markers exist
  const isPhysicalAttribute = (name: string) =>
    /^(?:physical\s*appearance|colour|color|transparency|appearance|specimen|quantity|sample\s*type|volume)$/i.test(
      name.trim(),
    );

  const clinicalMarkers = biomarkers.filter(
    (b) => !isPhysicalAttribute(b.name || ""),
  );
  const pool = clinicalMarkers.length >= 3 ? clinicalMarkers : biomarkers;

  // Sort to surface abnormal / needs attention markers first
  const sorted = [...pool].sort((a, b) => {
    const statusA = getBiomarkerDisplayStatus(a).icon;
    const statusB = getBiomarkerDisplayStatus(b).icon;
    const scoreA = statusA === "🔴" ? 2 : statusA === "🟡" ? 1 : 0;
    const scoreB = statusB === "🔴" ? 2 : statusB === "🟡" ? 1 : 0;
    return scoreB - scoreA;
  });

  return sorted
    .slice(0, 5)
    .map((bm: any) => {
      const { icon } = getBiomarkerDisplayStatus(bm);
      const displayVal =
        bm.value !== null && bm.value !== undefined && !isNaN(Number(bm.value))
          ? bm.value
          : bm.rawValue || "Recorded";
      const unitStr = bm.unit && bm.unit.trim() ? ` ${bm.unit.trim()}` : "";
      return `• ${bm.name}: *${displayVal}${unitStr}* ${icon}`;
    })
    .join("\n");
}

// ─── Meta Graph API Helpers ───────────────────────────────────────────────────

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

async function sendMetaInteractive(
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
  buttons: Array<{ id: string; title: string }>,
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
 * Generates a single-use 24-hour magic login link for a user's dashboard.
 * When tapped, it automatically authenticates the user into Bluepin.
 */
export async function createWhatsAppMagicLoginUrl(
  uid: string,
): Promise<string> {
  try {
    const db = getAdminFirestore();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.doc(`whatsapp_magic_tokens/${token}`).set({
      uid,
      expiresAt,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const base =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      "https://app.bluepin.in";
    return `${base.replace(/\/+$/, "")}?wa_t=${token}`;
  } catch (err) {
    console.error(
      "[WhatsApp] Error creating magic login url, falling back to static dashboard url:",
      err,
    );
    return getDashboardUrl();
  }
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

// ─── Account Linking (Option A) ───────────────────────────────────────────────

/**
 * Generates a 6-digit linking code for an authenticated Bluepin user.
 */
export async function createWhatsAppLinkCode(
  uid: string,
): Promise<{ code: string; expiresIn: number }> {
  const db = getAdminFirestore();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInSeconds = 10 * 60; // 10 minutes
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  await db.doc(`whatsapp_links/${code}`).set({
    uid,
    code,
    createdAt: Date.now(),
    expiresAt,
  });

  return { code, expiresIn: expiresInSeconds };
}

/**
 * Attempts to link a WhatsApp sender phone number with a Bluepin account via 6-digit code.
 */
export async function linkWhatsAppAccount(
  senderPhone: string,
  code: string,
): Promise<{ success: boolean; message: string; uid?: string }> {
  const db = getAdminFirestore();
  const cleanCode = code.trim();
  const linkRef = db.doc(`whatsapp_links/${cleanCode}`);
  const snap = await linkRef.get();

  if (!snap.exists) {
    return {
      success: false,
      message:
        "⚠️ Link code is invalid. Please generate a new code in your Bluepin dashboard under Settings > WhatsApp Sync.",
    };
  }

  const data = snap.data()!;
  if (Date.now() > data.expiresAt) {
    await linkRef.delete();
    return {
      success: false,
      message:
        "⚠️ This link code has expired. Please generate a fresh code in your Bluepin dashboard.",
    };
  }

  const uid = data.uid;

  const batch = db.batch();
  // Store mapping: phone -> uid
  batch.set(db.doc(`whatsapp_users/${senderPhone}`), {
    uid,
    phone: senderPhone,
    linkedAt: Date.now(),
  });

  // Store mapping in user's profile
  batch.update(db.doc(`users/${uid}`), {
    whatsappPhone: senderPhone,
  });

  // Remove used code
  batch.delete(linkRef);

  await batch.commit();

  return {
    success: true,
    uid,
    message:
      "🎉 *Account successfully linked!*\n\nWelcome to Bluepin WhatsApp Sync. You can now:\n" +
      "• 🩸 *Log glucose:* Reply with readings like `115 Fasting`, `140 PP`, or `95`\n" +
      "• 📸 *Glucometer photo:* Send a photo of your meter screen to log automatically\n" +
      "• 📄 *Medical reports:* Send PDF or image lab reports to analyze biomarkers\n\n" +
      "Send *HELP* anytime for quick commands.",
  };
}

/**
 * Unlinks WhatsApp from a user account.
 */
export async function unlinkWhatsAppAccount(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return false;
  const phone = userSnap.data()?.whatsappPhone;

  const batch = db.batch();
  batch.update(userRef, { whatsappPhone: FieldValue.delete() });
  if (phone) {
    batch.delete(db.doc(`whatsapp_users/${phone}`));
  }
  await batch.commit();
  return true;
}

// ─── Incoming Message Processing Pipeline ─────────────────────────────────────

/**
 * Main handler for any incoming WhatsApp message.
 */
export async function processIncomingWhatsAppMessage(message: any) {
  const senderPhone = (message.from || "").replace(/[^0-9]/g, "");
  const messageType = message.type;
  const db = getAdminFirestore();

  console.log(
    `[WhatsApp] Received message type '${messageType}' from ${senderPhone}`,
  );

  // 1. Check for LINK command (e.g. "LINK 123456", "CONNECT 123456", or just "123456")
  if (messageType === "text") {
    const rawText = (message.text?.body || "").trim();
    const linkMatch = rawText.match(
      /^(?:(?:link|connect)\s*[:=]?\s*)?(\d{6})$/i,
    );
    if (linkMatch) {
      const code = linkMatch[1];
      const result = await linkWhatsAppAccount(senderPhone, code);
      if (result.success && result.uid) {
        const magicUrl = await createWhatsAppMagicLoginUrl(result.uid);
        await sendWhatsAppCtaUrl(
          senderPhone,
          result.message,
          "Open Dashboard",
          magicUrl,
        );
      } else {
        await sendWhatsAppMessage(senderPhone, result.message);
      }
      return;
    }

    if (rawText.toLowerCase() === "help") {
      await sendWhatsAppMessage(
        senderPhone,
        "📋 *Bluepin WhatsApp Guide*\n\n" +
          "• *Log Glucose:* Send `110 Fasting`, `145 PP`, or `98`\n" +
          "• *Photo of Meter:* Send a clear photo of your glucometer\n" +
          "• *Lab Reports:* Send a PDF document or lab photo\n" +
          "• *Link Account:* Send `LINK <6-digit code>`\n\n" +
          "Access your web dashboard at https://bluepin.in",
      );
      return;
    }
  }

  // 2. Identify linked user by phone
  const userDoc = await db.doc(`whatsapp_users/${senderPhone}`).get();
  if (!userDoc.exists) {
    await sendWhatsAppMessage(
      senderPhone,
      "👋 Welcome to *Bluepin*! Your WhatsApp is not connected to an account yet.\n\n" +
        "1. Open your Bluepin dashboard on web\n" +
        "2. Click your profile icon > *WhatsApp Sync*\n" +
        "3. Copy the 6-digit code and reply here with: `LINK <code>` (or just send the 6-digit code)",
    );
    return;
  }

  const uid = userDoc.data()!.uid;

  // 3. Handle Message Types
  try {
    if (messageType === "interactive") {
      const btnId =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id ||
        "";
      const btnTitle =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "";

      let timingChoice: "Fasting" | "Post-Prandial" | "Random" | null = null;
      if (btnId === "timing_fasting" || /fast/i.test(btnTitle)) {
        timingChoice = "Fasting";
      } else if (btnId === "timing_pp" || /post|pp|prandial/i.test(btnTitle)) {
        timingChoice = "Post-Prandial";
      } else if (btnId === "timing_random" || /random/i.test(btnTitle)) {
        timingChoice = "Random";
      }

      if (timingChoice) {
        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      await sendWhatsAppMessage(
        senderPhone,
        "ℹ️ This option has already been recorded or expired. Send a new reading or meter photo anytime!",
      );
      return;
    } else if (messageType === "text") {
      const rawText = (message.text?.body || "").trim();

      // Check if user answered a pending timing prompt via text (e.g., "1", "2", "3", "fasting", "pp", "random")
      const timingMatch = rawText.match(
        /^(?:1|2|3|fasting|fast|pp|post-?prandial|post-?meal|after-?meal|random)$/i,
      );
      if (timingMatch) {
        const lower = rawText.toLowerCase();
        let timingChoice: "Fasting" | "Post-Prandial" | "Random" = "Random";
        if (lower === "1" || lower.includes("fast")) {
          timingChoice = "Fasting";
        } else if (
          lower === "2" ||
          lower.includes("pp") ||
          lower.includes("post") ||
          lower.includes("after")
        ) {
          timingChoice = "Post-Prandial";
        } else if (lower === "3" || lower.includes("random")) {
          timingChoice = "Random";
        }

        const handled = await handleTimingSelection(senderPhone, timingChoice);
        if (handled) return;
      }

      await handleTextGlucoseLogging(uid, senderPhone, rawText);
    } else if (messageType === "image") {
      await handleImageMessage(uid, senderPhone, message.image);
    } else if (messageType === "document") {
      await handleDocumentReport(uid, senderPhone, message.document);
    } else {
      await sendWhatsAppMessage(
        senderPhone,
        "ℹ️ Bluepin supports text readings (e.g. `120 Fasting`), glucometer photos, and medical report PDFs.",
      );
    }
  } catch (err: any) {
    console.error("[WhatsApp] Error processing message:", err);
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ An error occurred while processing your request. Please try again or check your Bluepin dashboard.",
    );
  }
}

/**
 * Handles user selecting a timing (Fasting, Post-Prandial, or Random) for a pending glucometer reading.
 */
async function handleTimingSelection(
  senderPhone: string,
  timingChoice: "Fasting" | "Post-Prandial" | "Random",
): Promise<boolean> {
  const db = getAdminFirestore();
  const pendingRef = db.doc(`whatsapp_pending_glucose/${senderPhone}`);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    return false;
  }

  const pendingData = pendingSnap.data()!;
  const { uid, readingId, value, unit, time } = pendingData;

  // 1. Update the glucose reading in Firestore
  if (uid && readingId) {
    await db.doc(`users/${uid}/glucoseReadings/${readingId}`).update({
      timing: timingChoice,
    });
  }

  // 2. Clear pending state
  await pendingRef.delete();

  // 3. Send confirmation with 1-click magic login CTA button
  const magicUrl = uid
    ? await createWhatsAppMagicLoginUrl(uid)
    : getDashboardUrl();
  await sendWhatsAppCtaUrl(
    senderPhone,
    `✅ *Timing Updated to ${timingChoice}!* 🩸\n\n` +
      `• *Reading:* ${value} ${unit}\n` +
      `• *Timing:* ${timingChoice}\n` +
      `• *Time:* ${time}`,
    "Open Dashboard",
    magicUrl,
  );

  return true;
}

// ─── Text Glucose Handler ─────────────────────────────────────────────────────

async function handleTextGlucoseLogging(
  uid: string,
  senderPhone: string,
  text: string,
) {
  const db = getAdminFirestore();

  // Pattern: "110", "110 fasting", "145 pp", "145 post-meal", "5.6 mmol/l"
  const regex =
    /^(?:glucose\s*:?\s*)?(\d{1,3}(?:\.\d+)?)\s*(mg\/?dl|mmol\/?l)?\s*(fasting|fast|pp|post-?prandial|post-?meal|random|bedtime|after-?meal|before-?meal)?$/i;
  const match = text.match(regex);

  if (!match) {
    await sendWhatsAppMessage(
      senderPhone,
      "🤔 I didn't recognize that reading format.\n\nTry sending: `120 Fasting`, `145 PP`, or just `110`. Send `HELP` for more options.",
    );
    return;
  }

  const rawValue = parseFloat(match[1]);
  if (isNaN(rawValue) || rawValue <= 0 || rawValue > 1000) {
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ Please enter a valid glucose number between 20 and 800.",
    );
    return;
  }

  let unit = match[2]
    ? match[2].toUpperCase().replace("/", "/")
    : rawValue < 30
      ? "mmol/L"
      : "mg/dL";
  if (unit === "MG/DL") unit = "mg/dL";

  const rawTiming = (match[3] || "Random").toLowerCase();
  let timing: "Fasting" | "Post-Prandial" | "Random" = "Random";
  if (rawTiming.includes("fast")) {
    timing = "Fasting";
  } else if (
    rawTiming.includes("pp") ||
    rawTiming.includes("post") ||
    rawTiming.includes("after")
  ) {
    timing = "Post-Prandial";
  }

  // Check and update limits in Firestore
  const limitsRef = db.doc(`users/${uid}/stats/limits`);
  const limitsSnap = await limitsRef.get();
  const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

  const now = new Date();
  const { year, month, day } = getUtcDay(now);
  const isNewDay =
    limitsData.gYear !== year ||
    limitsData.gMonth !== month ||
    limitsData.gDay !== day;
  const gCount = isNewDay ? 1 : (limitsData.gCount || 0) + 1;

  if (gCount > 10) {
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ You have reached the daily limit of 10 glucose readings for today.",
    );
    return;
  }

  const readingId = crypto.randomUUID();
  const { dateStr, timeStr } = getFormattedUserTime(senderPhone, now);

  const batch = db.batch();
  batch.set(
    limitsRef,
    { gYear: year, gMonth: month, gDay: day, gCount },
    { merge: true },
  );
  batch.set(db.doc(`users/${uid}/glucoseReadings/${readingId}`), {
    id: readingId,
    value: rawValue,
    unit,
    timing,
    source: "Manual",
    date: dateStr,
    time: timeStr,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  const magicUrl = await createWhatsAppMagicLoginUrl(uid);
  await sendWhatsAppCtaUrl(
    senderPhone,
    `✅ *Glucose Logged Successfully!*\n\n` +
      `• *Reading:* ${rawValue} ${unit}\n` +
      `• *Timing:* ${timing}\n` +
      `• *Logged:* Today at ${timeStr}`,
    "Open Dashboard",
    magicUrl,
  );
}

// ─── Image Handler (Glucometer or Lab Report Photo) ───────────────────────────

async function handleImageMessage(
  uid: string,
  senderPhone: string,
  imageObj: any,
) {
  const mediaId = imageObj.id;
  const caption = (imageObj.caption || "").toLowerCase();

  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);

  // If user explicitly captioned the image as a report/lab test
  if (
    caption.includes("report") ||
    caption.includes("lab") ||
    caption.includes("test")
  ) {
    await processMedicalReportBuffer(
      uid,
      senderPhone,
      buffer,
      mimeType,
      "Lab Report Photo",
    );
    return;
  }

  // Attempt glucometer OCR first
  const base64Data = buffer.toString("base64");
  try {
    const result = await extractGlucoseFromBase64(base64Data, mimeType);

    if (result.success && result.value) {
      const db = getAdminFirestore();
      const limitsRef = db.doc(`users/${uid}/stats/limits`);
      const limitsSnap = await limitsRef.get();
      const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

      const now = new Date();
      const { year, month, day } = getUtcDay(now);
      const isNewDay =
        limitsData.gYear !== year ||
        limitsData.gMonth !== month ||
        limitsData.gDay !== day;
      const gCount = isNewDay ? 1 : (limitsData.gCount || 0) + 1;

      if (gCount > 10) {
        await sendWhatsAppMessage(
          senderPhone,
          "⚠️ You have reached the daily limit of 10 glucose readings for today.",
        );
        return;
      }

      const readingId = crypto.randomUUID();
      const { dateStr: fallbackDate, timeStr: fallbackTime } =
        getFormattedUserTime(senderPhone, now);
      const dateStr = result.readingDate || fallbackDate;
      const timeStr = result.readingTime || fallbackTime;

      const batch = db.batch();
      batch.set(
        limitsRef,
        { gYear: year, gMonth: month, gDay: day, gCount },
        { merge: true },
      );
      batch.set(db.doc(`users/${uid}/glucoseReadings/${readingId}`), {
        id: readingId,
        value: result.value,
        unit: result.unit || "mg/dL",
        timing: "Random", // Default until user selects
        source: "OCR",
        date: dateStr,
        time: timeStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Store pending timing selection state
      batch.set(db.doc(`whatsapp_pending_glucose/${senderPhone}`), {
        uid,
        readingId,
        value: result.value,
        unit: result.unit || "mg/dL",
        date: dateStr,
        time: timeStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      const promptText =
        `📸 *Glucometer Reading Extracted: ${result.value} ${result.unit || "mg/dL"}*\n` +
        `• *Detected Time:* ${dateStr} ${timeStr}\n\n` +
        `How long after eating or drinking was this reading taken?`;

      await sendWhatsAppButtons(senderPhone, promptText, [
        { id: "timing_pp", title: "Post-Meal (<2h)" },
        { id: "timing_random", title: "Random (2–8h)" },
        { id: "timing_fasting", title: "Fasting (>8h)" },
      ]);
      return;
    }
  } catch {
    // If glucometer OCR had an error, try lab report fallback below
  }

  // Fallback: Check if photo was an uncaptioned lab report
  const reportHandled = await processMedicalReportBuffer(
    uid,
    senderPhone,
    buffer,
    mimeType,
    "Lab Report Photo",
    true,
  );
  if (!reportHandled) {
    await sendWhatsAppMessage(
      senderPhone,
      "⚠️ Could not detect a clear glucose number or medical report from this photo.\n\n" +
        "Tip: Ensure the meter display is in focus and well lit, or type your reading directly (e.g. `115 Fasting`).",
    );
  }
}

// ─── Document Handler (PDF Lab Reports) ───────────────────────────────────────

async function handleDocumentReport(
  uid: string,
  senderPhone: string,
  docObj: any,
) {
  const mediaId = docObj.id;
  const fileName = docObj.filename || "Lab_Report.pdf";

  await sendWhatsAppMessage(
    senderPhone,
    "⏳ *Analyzing your medical report...*\nOur AI is extracting biomarkers. This usually takes 15-30 seconds.",
  );

  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);
  await processMedicalReportBuffer(
    uid,
    senderPhone,
    buffer,
    mimeType,
    fileName,
  );
}

// ─── Shared Medical Report Processing ─────────────────────────────────────────

async function processMedicalReportBuffer(
  uid: string,
  senderPhone: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string,
  silentOnFailure = false,
): Promise<boolean> {
  const db = getAdminFirestore();
  const reportId = crypto.randomUUID();
  const now = new Date();
  const { dateStr: reportDate } = getFormattedUserTime(senderPhone, now);
  const reportName = originalFileName.replace(/\.[^/.]+$/, "") || "Lab Report";

  try {
    // 1. Check user limits first
    const limitsRef = db.doc(`users/${uid}/stats/limits`);
    const limitsSnap = await limitsRef.get();
    const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

    const { year, month, day } = getUtcDay(now);
    const isNewDay =
      limitsData.rYear !== year ||
      limitsData.rMonth !== month ||
      limitsData.rDay !== day;
    const rCount = isNewDay ? 1 : (limitsData.rCount || 0) + 1;
    const rTotal = (limitsData.rTotal || 0) + 1;

    if (rCount > 20 || rTotal > 100) {
      await sendWhatsAppMessage(
        senderPhone,
        "⚠️ You have reached the maximum allowed limit for medical reports.",
      );
      return false;
    }

    // 2. Upload to Firebase Storage with token URL
    const bucket = getStorageBucket();
    const downloadToken = crypto.randomUUID();
    const cleanExt = mimeType.includes("pdf") ? "pdf" : "jpg";
    const storagePath = `users/${uid}/labReports/${reportId}_${reportName.replace(/[^a-zA-Z0-9]/g, "_")}.${cleanExt}`;
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storageFile.name)}?alt=media&token=${downloadToken}`;

    // 3. AI Extraction via labReportServiceDirect
    const result = await extractLabReportFromUrl(fileUrl, mimeType);

    if (
      !result.success ||
      !Array.isArray(result.biomarkers) ||
      result.biomarkers.length === 0
    ) {
      if (!silentOnFailure) {
        await sendWhatsAppMessage(
          senderPhone,
          "⚠️ We analyzed the document but couldn't detect recognized lab biomarkers. Please ensure the report contains blood or diagnostic tests.",
        );
      }
      return false;
    }

    // 4. Save to Firestore (matches server/upload.ts)
    const batch = db.batch();
    batch.set(
      limitsRef,
      { rYear: year, rMonth: month, rDay: day, rCount, rTotal },
      { merge: true },
    );

    const reportRef = db.doc(`users/${uid}/labReports/${reportId}`);
    batch.set(reportRef, {
      id: reportId,
      name: reportName,
      fileUrl,
      date: reportDate,
      reportType: result.reportType ?? null,
      specimenType: result.specimenType ?? null,
      biomarkers: result.biomarkers,
      userId: uid,
      source: "WhatsApp",
      createdAt: FieldValue.serverTimestamp(),
    });

    for (const bm of result.biomarkers) {
      const safeId = (bm.name as string).replace(/[^a-zA-Z0-9]/g, "");
      const bmRef = db.doc(`users/${uid}/biomarkers/${reportId}_${safeId}`);
      batch.set(bmRef, {
        userId: uid,
        reportId,
        name: bm.name,
        value: bm.value,
        reportDate,
        status: bm.status,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    // 5. Build summary of extracted biomarkers
    const topMarkers = formatKeyBiomarkersSummary(result.biomarkers);

    const magicUrl = await createWhatsAppMagicLoginUrl(uid);
    await sendWhatsAppCtaUrl(
      senderPhone,
      `📄 *Medical Report Processed!*\n\n` +
        `*Report:* ${reportName}\n` +
        `*Type:* ${result.reportType || "Diagnostic Test"}\n` +
        `*Biomarkers Detected:* ${result.biomarkers.length}\n\n` +
        `*Key Results:*\n${topMarkers}`,
      "Open Dashboard",
      magicUrl,
    );

    return true;
  } catch (err: any) {
    console.error("[WhatsApp] Medical report processing error:", err);
    if (!silentOnFailure) {
      await sendWhatsAppMessage(
        senderPhone,
        "⚠️ Failed to process this medical report. Please try uploading it directly from the Bluepin web app.",
      );
    }
    return false;
  }
}
