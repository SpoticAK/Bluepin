import { defineConfig } from "@playwright/test";

/**
 * E2E against the preview backend (bluepin-f8a09) — never prod.
 * Credentials come from the environment (local shell or GitHub `preview`
 * environment secrets); they are never committed. The account itself was
 * created once via the preview signup UI and onboarded:
 *   E2E_TEST_EMAIL=e2e-test@bluepin.in
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: "line",
  use: {
    baseURL: "https://bluepin-f8a09--bluepin-f8a09.us-east4.hosted.app",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  timeout: 90_000,
  expect: { timeout: 15_000 },
});
