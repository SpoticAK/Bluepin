import { downloadWhatsAppMedia } from "../../whatsapp/client";
import { getUidByPhone } from "../services/glucoseService";
import { uploadReportToStorage, extractAndSaveReport } from "../services/reportService";
import { sendTextMessage } from "../wa-client";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Handles an incoming PDF or image medical report sent via WhatsApp.
 *
 * Deliberately split into two phases so the user gets an immediate response:
 *
 * Phase 1 (sync, ~3-5s total):
 *   uid check → file size check → download from Meta → upload to Firebase Storage
 *   → respond to user ✅
 *
 * Phase 2 (fire-and-forget, 15-30s):
 *   Gemini AI extraction → Firestore write → completion CTA sent to user
 *
 * The user is never blocked waiting for AI.
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

  // ── Phase 1a: Download from Meta ───────────────────────────────────────────
  let buffer: Buffer;
  let resolvedMimeType: string;
  try {
    ({ buffer, mimeType: resolvedMimeType } = await downloadWhatsAppMedia(mediaId));
  } catch (err) {
    console.error("[documentHandler] Download failed:", err);
    await sendTextMessage(
      sender,
      "⚠️ I could not download your file. Please try sending it again.",
    );
    return;
  }

  // ── Phase 1b: Upload to Firebase Storage + check limits ───────────────────
  const uploaded = await uploadReportToStorage(uid, sender, buffer, resolvedMimeType, fileName);

  if (!uploaded) {
    // Daily/total report limit reached
    await sendTextMessage(
      sender,
      "⚠️ You have reached the maximum allowed limit for medical reports.",
    );
    return;
  }

  // ── Respond immediately — user does NOT wait for AI ────────────────────────
  // ↓ EDIT THIS MESSAGE to change what the user sees right after sending the PDF
  await sendTextMessage(
    sender,
    "📄 Got it! Your health report has been received.\n\n" +
    "I am analyzing it in the background. I will send you a notification once it is ready — " +
    "this usually takes 15–30 seconds.",
  );

  // ── Phase 2: AI extraction + Firestore write + completion CTA (background) ─
  // No await — returns immediately. User already has their confirmation above.
  // The completion message (sent when AI finishes) is in reportService.ts → extractAndSaveReport
  extractAndSaveReport(uid, sender, uploaded).catch((err) => {
    console.error("[documentHandler] Background extraction error:", err);
  });
}
