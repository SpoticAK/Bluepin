/**
 * Bulk Referral Code Seeder Script
 *
 * Usage:
 *   npx tsx scripts/seed-referral-codes.ts [path-to-csv]
 *
 * Expected CSV columns (header row required):
 *   code,applicantName,applicantEmail
 * Example:
 *   PRIYA2024,Priya Sharma,priya@example.com
 *   RAHUL2024,Rahul Mehta,rahul@example.com
 */
import fs from "fs";
import path from "path";
import { getAdminFirestore } from "../server/firebase";

function parseCsv(content: string): Array<{ code: string; applicantName: string; applicantEmail?: string }> {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());

  const codeIdx = headers.findIndex((h) => h.includes("code"));
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const emailIdx = headers.findIndex((h) => h.includes("email"));

  if (codeIdx === -1 || nameIdx === -1) {
    throw new Error('CSV must contain at least "code" and "applicantName" (or "name") headers.');
  }

  const results: Array<{ code: string; applicantName: string; applicantEmail?: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
    const code = rawCols[codeIdx]?.toUpperCase();
    const applicantName = rawCols[nameIdx];
    const applicantEmail = emailIdx !== -1 ? rawCols[emailIdx] : undefined;

    if (code && applicantName) {
      results.push({
        code,
        applicantName,
        applicantEmail: applicantEmail || undefined,
      });
    }
  }

  return results;
}

async function main() {
  const targetFile = process.argv[2] || "applicants.csv";
  const resolvedPath = path.resolve(process.cwd(), targetFile);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`\n❌ Error: File not found at ${resolvedPath}`);
    console.log(`\nUsage:\n  npx tsx scripts/seed-referral-codes.ts <path-to-csv>\n`);
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(resolvedPath, "utf8");
  const applicants = parseCsv(rawCsv);

  if (applicants.length === 0) {
    console.log("No valid applicant rows found in CSV.");
    return;
  }

  console.log(`\nFound ${applicants.length} applicant codes to seed. Writing to Firestore...`);

  const db = getAdminFirestore();
  let batch = db.batch();
  let count = 0;
  let batchOps = 0;

  for (const item of applicants) {
    const cleanCode = item.code.trim().toUpperCase();
    const docRef = db.doc(`referral_codes/${cleanCode}`);

    // Set with merge: true ensures we never overwrite existing counters if re-run!
    batch.set(
      docRef,
      {
        code: cleanCode,
        applicantName: item.applicantName,
        applicantEmail: item.applicantEmail || null,
        createdAt: Date.now(),
        createdBy: "import-script",
        isActive: true,
        totalSignups: 0,
        qualifiedSignups: 0,
        totalScore: 0,
      },
      { merge: true },
    );

    count++;
    batchOps++;

    if (batchOps >= 400) {
      await batch.commit();
      console.log(`  Committed batch (${count}/${applicants.length})...`);
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Successfully seeded ${count} referral codes into Firestore!\n`);
}

main().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
