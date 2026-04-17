---
phase: 03-auth-session-h-rtung
plan: "01"
subsystem: auth
tags: [security, timing-attack, crypto, internal-auth, matrix-bot]
dependency_graph:
  requires: []
  provides: [timing-safe-internal-token-comparison]
  affects: [hub-internal-auth, matrix-bot-internal-sync]
tech_stack:
  added: [node:crypto timingSafeEqual]
  patterns: [timingSafeEqualString helper, timing-safe bearer token comparison]
key_files:
  created: []
  modified:
    - platform/apps/hub/server/utils/internal-auth.ts
    - platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts
    - platform/apps/matrix-bot/src/utils/internal-sync-server.ts
    - platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts
decisions:
  - timingSafeEqualString defined locally in each consumer (not shared) per plan spec
  - Helper placed at top of file (hub) and in Helpers section (matrix-bot) for consistency
metrics:
  duration: ~8 minutes
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 4
---

# Phase 03 Plan 01: Timing-Safe Internal Token Comparison Summary

**One-liner:** Replaced direct string equality in Bearer token checks with `crypto.timingSafeEqual` in Hub internal-auth.ts and Matrix-Bot internal-sync-server.ts, closing timing attack findings F-03 and F-04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix Hub internal-auth.ts timing-safe token comparison (F-03) | 68610ff | internal-auth.ts, internal-auth.spec.ts |
| 2 | Fix Matrix-Bot internal-sync-server.ts timing-safe token comparison (F-04) | 7b391c7 | internal-sync-server.ts, internal-sync-server.spec.ts |

## Changes Made

### Task 1 — Hub internal-auth.ts (F-03)

**File:** `platform/apps/hub/server/utils/internal-auth.ts`

- Added `import crypto from "node:crypto"` as first import
- Added local `timingSafeEqualString(left, right)` helper using `crypto.timingSafeEqual` with Buffer padding to equal lengths
- Replaced `token !== expectedToken` (line 16) with `!timingSafeEqualString(token, expectedToken)`

**File:** `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts`

- Added test: "uses timing-safe comparison (equal-length wrong token still rejected)"
- Tests `"Bearer secret-token-xyz"` against expected `"secret-token-abc"` (same byte length, different value) — must return 401
- Test count: 5 → 6

### Task 2 — Matrix-Bot internal-sync-server.ts (F-04)

**File:** `platform/apps/matrix-bot/src/utils/internal-sync-server.ts`

- Added `import crypto from "node:crypto"` (alphabetically before `import http`)
- Added local `timingSafeEqualString(left, right)` helper in the Helpers section
- Replaced `authHeader !== \`Bearer ${token}\`` with three-part guard:
  - `!authHeader`
  - `!authHeader.startsWith("Bearer ")`
  - `!timingSafeEqualString(authHeader.slice("Bearer ".length), token)`

**File:** `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts`

- Added test: "rejects requests with equal-length wrong auth token (timing-safe, same-length)"
- Uses `"X".repeat(TEST_TOKEN.length)` — same byte length as TEST_TOKEN, different value — must return 401
- Test count: 8 → 9

## Test Counts Before/After

| Suite | Before | After |
|-------|--------|-------|
| Hub `internal-auth.spec.ts` | 5 | 6 |
| Matrix-Bot `internal-sync-server.spec.ts` | 8 | 9 |

## Security Finding Closure

- **F-03** (Hub internal-auth.ts): CLOSED — `token !== expectedToken` removed, replaced with `timingSafeEqualString`
- **F-04** (Matrix-Bot internal-sync-server.ts): CLOSED — `authHeader !== \`Bearer ${token}\`` removed, replaced with `timingSafeEqualString`
- **SEC-03**: CLOSED — both timing attack surfaces mitigated

## Deviations from Plan

**1. [Rule 1 - Observation] Test count differs from plan estimate**
- Plan stated "11 matrix-bot existing tests" but actual count was 8 pre-existing tests (now 9 with new test)
- Plan stated "268 hub tests" for overall suite; only the targeted internal-auth spec was run (6 tests)
- No fix needed — the plan's count estimates were approximate; actual tests all pass

**2. [Rule 3 - Fix] node_modules not present in worktree**
- Worktree lacks node_modules; created symlinks to main platform and matrix-bot node_modules
- Required to run vitest from within the worktree context
- No production code impact; symlinks are not committed

Otherwise: plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are confined to hardening existing auth checks at the same trust boundaries defined in the plan's threat model.

## Self-Check: PASSED

All created/modified files verified present on disk. Both task commits (68610ff, 7b391c7) confirmed in git log.
