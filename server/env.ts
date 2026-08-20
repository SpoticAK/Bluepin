// server/env.ts
// Automatically load .env file into process.env if present
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile();
  } catch {
    // .env file not present or already loaded, fail silently
  }
}
