---
phase: 04-supply-chain-secrets
plan: "03"
subsystem: bot-startup
tags: [security, startup-validation, fail-loud, SEC-06, discord-bot, matrix-bot]
dependency_graph:
  requires: []
  provides:
    - bot-BOT_INTERNAL_TOKEN-startup-validation
    - matrix-bot-BOT_INTERNAL_TOKEN-startup-validation
  affects:
    - apps/bot/src/index.ts
    - apps/matrix-bot/src/index.ts
tech_stack:
  added: []
  patterns:
    - fail-loud startup guard with process.exit(1) before network I/O
    - isPlaceholderToken pure function with case-insensitive prefix matching
    - TDD RED/GREEN cycle for both bots
key_files:
  created:
    - apps/bot/src/utils/startup-checks.ts
    - apps/bot/src/utils/__tests__/startup-checks.spec.ts
    - apps/matrix-bot/src/utils/startup-checks.ts
    - apps/matrix-bot/src/__tests__/token-check.spec.ts
  modified:
    - apps/bot/src/index.ts
    - apps/matrix-bot/src/index.ts
decisions:
  - "Guard placed before new Client() in bot/index.ts — synchronous check before any Discord I/O"
  - "Matrix-bot guard placed after HOMESERVER_URL/ACCESS_TOKEN check — prevents false abort when matrix-bot not configured (pitfall 3)"
  - "Matrix-bot import uses .js extension — ESM convention consistent with existing internal-sync-server.js import"
  - "Both utilities export identical PLACEHOLDER_PREFIXES and isPlaceholderToken for consistency"
metrics:
  duration: "5 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 04 Plan 03: Bot Startup Token Validation Summary

Fail-loud BOT_INTERNAL_TOKEN validation added to Discord bot and Matrix bot startup sequences — process exits with a clear error before any network I/O when the token is empty or matches a known placeholder prefix (SEC-06 / F-11).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Bot — startup-checks utility and index.ts guard | ab07a42 (test), 143845b (feat) | startup-checks.ts, startup-checks.spec.ts, index.ts |
| 2 | Matrix-bot — startup-checks utility and index.ts guard | 4cd614a (test), 5f1b26c (feat) | startup-checks.ts, token-check.spec.ts, index.ts |

## What Was Built

**`apps/bot/src/utils/startup-checks.ts`** — Pure validator exporting `PLACEHOLDER_PREFIXES` (4 prefixes: `replace_with_`, `changeme`, `your_token_here`, `dev-`) and `isPlaceholderToken(value)` with case-insensitive matching.

**`apps/bot/src/index.ts`** — Guard added at lines 33-40, before `new Client(` (line 42). Calls `logger.error()` and `process.exit(1)` on empty or placeholder `BOT_INTERNAL_TOKEN`.

**`apps/matrix-bot/src/utils/startup-checks.ts`** — Identical logic with ESM-compatible exports (consumed via `.js` extension import).

**`apps/matrix-bot/src/index.ts`** — Three changes:
1. Import added with `.js` extension convention
2. `|| ""` fallback removed from `BOT_INTERNAL_TOKEN` assignment (line 14)
3. Guard added at lines 21-26, after the HOMESERVER_URL/ACCESS_TOKEN check (line 16) — pitfall-3 ordering preserved

## TDD Gate Compliance

Both tasks followed RED/GREEN/REFACTOR pattern:

- **Task 1 RED**: `test(04-03): add failing tests for bot BOT_INTERNAL_TOKEN startup validation` (ab07a42) — tests failed with module-not-found error
- **Task 1 GREEN**: `feat(04-03): bot startup fail-loud check for BOT_INTERNAL_TOKEN (SEC-06)` (143845b) — 10/10 tests pass
- **Task 2 RED**: `test(04-03): add failing tests for matrix-bot BOT_INTERNAL_TOKEN startup validation` (4cd614a) — tests failed with module-not-found error
- **Task 2 GREEN**: `feat(04-03): matrix-bot startup fail-loud check for BOT_INTERNAL_TOKEN (SEC-06)` (5f1b26c) — 8/8 token-check tests + 11/11 internal-sync-server tests pass (19 total)

## Test Results

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| @guildora/bot startup-checks | 1 | 10 | PASS |
| @guildora/matrix-bot all tests | 2 | 19 | PASS |

## Deviations from Plan

None — plan executed exactly as written. All placeholder prefix cases, ordering constraints, and ESM extension conventions applied as specified.

## Threat Mitigations Applied

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-04-03-01 | Mitigated | Bot guard in index.ts before `new Client()` |
| T-04-03-02 | Mitigated | `|| ""` fallback removed; guard added in matrix-bot |
| T-04-03-03 | Accepted by design | BOT_INTERNAL_TOKEN check placed after HOMESERVER/ACCESS_TOKEN guard |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `apps/bot/src/utils/startup-checks.ts` — FOUND
- `apps/bot/src/utils/__tests__/startup-checks.spec.ts` — FOUND
- `apps/matrix-bot/src/utils/startup-checks.ts` — FOUND
- `apps/matrix-bot/src/__tests__/token-check.spec.ts` — FOUND
- Commits ab07a42, 143845b, 4cd614a, 5f1b26c — FOUND in git log
- `isPlaceholderToken` guard before `new Client(` in bot/index.ts — VERIFIED (line 35 < line 42)
- BOT_INTERNAL_TOKEN guard after HOMESERVER guard in matrix-bot/index.ts — VERIFIED (line 21 > line 16)
- `|| ""` fallback removed — VERIFIED
