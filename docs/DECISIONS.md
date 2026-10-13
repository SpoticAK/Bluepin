# Decision log (append-only)

## 2026-10-13 — wfarih (plan approval)

1. **Two Firebase projects.** Dev/preview gets its own project for full Auth/Firestore/Storage/FCM
   isolation; prod keeps the existing project. Short-term single-project namespacing allowed as fallback.
2. **WhatsApp test number revival in Phase 2.** Re-register the Meta test sender on the preview webhook
   URL; prod number stays on the prod URL only; add `WHATSAPP_MODE=test|live` guard.
3. **npm (not bun).** Firebase App Hosting buildpacks support npm/yarn/pnpm only — Bun is unsupported
   and not configurable via `apphosting.yaml`. `bun.lock` deleted in Phase 0; `patch_bun.sh` deleted in Phase 1.
4. **Cleanup before tests.** Phase 1 (dead-file deletion + deprecation headers) lands before new test setup.
5. **CI = GitHub Actions + Firebase preview channels.** `.github/workflows/ci.yml` with per-env secrets.
