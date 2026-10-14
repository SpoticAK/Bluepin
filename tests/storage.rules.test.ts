/**
 * Storage security-rules tests. Require a Storage emulator:
 *
 *   npx firebase-tools emulators:start --only storage --project demo-rules
 *
 * then `npm run test:rules` (runs every file under tests/). Never run
 * against a real project.
 */
import fs from "fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

const PROJECT_ID = "demo-rules";
const HOST = "127.0.0.1";
const PORT = Number(process.env.STORAGE_EMULATOR_PORT ?? 9199);
const BYTES = new Uint8Array([1, 2, 3, 4]);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      host: HOST,
      port: PORT,
      rules: fs.readFileSync("storage.rules", "utf8"),
    },
  });
}, 120_000);

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("users/{userId}/{allPaths=**}", () => {
  it("lets owners read and write their own prefix", async () => {
    const storage = testEnv.authenticatedContext("u1").storage();
    const file = ref(storage, "users/u1/report.pdf");
    await assertSucceeds(uploadBytes(file, BYTES));
    await assertSucceeds(getDownloadURL(file));
    await assertSucceeds(uploadBytes(ref(storage, "users/u1/nested/deep/x.png"), BYTES));
  });

  it("denies other users and anonymous callers", async () => {
    const stranger = testEnv.authenticatedContext("u2").storage();
    const anon = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(stranger, "users/u1/report.pdf"), BYTES));
    await assertFails(getDownloadURL(ref(stranger, "users/u1/report.pdf")));
    await assertFails(uploadBytes(ref(anon, "users/u1/report.pdf"), BYTES));
  });
});
