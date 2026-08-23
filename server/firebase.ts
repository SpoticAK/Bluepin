import "./env";
import path from "path";
import fs from "fs";
import express from "express";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase Admin
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;

if (!getApps().length) {
  let adminConfig: any = {
    projectId: firebaseProjectId,
  };
  const serviceAccountPath = path.resolve(process.cwd(), 'firebase-adminsdk.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminConfig.credential = cert(serviceAccount);
    } catch (e) {
      console.warn("Could not load service account from firebase-adminsdk.json:", e);
    }
  }
  initializeApp(adminConfig);
}

export const getAdminAuth = () => getAuth();
const firestoreDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const getAdminFirestore = () => getFirestore(firestoreDatabaseId);

// Authentication Middleware
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error.message || "Unknown error");
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
