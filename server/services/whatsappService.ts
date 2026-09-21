import { getAdminFirestore } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { extractGlucoseFromBase64 } from "./glucoseService";
import { extractLabReportFromUrl } from "./labReportServiceDirect";

// ─── Environment Config ────────────────────────────────────────────────────────
const getWhatsAppToken = () =>
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const getAppSecret = () => process.env.WHATSAPP_APP_SECRET || "";

// ─── Meta Graph API Helpers ───────────────────────────────────────────────────

/**
 * Sends a plain text WhatsApp message via Meta Cloud API.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<boolean> {
  const token = getWhatsAppToken();
  const phoneId = getPhoneNumberId();

  if (!token || !phoneId) {
    console.warn(
      "[WhatsApp] Cannot send message: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
    );
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v26.0/${phoneId}/messages`;
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
 * Downloads media (image, PDF, etc.) from WhatsApp servers using the media ID.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = getWhatsAppToken();
  if (!token) {
    throw new Error("WHATSAPP_TOKEN is not configured.");
  }

  // 1. Retrieve the temporary media download URL
  const metaRes = await fetch(`https://graph.facebook.com/v26.0/${mediaId}`, {
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
): Promise<{ success: boolean; message: string }> {
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
      await sendWhatsAppMessage(senderPhone, result.message);
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
    if (messageType === "text") {
      await handleTextGlucoseLogging(
        uid,
        senderPhone,
        message.text.body.trim(),
      );
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
      "🤔 I didn't recognize that reading format.\\n\\nTry sending: `120 Fasting`, `145 PP`, or just `110`. Send `HELP` for more options.",
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
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();

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

  const readingId = uuidv4();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().substring(0, 5);

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

  await sendWhatsAppMessage(
    senderPhone,
    `✅ *Glucose Logged Successfully!*\\n\\n` +
      `• *Reading:* ${rawValue} ${unit}\\n` +
      `• *Timing:* ${timing}\\n` +
      `• *Logged:* Today at ${timeStr}\\n\\n` +
      `Updated on your Bluepin dashboard.`,
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
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const day = now.getUTCDate();

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

      const readingId = uuidv4();
      const dateStr = result.readingDate || now.toISOString().split("T")[0];
      const timeStr = result.readingTime || now.toTimeString().substring(0, 5);

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
        timing: "Random",
        source: "OCR",
        date: dateStr,
        time: timeStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      await sendWhatsAppMessage(
        senderPhone,
        `📸 *Glucometer Reading Extracted!*\\n\\n` +
          `• *Value:* ${result.value} ${result.unit || "mg/dL"}\\n` +
          `• *Detected Time:* ${dateStr} ${timeStr}\\n\\n` +
          `Saved to your Bluepin logs.`,
      );
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
      "⚠️ Could not detect a clear glucose number or medical report from this photo.\\n\\n" +
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
    "⏳ *Analyzing your medical report...*\\nOur AI is extracting biomarkers. This usually takes 15-30 seconds.",
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
  const reportId = uuidv4();
  const now = new Date();
  const reportDate = now.toISOString().split("T")[0];
  const reportName = originalFileName.replace(/\.[^/.]+$/, "") || "Lab Report";

  try {
    // 1. Check user limits first
    const limitsRef = db.doc(`users/${uid}/stats/limits`);
    const limitsSnap = await limitsRef.get();
    const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
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
    const bucket = getStorage().bucket();
    const downloadToken = uuidv4();
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
    const topMarkers = result.biomarkers
      .slice(0, 5)
      .map((bm: any) => {
        const statusIcon =
          bm.status === "Healthy"
            ? "🟢"
            : bm.status === "Borderline"
              ? "🟡"
              : "🔴";
        return `• ${bm.name}: *${bm.value} ${bm.unit || ""}* ${statusIcon}`;
      })
      .join("\\n");

    await sendWhatsAppMessage(
      senderPhone,
      `📄 *Medical Report Processed!*\\n\\n` +
        `*Report:* ${reportName}\\n` +
        `*Type:* ${result.reportType || "Diagnostic Test"}\\n` +
        `*Biomarkers Detected:* ${result.biomarkers.length}\\n\\n` +
        `*Key Results:*\\n${topMarkers}\\n\\n` +
        `📊 Full analytics and trend graphs are ready on your Bluepin dashboard.`,
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
