import "./env";
import fs from "fs";
import path from "path";
import webpush from "web-push";
import type { VapidKeys } from "web-push";

// VAPID keys can be provided via env vars (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
// or are auto-generated once and persisted to `.vapid-keys.json` (gitignored).
const KEYS_FILE = path.resolve(process.cwd(), ".vapid-keys.json");

let cached: VapidKeys | null = null;

function loadOrCreateKeys(): VapidKeys {
  if (cached) return cached;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
    return cached;
  }

  if (fs.existsSync(KEYS_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
      if (stored && stored.publicKey && stored.privateKey) {
        cached = { publicKey: stored.publicKey, privateKey: stored.privateKey };
        return cached;
      }
    } catch (e) {
      console.warn("[vapid] Could not read existing VAPID keys:", e);
    }
  }

  const keys = webpush.generateVAPIDKeys();
  cached = keys;
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  } catch (e) {
    console.warn("[vapid] Could not persist generated VAPID keys:", e);
  }
  return keys;
}

export function getVapidKeys(): VapidKeys {
  return loadOrCreateKeys();
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT || "mailto:sparsh@bluepin.in";
}