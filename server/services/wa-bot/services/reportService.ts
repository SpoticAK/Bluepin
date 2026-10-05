import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../../firebase";
import { uploadBufferToStorage } from "./storageService";
import { extractLabReportFromUrl } from "../../labReportServiceDirect";
import {
  sendReportAcceptedCta,
  sendInvalidReportMessage,
} from "../wa-client";
import { createWhatsAppMagicLoginUrl } from "./magicLink";

const DAILY_REPORT_LIMIT = 3;

// ── Limit checking (self-contained, no old wa-bot deps) ─────────────────────

async function getTodayDateStr(): Promise<string> {
  return new Date().toISOString().split("T")[0];
}

/**
 * Checks if the user is still under their daily report upload limit.
 * Uses a simple counter document under the user's Firestore profile.
 */
export async function checkDailyReportLimit(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const today = await getTodayDateStr();
  const snap = await db.doc(`users/${uid}/botLimits/reports`).get();

  if (!snap.exists) return true;

  const data = snap.data()!;
  if (data.date !== today) return true; // New day, counter reset

  return (data.count ?? 0) < DAILY_REPORT_LIMIT;
}

/**
 * Increments the daily report counter. Called ONLY after successful AI extraction.
 */
async function incrementReportCount(uid: string): Promise<void> {
  const db = getAdminFirestore();
  const today = await getTodayDateStr();
  const ref = db.doc(`users/${uid}/botLimits/reports`);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.date !== today) {
    await ref.set({ date: today, count: 1 });
  } else {
    await ref.update({ count: FieldValue.increment(1) });
  }
}

// ── Phase 1: Upload ─────────────────────────────────────────────────────────

export type UploadedReport = {
  reportId: string;
  fileUrl: string;
  reportName: string;
  reportDate: string;
  resolvedMimeType: string;
};

/**
 * Phase 1 — Fast path.
 * Saves the raw PDF Buffer to Firebase Storage and returns the metadata
 * needed for Phase 2. Does NOT call any AI.
 */
export async function uploadReportToStorage(
  uid: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string,
): Promise<UploadedReport> {
  const reportId = crypto.randomUUID();
  const reportDate = new Date().toISOString().split("T")[0];
  const reportName = originalFileName.replace(/\.[^/.]+$/, "") || "Lab Report";

  const fileUrl = await uploadBufferToStorage(uid, buffer, reportName, mimeType, reportId);

  return { reportId, fileUrl, reportName, reportDate, resolvedMimeType: mimeType };
}

// ── Phase 2: AI Extract + Save ──────────────────────────────────────────────

/**
 * Phase 2 — Background async.
 * Sends the Firebase Storage URL to Gemini, extracts biomarkers, saves to Firestore,
 * increments the daily limit, and notifies the user.
 */
export async function extractAndSaveReport(
  uid: string,
  senderPhone: string,
  uploaded: UploadedReport,
  messageId?: string,
): Promise<void> {
  const { reportId, fileUrl, reportName, reportDate, resolvedMimeType } = uploaded;
  const db = getAdminFirestore();

  try {
    console.log(`[reportService] Starting AI extraction for report ${reportId}`);
    const result = await extractLabReportFromUrl(fileUrl, resolvedMimeType);

    if (!result.success || !Array.isArray(result.biomarkers) || result.biomarkers.length === 0) {
      console.warn(`[reportService] AI extraction returned no biomarkers for ${reportId}`);
      await sendInvalidReportMessage(senderPhone, messageId);
      return;
    }

    console.log(`[reportService] AI extracted ${result.biomarkers.length} biomarkers for ${reportId}. Writing to Firestore...`);
    const batch = db.batch();

    // Commit report doc
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

    // Commit individual biomarker docs
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

    // Increment daily limit counter ONLY after successful save
    await incrementReportCount(uid);

    // Send success CTA to user
    const magicUrl = await createWhatsAppMagicLoginUrl(uid);
    await sendReportAcceptedCta(senderPhone, magicUrl, messageId);

    console.log(`[reportService] Report ${reportId} saved and user notified.`);
  } catch (err) {
    console.error(`[reportService] Background extraction failed for ${reportId}:`, err);
    await sendInvalidReportMessage(senderPhone, messageId).catch(() => {});
  }
}
