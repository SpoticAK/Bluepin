import {
  downloadMediaFromMeta,
  MAX_FILE_BYTES,
  MediaTooLargeError,
  type MediaHint,
} from "../wa-client/media";
import { getUidByPhone } from "../services/glucoseService";
import {
  checkDailyReportLimit,
  uploadReportToStorage,
  extractAndSaveReport,
} from "../services/reportService";
import { sendTextMessage, sendInvalidReportMessage } from "../wa-client";

/**
 * Handles an incoming PDF or image medical report sent via WhatsApp.
 *
 * Phase 1 (sync, fast): auth check → limit check → "Got it" reply → download → upload to Storage
 * Phase 2 (fire-and-forget): AI extraction → Firestore write → CTA sent to user
 */
export async function handleMedicalDocUpload(
  sender: string,
  mediaId: string,
  fileName: string,
  fileSize: number | undefined,
  mimeType: string,
  messageId: string,
  mediaHint?: MediaHint,
): Promise<void> {
  // ── Guard: linked Bluepin account ───────────────────────────────────────────
  const uid = await getUidByPhone(sender);
  if (!uid) {
    await sendTextMessage(
      sender,
      "I received your document, but your WhatsApp is not linked to a Bluepin account yet.\n\n" +
        "Open the Bluepin app to link your number, then try again.",
    );
    return;
  }

  // ── Guard: file size ─────────────────────────────────────────────────────────
  if (fileSize && fileSize > MAX_FILE_BYTES) {
    await sendInvalidReportMessage(sender, messageId);
    return;
  }

  // ── Guard: daily limit (fast Firestore read) ─────────────────────────────────
  const allowed = await checkDailyReportLimit(uid);
  if (!allowed) {
    await sendTextMessage(
      sender,
      "You have reached the maximum allowed limit for medical report uploads today.",
    );
    return;
  }

  // ── Respond immediately — before the slow download ─────────────────────────
  await sendTextMessage(
    sender,
    "Got it! Your health report has been received.\n\n" +
      "I am analyzing it in the background. I will send you a notification once it is ready — " +
      "this usually takes 2-3 minutes.",
  );

  // ── Phase 1: Download from Meta (uses new wa-client/media.ts) ────────────────
  let buffer: Buffer;
  let resolvedMimeType: string;
  try {
    ({ buffer, mimeType: resolvedMimeType } =
      await downloadMediaFromMeta(mediaId, mediaHint));
  } catch (err) {
    console.error("[documentHandler] Download failed:", err);
    if (err instanceof MediaTooLargeError) {
      await sendInvalidReportMessage(sender, messageId);
      return;
    }
    await sendTextMessage(
      sender,
      "I could not download your file. Please try sending it again.",
    );
    return;
  }

  // ── Phase 1: Upload to Firebase Storage (uses new storageService.ts) ─────────
  const uploaded = await uploadReportToStorage(
    uid,
    buffer,
    resolvedMimeType,
    fileName ?? "Lab_Report.pdf",
  );

  // ── Phase 2: AI extraction + Firestore write + CTA (background) ────────────
  extractAndSaveReport(uid, sender, uploaded, messageId).catch((err) => {
    console.error("[documentHandler] Background extraction error:", err);
  });
}
