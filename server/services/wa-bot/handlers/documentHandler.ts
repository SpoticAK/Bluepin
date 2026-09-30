import { downloadWhatsAppMedia } from "../../whatsapp/client";
import { getUidByPhone } from "../services/glucoseService";
import {
  uploadReportToStorage,
  extractAndSaveReport,
} from "../services/reportService";
import { sendTextMessage } from "../wa-client";
import { checkReportLimits } from "../../whatsapp/utils";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Handles an incoming PDF or image medical report sent via WhatsApp.
 */
export async function handleMedicalDocUpload(
  sender: string,
  mediaId: string,
  fileName: string,
  fileSize: number | undefined,
  mimeType: string,
): Promise<void> {
  // ── Guard: must be a linked Bluepin account ────────────────────────────────
  const uid = await getUidByPhone(sender);
  if (!uid) {
    await sendTextMessage(
      sender,
      "📄 I received your document, but your WhatsApp is not linked to a Bluepin account yet.\n\n" +
        "Open the Bluepin app to link your number, then try again.",
    );
    return;
  }

  // ── Guard: reject oversized files before downloading ───────────────────────
  if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
    await sendTextMessage(
      sender,
      "⚠️ That file is over 5 MB. Please compress it or send a smaller version.",
    );
    return;
  }

  // ── Guard: check daily/monthly limits (super fast, 1 DB read) ──────────────
  const limitCheck = await checkReportLimits(uid, new Date());
  if (!limitCheck.allowed) {
    await sendTextMessage(
      sender,
      "⚠️ You have reached the maximum allowed limit for medical reports.",
    );
    return;
  }

  // ── Respond immediately — before any slow network calls! ───────────────────
  // By sending this now, the user gets a reply in < 1 second.
  await sendTextMessage(
    sender,
    "I am analyzing it in the background⌛. I will send you a notification once it is ready — " +
      "this usually takes 15–30 seconds.",
  );

  // ── Download from Meta (can take 2-5 seconds for a 5MB PDF) ────────────────
  let buffer: Buffer;
  let resolvedMimeType: string;
  try {
    ({ buffer, mimeType: resolvedMimeType } =
      await downloadWhatsAppMedia(mediaId));
  } catch (err) {
    console.error("[documentHandler] Download failed:", err);
    await sendTextMessage(
      sender,
      "⚠️ I could not download your file. Please try sending it again.",
    );
    return;
  }

  // ── Upload to Firebase Storage ─────────────────────────────────────────────
  const uploaded = await uploadReportToStorage(
    uid,
    sender,
    buffer,
    resolvedMimeType,
    fileName,
    limitCheck,
  );

  // ── AI extraction + Firestore write + completion CTA (background) ──────────
  extractAndSaveReport(uid, sender, uploaded).catch((err) => {
    console.error("[documentHandler] Background extraction error:", err);
  });
}
