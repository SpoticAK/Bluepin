# Testing / Cleanup / Env-separation / CI-CD — Living Plan

Branch: `chore/testing-foundation` (cut from `main` on 2026-10-13).
This file is the source of truth. Update the status tables at the end of every phase.
Rule: each phase lands as a small PR `chore/testing-foundation` ← `chore/phase-N-<slug>`. No direct pushes to `main`.

Related docs: `docs/ENVIRONMENTS.md` (env matrix + secrets), `docs/DECISIONS.md` (append-only decision log).

## Baseline (2026-10-13, pre-change survey)

- Zero test files (`*.test.*`/`*.spec.*`), zero test runner, zero CI workflows (no `.github/` at repo root).
- Only script: `lint = tsc --noEmit`. Manual harnesses: `scripts/test_lab_report_tokens.ts`, `scripts/test_whatsapp.ts`.
- Single `.env` (gitignored) + `.env.example`; only env branch in code is `NODE_ENV !== "production"`.
- One Firebase project, two App Hosting instances (prod + preview) sharing Firestore/Auth/Storage.
- Meta test sender dead; webhook serves the prod number only.
- ~25 dead top-level files (patchers, scratch tests, pasted notes) + duplicated live-vs-legacy modules.
- Dual lockfiles: `bun.lock` + `package-lock.json`. Decision: **npm** (App Hosting buildpacks support npm/yarn/pnpm only — Bun unsupported, not configurable via `apphosting.yaml`).

## Phase 0 — Safety net

- [x] Create `chore/testing-foundation` + this living plan.
- [x] Standardize on npm: delete `bun.lock` (keep `package-lock.json`).
- [x] Record baseline: `npm run lint`, `npm run build` pass/fail on clean checkout.
  - `npm run lint` = **RED**: 11 pre-existing errors, all in `src/components/Dashboard.tsx`
    (missing `familySummaries` on `AppContextType` + `"health"`/`"glucose"`/`"weight"` tab-type mismatches).
    Not fixed in Phase 0 — tracked for the CI phase (CI must start with a green lint; fix lands with Phase 1/4).
  - `npm run build` baseline: **GREEN** (19.7s; chunk-size warnings only; `dist/` is gitignored so no churn).

## Phase 1 — Cleanup first (approved priority)

- [ ] Delete dead top-level files in one revertable commit:
  `formatAndFix.cjs`, `patch.js`, `patch.mjs`, `patch_add_report.cjs`, `patch_add_report.mjs`,
  `patch_app.cjs`, `patch_store.cjs`, `patch_rules.cjs`, `patch_server.mjs`, `patch_dash.py`,
  `patch_bun.sh`, `migrate.ts`, `query-db.ts`, `test.js`, `test.ts`, `test-date.ts`,
  `test-delete.js`, `test.txt`, `test.tmp`, `test.pdf`, `test2.pdf`, `empty.pdf`,
  `dashboard_sections.txt`, `ui_patch.txt`, `trend_patch.txt`, `trend_ui_patch.txt`, `total_readings_patch.txt`.
- [ ] Untrack committed `dist/` from git (keep as gitignored build output).
- [ ] Deprecate-don't-delete: add `@deprecated` headers pointing at the live copy for
  `server/services/labReportService.ts` → `labReportServiceDirect.ts`,
  superseded `server/services/whatsapp/*` → `server/services/wa-bot/*`,
  `src/components/AuthScreen.tsx` → `src/components/authflow/`,
  `src/components/WelcomeScreen.tsx` (legacy marketing).
  Switch all imports to live copies; delete legacy only after Phase 3 covers the live path.
- Gate: `tsc --noEmit` + production build green.

## Phase 2 — Env separation (incl. WhatsApp test number revival + 2nd Firebase project)

- [ ] Add `server/config.ts` (zod-validated, fail-fast): `ENV_NAME=development|preview|production` + all required keys.
- [ ] Add `.env.development` / `.env.preview` / `.env.production` (gitignored) + extend `.env.example`;
  add `dev` / `build:preview`+`start:preview` / `build`+`start` scripts.
- [ ] Create `apphosting.yaml` (base defaults) + `apphosting.preview.yaml` (+ prod overrides) for run config + non-secret env.
- [ ] Create **second Firebase project** for dev/preview (Auth/Firestore/Storage/FCM fully isolated).
  Short-term fallback if delayed: namespace within the single project (separate `APP_URL`, separate
  `VERIFY_TOKEN`/`APP_SECRET`, Storage prefix, `env` field on test writes).
- [ ] **WhatsApp test sender revival:** register test number on preview webhook URL with preview
  `VERIFY_TOKEN`; keep prod number on prod URL only; add `WHATSAPP_MODE=test|live` guard so preview
  can never send via the prod `PHONE_NUMBER_ID`; add dry-run flag to `scripts/test_whatsapp.ts`.
- [ ] Separate Gemini key/quota for preview; separate SMTP sender (or mailtrap) for non-prod.
- Gate: boot each env with its file, `GET /api/health` reports correct `ENV_NAME`, preview writes absent from prod.

## Phase 3 — Test setup

Install: `vitest`, `@vitest/coverage-v8`, `supertest`, Firestore emulator config, `msw` (or `nock`), `playwright` (chromium only).

- [ ] Unit (first): `src/lib/derivedMetrics.ts`, `src/lib/biomarkerUtils.ts`,
  `src/lib/registry/biomarkerLookup.ts`, `src/careReminderRules.ts`, `src/lib/goalUtils.ts`,
  `server/utils/jsonparse.ts`, `server/utils/cache.ts`, `wa-bot/services/limits.ts`,
  `reminderSlots.ts`, `whatsapp/utils.ts`. Gemini fixtures: valid / truncated / garbage JSON.
- [ ] API (supertest + mocked sender/Gemini + emulator): `routes/whatsapp.ts` (verify, signature reject,
  idempotency), `routes/auth.ts` (OTP send/verify, cooldown, link), `routes/upload.ts`,
  `routes/reminders.ts`, `routes/cron.ts` (`CRON_SECRET`, IST hour, 20:00 sweep).
- [ ] Rules tests: `firestore.rules`, `storage.rules` on emulator (`users/{uid}` isolation, `feedbacks` write).
- [ ] E2E thin slice (Playwright vs preview + seeded user): login → add glucose → upload report → reminders toggle.
- [ ] Delete manual `scripts/test_*` once automated equivalents land.
- Gate: unit ≥70% on `src/lib` + `server/utils` + `wa-bot/services`; all 5 routes covered; E2E slice green.

## Phase 4 — CI/CD (GitHub Actions + Firebase preview channels)

- [ ] New `.github/workflows/ci.yml`: on PR → `lint` → `vitest --coverage` → `vite build + esbuild server`
  → Hosting **preview channel** deploy + PR comment URL. On `main` push → same + prod deploy + Playwright smoke.
- [ ] GitHub Environments `preview` / `production` with distinct secrets
  (`GEMINI_API_KEY`, `WHATSAPP_*`, `SMTP_*`, `APP_URL`, `CRON_SECRET`, `FIREBASE_*`).
- [ ] Add `GET /api/health` (version + env name, no secrets) for deploy verification.

## Status log

| Date | Phase | Change |
|---|---|---|
| 2026-10-13 | 0 | Branch created; plan + env + decision docs added. Baseline survey recorded above. |
