import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";
import { extractLabReportFromUrl } from "../../labReportServiceDirect";
import {
  sendWhatsAppMessage,
  sendWhatsAppCtaUrl,
  downloadWhatsAppMedia,
} from "../client";
import { createWhatsAppMagicLoginUrl } from "../auth";
import {
  getStorageBucket,
  getFormattedUserTime,
  formatKeyBiomarkersSummary,
  checkReportLimits,
} from "../utils";

/**
 * Handles incoming PDF or document medical reports.
 */
export async function handleDocumentReport(
  uid: string,
  senderPhone: string,
  docObj: any,
): Promise<void> {
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

/**
 * Uploads report buffer to Firebase Storage, extracts biomarkers using Gemini, and saves to Firestore.
 */
export async function processMedicalReportBuffer(
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
    const limitCheck = await checkReportLimits(uid, now);
    if (!limitCheck.allowed) {
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
