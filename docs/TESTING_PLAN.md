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

- [x] Delete dead top-level files in one revertable commit:
  Deleted 26 files (2026-10-13). **Kept `test.pdf`**: it is the default fixture of the manual
  harness `scripts/test_lab_report_tokens.ts:352` — deleted with the harness in Phase 3.
  (`test2.pdf`/`test.tmp` were byte-identical copies and were deleted.)
- [x] Untrack committed `dist/` from git (keep as gitignored build output).
  Not needed — `dist/` was never tracked (gitignored). Verified 2026-10-13.
- [x] Deprecate-don't-delete: add `@deprecated` headers pointing at the live copy for
  `server/services/labReportService.ts` → `labReportServiceDirect.ts`,
  superseded `server/services/whatsapp/*` → `server/services/wa-bot/*`,
  `src/components/AuthScreen.tsx` → `src/components/authflow/`,
  `src/components/WelcomeScreen.tsx` (legacy marketing).
  Switch all imports to live copies; delete legacy only after Phase 3 covers the live path.
  - Done for `labReportService.ts`, `AuthScreen.tsx`, `WelcomeScreen.tsx` + `TestPage.tsx` stub
    (all verified zero importers via grep).
  - NOT applied to `services/whatsapp/*`: routes (`whatsapp.ts`, `auth.ts`) still import the legacy
    barrel via `whatsappService`, while `wa-bot/routeMessage` handles inbound. The two implementations
    coexist — consolidation deferred to Phase 3 behind tests.
- Gate: `tsc --noEmit` + production build green.
  - Lint still exactly the 11 pre-existing `Dashboard.tsx` errors — no new errors introduced.

## Phase 2 — Env separation (incl. WhatsApp test number revival + 2nd Firebase project)

Topology discovered 2026-10-13 (no new project needed): prod = `myhealthyfam-28c2c`
(ENTERPRISE Firestore `ai-studio-…`, `auth.bluepin.in`), dev/preview = `bluepin-f8a09`
(`(default)` Firestore). Local `.env` already points at `bluepin-f8a09`. Model: single
`.env` for local dev + `ENV_NAME` identity; App Hosting yaml/env supplies per-env values
(real process env always wins over files). No per-env dotenv files.

- [x] Add `server/config.ts` (zod-validated, fail-fast): `ENV_NAME=development|preview|production` + all required keys.
  Warns on missing integration keys; **throws** on unknown `ENV_NAME` or
  `WHATSAPP_MODE=live` outside production. Verified: boots `[env=development, whatsapp=test]`,
  refuses `live` in preview.
- [x] `GET /api/health` (version-free: `{status, env, whatsappMode, now}`, no secrets). Verified live.
- [x] Create `apphosting.yaml` (production defaults, Secret Manager refs) +
  `apphosting.preview.yaml` (bluepin-f8a09 values, `WHATSAPP_MODE=test`, smaller instances).
  TODOs left in-file: prod `APP_URL` confirm, prod `VITE_FIREBASE_APP_ID/API_KEY` (which of the
  6 myhealthyfam web apps is prod?), preview `APP_URL` (after backend exists), all Secret
  Manager values (console, manual).
- [x] Extend `.env.example` with `ENV_NAME` + `WHATSAPP_MODE`. Boot log in `server.ts`
  prints `[env=…, whatsapp=…]` (no secrets).
- [x] `WHATSAPP_MODE=test|live` guard in `wa-bot/wa-client/sender.ts:postMessage` (defense in
  depth; Meta also rejects cross-sender sends server-side).
- [ ] **WhatsApp test sender revival (needs you, ~5 min in Meta dashboard):** see
  `docs/ENVIRONMENTS.md` "Test sender revival" checklist. Code side is ready (preview mode +
  separate verify token supported).
- [ ] Separate Gemini key + SMTP sender for preview (Secret Manager `*-preview` refs stubbed).
- Gate: boot each env with its file, `GET /api/health` reports correct `ENV_NAME`, preview writes absent from prod.
  - Preview gate **PASSED** 2026-10-13: `https://bluepin-f8a09--bluepin-f8a09.us-east4.hosted.app/api/health`
    → `{env: preview, whatsappMode: test}` (after explicit console vars; base yaml had won initially).

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
| 2026-10-13 | 0 | npm standardized (`bun.lock` deleted). Lint RED (11 pre-existing `Dashboard.tsx` errors); build GREEN. |
| 2026-10-13 | 1 | Deleted 26 dead top-level files (kept `test.pdf` as harness fixture); `@deprecated` headers on 4 unimported modules; `dist/` confirmed untracked; lint still exactly 11 errors. |
| 2026-10-13 | 2 | Owner reported console keys for both projects. yamls rewritten additive-only (no `secret:` refs — console stays source of truth, rollout can't fail on missing secrets). Gaps documented in `docs/ENVIRONMENTS.md` (preview: verify token, app secret, cron secret, APP_URL, test-sender token swap). |
| 2026-10-13 | 2 | Branch deployed to preview backend. `/api/health` first read `production`/`live` (base yaml won); fixed via explicit console `ENV_NAME`/`WHATSAPP_MODE`, now `preview`/`test`. Lesson recorded in `docs/ENVIRONMENTS.md`. Webhook verification unblocked. |
