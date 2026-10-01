import { getStorage } from "firebase-admin/storage";

const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "";

/**
 * Uploads a Buffer to Firebase Storage and returns a permanent public download URL.
 * Uses the Firebase Admin SDK directly — no dependency on legacy Bluepin code.
 */
export async function uploadBufferToStorage(
  uid: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  reportId: string,
): Promise<string> {
  console.log(`[storage] Uploading ${buffer.length} bytes to Firebase Storage for user ${uid}`);
  const t0 = Date.now();

  const bucket = getStorage().bucket(STORAGE_BUCKET);
  const ext = mimeType.includes("pdf") ? "pdf" : "jpg";
  const safeName = fileName.replace(/[^a-zA-Z0-9]/g, "_");
  const storagePath = `users/${uid}/labReports/${reportId}_${safeName}.${ext}`;

  const file = bucket.file(storagePath);
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

  console.log(`[storage] Upload OK in ${Date.now() - t0}ms. Path: ${storagePath}`);
  return fileUrl;
}
