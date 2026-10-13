# Environments & Secrets

Target topology (agreed 2026-10-13): **two Firebase projects**.

| Concern | Development / Preview | Production |
|---|---|---|
| Firebase project | NEW second project (dev/preview) | Existing project (prod data) |
| App Hosting instance | Preview backend | Prod backend |
| `apphosting.*.yaml` | `apphosting.preview.yaml` | `apphosting.yaml` base + prod overrides |
| Local env file | `.env.development` / `.env.preview` | `.env.production` (deploy-time only, never committed) |
| `ENV_NAME` | `development` / `preview` | `production` |
| `APP_URL` / `FRONTEND_URL` | Preview Hosting URL | `https://app.bluepin.in` |
| WhatsApp sender | Meta **test number**, preview webhook URL, preview `WHATSAPP_VERIFY_TOKEN` | Prod number, prod webhook URL, prod verify token |
| `WHATSAPP_MODE` | `test` | `live` (guard: preview code must refuse prod `PHONE_NUMBER_ID`) |
| `WHATSAPP_TOKEN` / `PHONE_NUMBER_ID` / `APP_SECRET` | Test-sender credentials | Prod credentials (Secret Manager / GitHub `production` env) |
| `GEMINI_API_KEY` | Separate key or quota project | Prod key |
| `SMTP_*` | Mailtrap / separate sender | Prod sender |
| `CRON_SECRET` | Preview value | Prod value (must differ) |
| `FIREBASE_STORAGE_BUCKET` | Dev project bucket | Prod bucket |
| Firestore writes | Dev project (full isolation) | Prod project |

## Rules

1. `.env*` (except `.env.example`) are gitignored and never committed. Secrets live in Secret Manager + GitHub Environments.
2. `apphosting.yaml` holds non-secret defaults safe for all envs; per-env overrides in `apphosting.preview.yaml` (etc.).
   Firebase console values take precedence over yaml; yaml takes precedence over dotenv files.
3. `server/config.ts` (Phase 2) validates required keys at boot and fails fast with a named-key error.
4. Until the second project exists: namespace inside the single project (separate `APP_URL`, separate
   verify token/app secret, Storage prefix, `env` field on test writes) — and treat every preview run as suspect.

## Key inventory (from `.env.example` + code grep, names only — no values)

`VITE_FIREBASE_*`, `GEMINI_API_KEY`, `VITE_RECAPTCHA_SITE_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM_EMAIL`,
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WABA_ID`, `META_BASE_URL`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_BUSINESS_PHONE`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_OTP_TEMPLATE_NAME`,
`OTP_SECRET`, `APP_URL`/`FRONTEND_URL`, `WHATSAPP_MAGIC_TOKEN_TTL_MINUTES`,
`WHATSAPP_MEDIA_*`, `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_DATABASE_ID`, `FIREBASE_STORAGE_BUCKET`,
`CRON_SECRET`, `PDF_MARKDOWN_FUNCTION_URL`, `HEALTH_PROFILE_HEADER_IMAGE_URL`, `APP_TIMEZONE`, `NODE_ENV`
plus files `firebase-adminsdk.json`, `firebase-applet-config.json`.
