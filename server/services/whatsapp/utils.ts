import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "../../firebase";
import { BiomarkerItem } from "./types";

export const getStorageBucket = () =>
  getStorage().bucket(
    process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      "myhealthyfam-28c2c.firebasestorage.app",
  );

export const getUtcDay = (d = new Date()) => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
  day: d.getUTCDate(),
});

/**
 * Resolves local date and time strings (YYYY-MM-DD, HH:mm) based on user's phone country code.
 */
export function getFormattedUserTime(
  senderPhone: string,
  dateObj = new Date(),
): { dateStr: string; timeStr: string } {
  let timeZone = "Asia/Kolkata";
  if (senderPhone.startsWith("1")) timeZone = "America/New_York";
  else if (senderPhone.startsWith("44")) timeZone = "Europe/London";
  else if (senderPhone.startsWith("971")) timeZone = "Asia/Dubai";
  else if (senderPhone.startsWith("65")) timeZone = "Asia/Singapore";
  else if (senderPhone.startsWith("61")) timeZone = "Australia/Sydney";
  if (process.env.APP_TIMEZONE) timeZone = process.env.APP_TIMEZONE;

  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    dateObj,
  ); // YYYY-MM-DD
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj); // HH:mm

  return { dateStr, timeStr };
}

export function getBiomarkerDisplayStatus(bm: BiomarkerItem): {
  label: string;
  icon: string;
} {
  const s = String(bm.status || "")
    .toLowerCase()
    .trim();
  const raw = String(bm.rawValue || "")
    .toLowerCase()
    .trim();

  if (
    s === "normal" ||
    s === "healthy" ||
    raw === "absent" ||
    raw === "nil" ||
    raw === "negative" ||
    raw === "clear"
  ) {
    return { label: "Normal", icon: "🟢" };
  }
  if (s === "borderline" || raw.includes("trace")) {
    return { label: "Borderline", icon: "🟡" };
  }
  if (
    s === "high" ||
    s === "low" ||
    s.includes("attention") ||
    raw === "positive" ||
    raw === "present" ||
    raw === "reactive"
  ) {
    return { label: s ? s.toUpperCase() : "Out of Range", icon: "🔴" };
  }
  return { label: "Recorded", icon: "⚪" };
}

export function formatKeyBiomarkersSummary(biomarkers: BiomarkerItem[]): string {
  if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
    return "• No specific biomarkers listed.";
  }

  // Filter out non-actionable physical specimen metadata if more specific clinical markers exist
  const isPhysicalAttribute = (name: string) =>
    /^(?:physical\s*appearance|colour|color|transparency|appearance|specimen|quantity|sample\s*type|volume)$/i.test(
      name.trim(),
    );

  const clinicalMarkers = biomarkers.filter(
    (b) => !isPhysicalAttribute(b.name || ""),
  );
  const pool = clinicalMarkers.length >= 3 ? clinicalMarkers : biomarkers;

  // Sort to surface abnormal / needs attention markers first
  const sorted = [...pool].sort((a, b) => {
    const statusA = getBiomarkerDisplayStatus(a).icon;
    const statusB = getBiomarkerDisplayStatus(b).icon;
    const scoreA = statusA === "🔴" ? 2 : statusA === "🟡" ? 1 : 0;
    const scoreB = statusB === "🔴" ? 2 : statusB === "🟡" ? 1 : 0;
    return scoreB - scoreA;
  });

  return sorted
    .slice(0, 5)
    .map((bm: BiomarkerItem) => {
      const { icon } = getBiomarkerDisplayStatus(bm);
      const displayVal =
        bm.value !== null && bm.value !== undefined && !isNaN(Number(bm.value))
          ? bm.value
          : bm.rawValue || "Recorded";
      const unitStr = bm.unit && bm.unit.trim() ? ` ${bm.unit.trim()}` : "";
      return `• ${bm.name}: *${displayVal}${unitStr}* ${icon}`;
    })
    .join("\n");
}

/**
 * Checks and computes daily limits for glucose reading logging.
 */
export async function checkGlucoseDailyLimit(
  uid: string,
  now = new Date(),
): Promise<{
  allowed: boolean;
  limitsRef: FirebaseFirestore.DocumentReference;
  limitUpdate: { gYear: number; gMonth: number; gDay: number; gCount: number };
}> {
  const db = getAdminFirestore();
  const limitsRef = db.doc(`users/${uid}/stats/limits`);
  const limitsSnap = await limitsRef.get();
  const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

  const { year, month, day } = getUtcDay(now);
  const isNewDay =
    limitsData.gYear !== year ||
    limitsData.gMonth !== month ||
    limitsData.gDay !== day;
  const gCount = isNewDay ? 1 : (limitsData.gCount || 0) + 1;

  return {
    allowed: gCount <= 10,
    limitsRef,
    limitUpdate: { gYear: year, gMonth: month, gDay: day, gCount },
  };
}

/**
 * Checks and computes daily and total limits for medical reports.
 */
export async function checkReportLimits(
  uid: string,
  now = new Date(),
): Promise<{
  allowed: boolean;
  limitsRef: FirebaseFirestore.DocumentReference;
  limitUpdate: {
    rYear: number;
    rMonth: number;
    rDay: number;
    rCount: number;
    rTotal: number;
  };
}> {
  const db = getAdminFirestore();
  const limitsRef = db.doc(`users/${uid}/stats/limits`);
  const limitsSnap = await limitsRef.get();
  const limitsData = limitsSnap.exists ? limitsSnap.data()! : {};

  const { year, month, day } = getUtcDay(now);
  const isNewDay =
    limitsData.rYear !== year ||
    limitsData.rMonth !== month ||
    limitsData.rDay !== day;
  const rCount = isNewDay ? 1 : (limitsData.rCount || 0) + 1;
  const rTotal = (limitsData.rTotal || 0) + 1;

  return {
    allowed: rCount <= 20 && rTotal <= 100,
    limitsRef,
    limitUpdate: { rYear: year, rMonth: month, rDay: day, rCount, rTotal },
  };
}
