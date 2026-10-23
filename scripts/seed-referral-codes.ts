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
 *
 * Re-running is safe: existing counters (totalSignups / qualifiedSignups /
 * totalScore), createdAt, and isActive are left untouched so a follow-up
 * import never wipes the leaderboard or silently re-enables paused codes.
 */
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { getAdminFirestore } from "../server/firebase";

interface ApplicantRow {
  code: string;
  applicantName: string;
  applicantEmail?: string;
}

const CODE_PATTERN = /^[A-Z0-9_-]{2,30}$/;

function parseCsv(content: string): ApplicantRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: (header: string[]) =>
        header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    throw new Error(
      `Could not parse CSV: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (records.length === 0) return [];

  const keys = Object.keys(records[0]);
  const codeKey = keys.find((k) => k.includes("code"));
  const nameKey = keys.find((k) => k.includes("name"));
  const emailKey = keys.find((k) => k.includes("email"));

  if (!codeKey || !nameKey) {
    throw new Error(
      'CSV must contain at least "code" and "applicantName" (or "name") headers.',
    );
  }

  const byCode = new Map<string, ApplicantRow>();

  for (const record of records) {
    const code = String(record[codeKey] ?? "").trim().toUpperCase();
    const applicantName = String(record[nameKey] ?? "").trim();
    const applicantEmail = emailKey
      ? String(record[emailKey] ?? "").trim().toLowerCase()
      : "";

    if (!code || !applicantName) continue;

    if (!CODE_PATTERN.test(code)) {
      console.warn(
        `⚠️  Skipping "${code}" for "${applicantName}": codes must be 2-30 characters (A-Z, 0-9, _, -).`,
      );
      continue;
    }

    if (byCode.has(code)) {
      console.warn(
        `⚠️  Duplicate code "${code}" found; keeping the last row.`,
      );
    }

    byCode.set(code, {
      code,
      applicantName,
      ...(applicantEmail ? { applicantEmail } : {}),
    });
  }

  return [...byCode.values()];
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

  // Find which codes already exist so we can avoid overwriting counters.
  const existingCodes = new Set<string>();
  const refs = applicants.map((item) => db.doc(`referral_codes/${item.code}`));

  for (let i = 0; i < refs.length; i += 300) {
    const chunk = refs.slice(i, i + 300);
    const snaps = await db.getAll(...chunk);
    for (const snap of snaps) {
      if (snap.exists) existingCodes.add(snap.id);
    }
  }

  let batch = db.batch();
  let batchOps = 0;
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of applicants) {
    const docRef = db.doc(`referral_codes/${item.code}`);

    if (existingCodes.has(item.code)) {
      // Metadata-only merge. Counters, isActive, and createdAt are untouched.
      batch.set(
        docRef,
        {
          code: item.code,
          applicantName: item.applicantName,
          ...(item.applicantEmail
            ? { applicantEmail: item.applicantEmail }
            : {}),
        },
        { merge: true },
      );
      updatedCount++;
    } else {
      batch.set(docRef, {
        code: item.code,
        applicantName: item.applicantName,
        applicantEmail: item.applicantEmail || null,
        createdAt: Date.now(),
        createdBy: "import-script",
        isActive: true,
        totalSignups: 0,
        qualifiedSignups: 0,
        totalScore: 0,
      });
      createdCount++;
    }

    batchOps++;

    if (batchOps >= 400) {
      await batch.commit();
      console.log(`  Committed batch (${createdCount + updatedCount}/${applicants.length})...`);
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log(
    `\n✅ Seeded ${applicants.length} codes (${createdCount} created, ${updatedCount} updated without touching counters).\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
  });
