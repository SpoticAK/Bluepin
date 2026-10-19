import { defineConfig } from "vitest/config";

// Dedicated config for Firestore rules tests: the main config excludes
// tests/** from the default run (they need a live emulator), and CLI file
// filters cannot override that exclusion — so rules get their own entry.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
