import "./env";
import { z } from "zod";

/**
 * Central environment configuration (Phase 2: env separation).
 *
 * Precedence (highest wins): real process env (App Hosting / Secret Manager /
 * CI) > `.env` file (local dev base) > safe defaults below. Node's
 * `process.loadEnvFile()` never overrides real env vars, so deploying with
 * per-environment values in App Hosting is enough — no per-env files needed.
 *
 * Dangerous misconfigurations throw at boot. Missing optional integration
 * keys only warn — every consumer already degrades gracefully (see mailer,
 * gemini, whatsapp client). Strict required-keys arrive with Phase 4 CI.
 */

const RawEnvSchema = z.object({
  ENV_NAME: z.enum(["development", "preview", "production"]).default("development"),
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(3000),

  APP_URL: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),

  // WhatsApp. Mode defaults to "live" in production, "test" elsewhere.
  // Explicitly setting live outside production is a boot error — this is the
  // guard that stops preview from ever sending via the prod sender (Meta also
  // enforces this server-side: a test-sender token cannot send as the prod
  // number, but defense in depth is cheap).
  WHATSAPP_MODE: z.enum(["test", "live"]).optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

type RawEnv = z.infer<typeof RawEnvSchema>;

function load() {
  const parsed = RawEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `[config] Invalid environment: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}. See docs/ENVIRONMENTS.md.`,
    );
  }
  const raw: RawEnv = parsed.data;
  const envName = raw.ENV_NAME;
  const whatsappMode = raw.WHATSAPP_MODE ?? (envName === "production" ? "live" : "test");

  if (envName !== "production" && whatsappMode === "live") {
    throw new Error(
      `[config] WHATSAPP_MODE=live is forbidden when ENV_NAME=${envName}. ` +
        `Preview/development must use the Meta test sender (WHATSAPP_MODE=test).`,
    );
  }

  // Warn (don't throw) for missing integration keys so local dev and gradual
  // rollout keep working. Each warning names the affected feature.
  const warn = (cond: boolean, msg: string) => {
    if (cond) console.warn(`[config] WARNING: ${msg}`);
  };
  warn(!raw.GEMINI_API_KEY, "GEMINI_API_KEY unset — AI report/glucose extraction will fail.");
  warn(!raw.WHATSAPP_TOKEN, "WHATSAPP_TOKEN unset — WhatsApp sending disabled.");
  warn(!raw.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID unset — WhatsApp sending disabled.");
  warn(
    !raw.WHATSAPP_VERIFY_TOKEN && envName === "production",
    "WHATSAPP_VERIFY_TOKEN unset in production — webhook verification will reject everything.",
  );
  warn(
    raw.CRON_SECRET === undefined || raw.CRON_SECRET === "default_cron_secret",
    "CRON_SECRET unset or default — cron endpoint is unauthenticated. Set a real secret.",
  );
  warn(
    envName === "production" && !raw.APP_URL && !raw.FRONTEND_URL,
    "APP_URL unset in production — magic links and WhatsApp CTAs fall back to https://app.bluepin.in.",
  );

  return {
    envName,
    isDevelopment: envName === "development",
    isPreview: envName === "preview",
    isProduction: envName === "production",
    port: raw.PORT,
    appUrl: (raw.APP_URL || raw.FRONTEND_URL || "https://app.bluepin.in").replace(/\/$/, ""),
    appTimezone: raw.APP_TIMEZONE,
    whatsapp: {
      mode: whatsappMode,
      token: raw.WHATSAPP_TOKEN,
      phoneNumberId: raw.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: raw.WHATSAPP_VERIFY_TOKEN,
      appSecret: raw.WHATSAPP_APP_SECRET,
    },
    geminiApiKey: raw.GEMINI_API_KEY,
    cronSecret: raw.CRON_SECRET || "default_cron_secret",
  };
}

export type AppConfig = ReturnType<typeof load>;

export const config: AppConfig = load();
