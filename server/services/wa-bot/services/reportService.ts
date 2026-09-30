import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";
import {
  getStorageBucket,
  getFormattedUserTime,
  checkReportLimits,
} from "../../whatsapp/utils";
import { extractLabReportFromUrl } from "../../labReportServiceDirect";
import {
  sendReportAcceptedCta,
  sendInvalidReportMessage,
} from "../wa-client";
import { createWhatsAppMagicLoginUrl } from "../../whatsapp/auth";

export type UploadedReport = {
  reportId: string;
  fileUrl: string;
  reportName: string;
  reportDate: string;
  resolvedMimeType: string;
  limitCheck: Awaited<ReturnType<typeof checkReportLimits>>;
};

/**
 * Phase 1 — Fast path (~1-2s after download).
 *
 * Checks limits, uploads the raw buffer to Firebase Storage, and returns
 * the metadata needed for Phase 2. Does NOT call any AI.
 *
 * Returns null if the report limit has been reached (caller should notify user).
 */
export async function uploadReportToStorage(
  uid: string,
  senderPhone: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string,
): Promise<UploadedReport | null> {
  const now = new Date();
  const limitCheck = await checkReportLimits(uid, now);

  if (!limitCheck.allowed) return null;

  const reportId = crypto.randomUUID();
  const { dateStr: reportDate } = getFormattedUserTime(senderPhone, now);
  const reportName = originalFileName.replace(/\.[^/.]+$/, "") || "Lab Report";

  const bucket = getStorageBucket();
  const downloadToken = crypto.randomUUID();
  const ext = mimeType.includes("pdf") ? "pdf" : "jpg";
  const safeName = reportName.replace(/[^a-zA-Z0-9]/g, "_");
  const storagePath = `users/${uid}/labReports/${reportId}_${safeName}.${ext}`;
  const storageFile = bucket.file(storagePath);

  await storageFile.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const fileUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(storageFile.name)}?alt=media&token=${downloadToken}`;

  return { reportId, fileUrl, reportName, reportDate, resolvedMimeType: mimeType, limitCheck };
}

/**
 * Phase 2 — Background (15-30s, fire-and-forget).
 *
 * Calls Gemini to extract biomarkers from the already-uploaded file URL,
 * writes everything to Firestore in a batch, then sends a CTA completion message.
 *
 * Intentionally standalone — no await needed from the caller.
 */
export async function extractAndSaveReport(
  uid: string,
  senderPhone: string,
  uploaded: UploadedReport,
): Promise<void> {
  const { reportId, fileUrl, reportName, reportDate, resolvedMimeType, limitCheck } = uploaded;
  const db = getAdminFirestore();

  try {
    const result = await extractLabReportFromUrl(fileUrl, resolvedMimeType);

    if (!result.success || !Array.isArray(result.biomarkers) || result.biomarkers.length === 0) {
      await sendInvalidReportMessage(senderPhone);
      return;
    }

    const batch = db.batch();

    // Commit the daily limit counter now that extraction succeeded
    batch.set(limitCheck.limitsRef, limitCheck.limitUpdate, { merge: true });

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
      batch.set(db.doc(`users/${uid}/biomarkers/${reportId}_${safeId}`), {
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

    // Completion CTA — this is the message the user sees when processing is done
    const magicUrl = await createWhatsAppMagicLoginUrl(uid);
    await sendReportAcceptedCta(senderPhone, magicUrl);
  } catch (err) {
    console.error("[reportService] Background extraction failed:", err);
    await sendInvalidReportMessage(senderPhone).catch(() => {});
  }
}
