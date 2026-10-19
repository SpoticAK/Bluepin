/**
 * Firestore security-rules tests. Require emulators:
 *
 *   npx firebase-tools emulators:start --only firestore,storage --project demo-rules
 *
 * then `npm run test:rules` (runs every file under tests/). Never run
 * against a real project — the suites wipe their corners of the database.
 */
import fs from "fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-rules";
const HOST = "127.0.0.1";
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);

let testEnv: RulesTestEnvironment;

function utcToday() {
  const d = new Date();
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: HOST,
      port: PORT,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
}, 120_000);

afterAll(async () => {
  await testEnv?.cleanup();
});

async function seedAdmin(data: Record<string, Record<string, unknown>>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, docData] of Object.entries(data)) {
      await setDoc(doc(db, path), docData);
    }
  });
}

describe("catch-all deny", () => {
  it("rejects reads and writes to unknown collections, even signed in", async () => {
    const db = testEnv.authenticatedContext("u1").firestore();
    await assertFails(getDoc(doc(db, "nope/doc")));
    await assertFails(setDoc(doc(db, "nope/doc"), { a: 1 }));
  });
});

describe("users/{userId} isolation", () => {
  it("lets owners read/write their own profile, blocks everyone else", async () => {
    await seedAdmin({ "users/u1": { name: "U1" } });
    const owner = testEnv.authenticatedContext("u1").firestore();
    const stranger = testEnv.authenticatedContext("u2").firestore();
    const anon = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(owner, "users/u1")));
    await assertSucceeds(setDoc(doc(owner, "users/u1"), { name: "U1-updated" }));
    await assertFails(getDoc(doc(stranger, "users/u1")));
    await assertFails(getDoc(doc(anon, "users/u1")));
    await assertFails(getDocs(collection(stranger, "users")));
  });

  it("lets family members read each other's subcollections, not write them", async () => {
    await seedAdmin({
      "users/u1": { familyId: "f1" },
      "users/u2": { familyId: "f1" },
      "users/u3": {},
      "users/u1/glucoseReadings/r1": { value: 120 },
    });
    const kin = testEnv.authenticatedContext("u2").firestore();
    const outsider = testEnv.authenticatedContext("u3").firestore();

    await assertSucceeds(getDoc(doc(kin, "users/u1/glucoseReadings/r1")));
    await assertFails(getDoc(doc(outsider, "users/u1/glucoseReadings/r1")));
    await assertFails(setDoc(doc(kin, "users/u1/glucoseReadings/r2"), { value: 130 }));
  });
});

describe("feedbacks", () => {
  it("allows public create, forbids update/delete, restricts reads to the admin", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    const admin = testEnv.authenticatedContext("admin", { email: "sparsh@bluepin.in" }).firestore();
    const user = testEnv.authenticatedContext("u1", { email: "u1@x.y" }).firestore();

    const ref = await assertSucceeds(addDoc(collection(anon, "feedbacks"), { message: "hi" }));
    await assertFails(getDoc(doc(anon, `feedbacks/${ref.id}`)));
    await assertFails(getDoc(doc(user, `feedbacks/${ref.id}`)));
    await assertSucceeds(getDoc(doc(admin, `feedbacks/${ref.id}`)));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      const snap = await getDoc(doc(adminDb, `feedbacks/${ref.id}`));
      expect(snap.exists()).toBe(true);
    });
  });
});

describe("limits-coupled writes", () => {
  it("allows the first glucose reading of the day with matching limits", async () => {
    const t = utcToday();
    await seedAdmin({
      "users/u1": { name: "U1" },
      "users/u1/stats/limits": { gYear: t.y, gMonth: t.m, gDay: t.day, gCount: 0 },
    });
    const owner = testEnv.authenticatedContext("u1").firestore();
    // Limits doc and reading must advance together in one batch.
    const batch = writeBatch(owner);
    batch.set(doc(owner, "users/u1/stats/limits"), {
      gYear: t.y,
      gMonth: t.m,
      gDay: t.day,
      gCount: 1,
    });
    batch.set(doc(owner, "users/u1/glucoseReadings/r1"), { value: 120 });
    await assertSucceeds(batch.commit());
  });

  it("rejects a reading that skips the limits increment", async () => {
    const t = utcToday();
    await seedAdmin({
      "users/u2": { name: "U2" },
      "users/u2/stats/limits": { gYear: t.y, gMonth: t.m, gDay: t.day, gCount: 3 },
    });
    const owner = testEnv.authenticatedContext("u2").firestore();
    await assertFails(setDoc(doc(owner, "users/u2/glucoseReadings/r1"), { value: 120 }));
  });
});
