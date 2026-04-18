---
phase: 04-supply-chain-secrets
verified: 2026-04-18T08:35:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 4: Supply-Chain & Secrets Verification Report

**Phase Goal:** `docker-compose.yml` env-basiert, `pnpm audit` sauber, `pnpm.overrides` reviewt — keine hardcoded Secrets, keine unkontrollierten High/Critical CVEs, Startup-Token-Guards für alle Services aktiv.
**Verified:** 2026-04-18T08:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | docker-compose.yml contains no literal `postgres:postgres` string | ✓ VERIFIED | `grep -c "postgres:postgres" docker-compose.yml` → 0 matches |
| 2  | .env.example warns that POSTGRES_PASSWORD and DATABASE_URL are production-required secrets | ✓ VERIFIED | `MUST change before production` present; `POSTGRES_PASSWORD=replace_with_strong_db_password` present |
| 3  | DB healthcheck uses parameterised variable references for POSTGRES_USER and POSTGRES_DB | ✓ VERIFIED | `pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}` in place |
| 4  | docker-compose.yml DATABASE_URL entries for hub and bot both reference ${DATABASE_URL} | ✓ VERIFIED | 2 `DATABASE_URL: ${DATABASE_URL}` matches (hub + bot); 1 `NUXT_DATABASE_URL: ${DATABASE_URL}` match |
| 5  | Bot/Hub compose startup with new env-based setup confirmed by operator startup log in SUMMARY | ✓ VERIFIED | 04-01-SUMMARY.md contains operator-verified log: db Healthy, bot started, "Discord bot connected" |
| 6  | pnpm audit --prod reports no unaccepted High or Critical findings | ✓ VERIFIED | Live audit: 1 Critical (form-data via matrix-bot-sdk, documented as accepted risk) + 15 Moderate; zero unaccepted High/Critical |
| 7  | All 18 pnpm.overrides entries are documented with CVE number or rationale | ✓ VERIFIED | `.planning/research/04-overrides-audit.md` contains full 18-entry table including serialize-javascript and eslint>ajv |
| 8  | New overrides for defu, lodash, and vite are added to platform/package.json | ✓ VERIFIED | `"defu": ">=6.1.5"`, `"lodash": ">=4.18.0"`, `"vite": ">=7.3.2"` all present |
| 9  | drizzle-orm is upgraded to ^0.45.2 in shared, hub, and bot packages | ✓ VERIFIED | All three package.json files declare `"drizzle-orm": "^0.45.2"` |
| 10 | Bot startup aborts with a clear error message when BOT_INTERNAL_TOKEN is empty or placeholder | ✓ VERIFIED | Guard at lines 33-40 in bot/src/index.ts, before `new Client()` at line 42; message "Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value" |
| 11 | Matrix-bot startup aborts when BOT_INTERNAL_TOKEN is empty or placeholder, only after matrix credentials confirmed present | ✓ VERIFIED | Guard at lines 21-25 in matrix-bot/src/index.ts, after HOMESERVER_URL/ACCESS_TOKEN check at line 16; `|| ""` fallback removed |
| 12 | Unit tests exercise the token validation logic for both bot and matrix-bot | ✓ VERIFIED | Bot: 128 tests pass (12 files incl. startup-checks.spec.ts). Matrix-bot: 19 tests pass (2 files incl. token-check.spec.ts) |
| 13 | Hub Nitro server aborts startup when BOT_INTERNAL_TOKEN is empty or placeholder; does NOT abort when MCP_INTERNAL_TOKEN is absent | ✓ VERIFIED | `00-b-token-check.ts` exists; `mcpToken.length > 0 && isInvalidToken(mcpToken)` guard; hub: 291 tests pass (36 files) |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/docker-compose.yml` | DB credential env-var substitution | ✓ VERIFIED | POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}; DATABASE_URL: ${DATABASE_URL} (2×); NUXT_DATABASE_URL: ${DATABASE_URL}; healthcheck parameterised |
| `platform/.env.example` | POSTGRES_PASSWORD and DATABASE_URL documentation with production warning | ✓ VERIFIED | Contains POSTGRES_PASSWORD, MUST change warning, db:5432 hostname note |
| `.planning/research/04-overrides-audit.md` | Per-entry documentation for all 18 pnpm.overrides entries | ✓ VERIFIED | 18-entry table, serialize-javascript through vite (Phase 4 additions) |
| `.planning/research/04-audit-accepted-risks.md` | Accepted-risk documentation for CVEs that cannot be fixed upstream | ✓ VERIFIED | CVE-2025-7783 (form-data/request/matrix-bot-sdk chain) documented with impact assessment and mitigating controls |
| `platform/package.json` | Updated pnpm.overrides with new defu/lodash/vite entries | ✓ VERIFIED | All three new overrides present |
| `platform/apps/bot/src/utils/startup-checks.ts` | isPlaceholderToken pure function, exportable and testable | ✓ VERIFIED | Exports PLACEHOLDER_PREFIXES and isPlaceholderToken; case-insensitive prefix matching |
| `platform/apps/bot/src/utils/__tests__/startup-checks.spec.ts` | Unit tests for isPlaceholderToken covering all prefix cases | ✓ VERIFIED | Part of passing bot test suite (128 tests) |
| `platform/apps/matrix-bot/src/utils/startup-checks.ts` | isPlaceholderToken for matrix-bot (ESM with .js extensions) | ✓ VERIFIED | Identical logic; consumed via `./utils/startup-checks.js` import in index.ts |
| `platform/apps/matrix-bot/src/__tests__/token-check.spec.ts` | Unit tests for matrix-bot startup token validation | ✓ VERIFIED | 8 tests pass |
| `platform/apps/hub/server/plugins/00-b-token-check.ts` | Nitro startup plugin for token validation | ✓ VERIFIED | defineNitroPlugin; isInvalidToken; BOT_INTERNAL_TOKEN required; MCP optional; process.exit(1) on failure |
| `platform/apps/hub/server/plugins/__tests__/token-check.spec.ts` | Unit tests for all five token-check scenarios | ✓ VERIFIED | Part of passing hub test suite (291 tests) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/.env.example` | `platform/docker-compose.yml` | Docker Compose ${VAR} env substitution | ✓ WIRED | `POSTGRES_PASSWORD=replace_with_strong_db_password` in .env.example matches `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` in compose |
| `platform/package.json pnpm.overrides` | transitive dependencies | pnpm install | ✓ WIRED | defu `>=6.1.5`, lodash `>=4.18.0`, vite `>=7.3.2` all present in package.json; pnpm-lock.yaml updated |
| `platform/packages/shared/package.json` | drizzle-orm@^0.45.2 | pnpm install | ✓ WIRED | `"drizzle-orm": "^0.45.2"` declared; bot tests (128) pass confirming no API regressions |
| `platform/apps/bot/src/index.ts` | `platform/apps/bot/src/utils/startup-checks.ts` | `import { isPlaceholderToken } from "./utils/startup-checks"` | ✓ WIRED | Import at line 24; guard at lines 33-40; before `new Client()` at line 42 |
| `platform/apps/matrix-bot/src/index.ts` | `platform/apps/matrix-bot/src/utils/startup-checks.ts` | `import { isPlaceholderToken } from "./utils/startup-checks.js"` | ✓ WIRED | Import at line 4; guard at lines 21-25; after HOMESERVER/ACCESS_TOKEN check at line 16 |
| `platform/apps/hub/server/plugins/00-b-token-check.ts` | `useRuntimeConfig() botInternalToken / mcpInternalToken` | Nitro auto-import useRuntimeConfig | ✓ WIRED | `config.botInternalToken` and `config.mcpInternalToken` read; plugin sorts correctly: 00-a-load-env < 00-b-token-check < 00-db-migrate |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| pnpm audit --prod shows no unaccepted High/Critical | `pnpm audit --prod --audit-level=high 2>&1 | tail -5` | "16 vulnerabilities found / Severity: 15 moderate \| 1 critical" — sole Critical is CVE-2025-7783 (accepted risk, documented) | ✓ PASS |
| Bot tests green with drizzle-orm 0.45.2 | `cd apps/bot && pnpm test` | 128 tests passed (12 files) | ✓ PASS |
| Matrix-bot tests green | `cd apps/matrix-bot && pnpm test` | 19 tests passed (2 files) | ✓ PASS |
| Hub tests green | `cd apps/hub && pnpm test` | 291 tests passed (36 files) | ✓ PASS |
| Bot guard placed before new Client() | `grep -n "new Client\|isPlaceholderToken" apps/bot/src/index.ts` | Guard at line 35, `new Client(` at line 42 | ✓ PASS |
| Matrix-bot guard after HOMESERVER check | `grep -n "isPlaceholderToken\|HOMESERVER" apps/matrix-bot/src/index.ts` | HOMESERVER check at line 16, guard at line 21 | ✓ PASS |
| Plugin sorts between 00-a and 00-db | `ls apps/hub/server/plugins/ \| sort \| grep "^00-"` | 00-a-load-env.ts, 00-b-token-check.ts, 00-db-migrate.ts | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-06 | 04-01, 04-03, 04-04 | docker-compose.yml keine hardcodierten DB-Credentials; Startup-Token-Guards | ✓ SATISFIED | Compose file: 0 `postgres:postgres` matches. Bot/matrix-bot/hub all have fail-loud BOT_INTERNAL_TOKEN guards with process.exit(1) |
| SEC-07 | 04-02 | pnpm audit sauber (keine offenen High/Critical); 15 pnpm.overrides reviewt | ✓ SATISFIED | Audit: only 1 Critical (accepted, documented). All 18 overrides (15 original + 3 new) documented in 04-overrides-audit.md |

### Anti-Patterns Found

None. The word "placeholder" appears in the startup-check source files as part of the security feature implementation (PLACEHOLDER_PREFIXES constant, JSDoc comments) — not as stub indicators. No TODO/FIXME/empty implementations found in phase artifacts.

### Human Verification Required

None. All must-haves were verifiable programmatically.

---

_Verified: 2026-04-18T08:35:00Z_
_Verifier: Claude (gsd-verifier)_
