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

## 2026-10-13 — Phase 2 (code side)

6. **No new Firebase project.** Via Firebase MCP: prod = `myhealthyfam-28c2c` (ENTERPRISE
   Firestore `ai-studio-…`, 6 web apps), dev/preview = `bluepin-f8a09` (`(default)` Firestore).
   Local `.env` already targets bluepin-f8a09. Separation = `ENV_NAME` + App Hosting yaml/env.
7. **No per-env dotenv files.** Single `.env` for local dev; preview/prod inject via App Hosting
   (real env wins over files). Simpler than the planned `.env.preview/.production`.
8. **MCP wiring:** `opencode.json` fixed (`playwright`, `whatsapp_business_tools` moved from
   `mcp.servers` to top-level `mcp` — nesting prevented loading); `skills-lock.json` gained the
   Firebase agent-skills pack. GitHub steps stay manual (no GitHub MCP) — CI yaml will be
   committed for the user to wire (`preview`/`production` Environments + secrets).
9. **Meta access model:** agent never needs Meta dashboard login — user pastes test-sender IDs +
   token into Secret Manager; checklist in `docs/ENVIRONMENTS.md`.
