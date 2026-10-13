# Environments & Secrets

Resolved topology (2026-10-13, via Firebase MCP — no new project needed):

| Concern | Development / Preview | Production |
|---|---|---|
| Firebase project | **`bluepin-f8a09`** | **`myhealthyfam-28c2c`** |
| Firestore | `(default)`, STANDARD, `nam5` | `ai-studio-411912a3-9066-443b-8806-f8c0885a496a`, ENTERPRISE, `us-west1` |
| Auth domain | `bluepin-f8a09.firebaseapp.com` | `auth.bluepin.in` |
| Storage bucket | `bluepin-f8a09.firebasestorage.app` | `myhealthyfam-28c2c.firebasestorage.app` |
| Local config | `.env` → bluepin-f8a09 (already) | — (deploy-time only) |
| App Hosting config | `apphosting.preview.yaml` | `apphosting.yaml` (base) |
| `ENV_NAME` | `development` (local) / `preview` | `production` |
| `WHATSAPP_MODE` | `test` | `live` |
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

1. `.env*` (except `.env.example`) are gitignored and never committed. `.env` = local dev
   (bluepin-f8a09). Preview/prod values come from App Hosting env + Secret Manager, which
   always win over files (`process.loadEnvFile()` never overrides real env).
2. `apphosting.yaml` holds production defaults; `apphosting.preview.yaml` overrides for preview.
   Firebase console values take precedence over yaml; yaml takes precedence over dotenv files.
3. `server/config.ts` validates at boot: throws on unknown `ENV_NAME` or `WHATSAPP_MODE=live`
   outside production; warns on missing integration keys. Strict required-keys arrive with Phase 4.
4. Local `.env` already points at bluepin-f8a09 — do NOT point it at myhealthyfam except for
   explicit prod debugging, and never commit it.

## Test sender revival (your part, ~5 min — no dashboard access needed on my side)

Do NOT share your Meta password. I only need pasted values afterwards.

1. Open `developers.facebook.com` → your app → **WhatsApp → API Setup**.
2. Under **Test phone number**: confirm the test number + test WABA exist (recreate if deleted).
3. **Add your own phone** as a test recipient (verify via the OTP Meta sends you).
   Test numbers can ONLY message registered recipients — that is expected.
4. Generate a test token (short-lived user token, `whatsapp_business_messaging` scope).
   Paste into Secret Manager as `whatsapp-token-preview` (never into git).
5. Note the test **Phone Number ID** + test **WABA ID** → `whatsapp-phone-number-id-preview`.
6. After the preview backend exists: **WhatsApp → Configuration → Webhook → Edit**,
   callback URL = `<preview-backend-url>/api/whatsapp/webhook`, verify token = a new
   preview-only string → store as `whatsapp-verify-token-preview`. Subscribe to `messages`.
   Leave the prod webhook subscription untouched.
7. Paste me (or store directly): test Phone Number ID, test WABA ID, chosen preview
   verify token, preview backend URL. `APP_SECRET` is shared (same Meta app) — prod value
   can be reused for preview signature verification.

## Key inventory (from `.env.example` + code grep, names only — no values)

`VITE_FIREBASE_*`, `GEMINI_API_KEY`, `VITE_RECAPTCHA_SITE_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM_EMAIL`,
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WABA_ID`, `META_BASE_URL`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_BUSINESS_PHONE`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_OTP_TEMPLATE_NAME`,
`OTP_SECRET`, `APP_URL`/`FRONTEND_URL`, `WHATSAPP_MAGIC_TOKEN_TTL_MINUTES`,
`WHATSAPP_MEDIA_*`, `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_DATABASE_ID`, `FIREBASE_STORAGE_BUCKET`,
`CRON_SECRET`, `PDF_MARKDOWN_FUNCTION_URL`, `HEALTH_PROFILE_HEADER_IMAGE_URL`, `APP_TIMEZONE`, `NODE_ENV`
plus files `firebase-adminsdk.json`, `firebase-applet-config.json`.
