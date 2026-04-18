---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: 02
subsystem: infra
tags: [typescript, matrix-bot, typecheck, ci, non-null-assertion]

# Dependency graph
requires:
  - phase: 05-01
    provides: CI audit baseline — identified matrix-bot TS2322 as the sole typecheck failure
provides:
  - "pnpm typecheck exits 0 across all 7 workspace packages"
  - "matrix-bot TS2322 on src/index.ts:44 resolved via non-null assertion"
affects: [05-03, 05-04, 05-05, 05-06, 05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-null assertion (!) to bridge process.exit guard that TypeScript control-flow cannot follow across function boundaries"

key-files:
  created: []
  modified:
    - apps/matrix-bot/src/index.ts

key-decisions:
  - "Used non-null assertion (!) rather than type narrowing workaround — the guard on lines 21-26 already guarantees token is truthy at runtime; ! is the correct compile-time hint"

patterns-established:
  - "Non-null assertion pattern: when process.exit guards cannot be tracked by TypeScript narrowing, ! is the preferred fix over restructuring code"

requirements-completed: [CI-02]

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 05 Plan 02: Matrix-bot TypeScript TS2322 Fix Summary

**Non-null assertion `!` on `BOT_INTERNAL_TOKEN` at `startInternalSyncServer` call site unblocks `pnpm typecheck` across the entire workspace (7 packages, all green)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T11:25:00Z
- **Completed:** 2026-04-18T11:28:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Fixed the single TypeScript error (TS2322) in `apps/matrix-bot/src/index.ts` line 44
- `pnpm --filter @guildora/matrix-bot typecheck` exits 0
- `pnpm typecheck` (full Turbo workspace, 7 packages) exits 0

## Task Commits

1. **Task 1: Fix matrix-bot TS2322 — add non-null assertion on BOT_INTERNAL_TOKEN** - `00c467d` (fix)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `apps/matrix-bot/src/index.ts` — Added `!` non-null assertion on `BOT_INTERNAL_TOKEN` at line 44 (the `startInternalSyncServer` call site)

## Decisions Made

Used `BOT_INTERNAL_TOKEN!` (non-null assertion) rather than restructuring the guard. The startup guard on lines 21-26 already calls `process.exit(1)` if the token is falsy or a placeholder, so the assertion is safe. TypeScript's control-flow analysis cannot track that `process.exit` terminates the process when the guard runs at module scope before the `main()` function executes — so `!` is the idiomatic fix.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pnpm typecheck` is now green workspace-wide — CI-02 requirement satisfied
- Ready for plans 05-03 through 05-07 (linting, test coverage, API tests)

---

## Self-Check

- [x] `apps/matrix-bot/src/index.ts` line 44 contains `token: BOT_INTERNAL_TOKEN!,`
- [x] Commit `00c467d` exists
- [x] `pnpm --filter @guildora/matrix-bot typecheck` exits 0 (verified)
- [x] `pnpm typecheck` exits 0 (7 tasks successful, verified)
- [x] No STATE.md or ROADMAP.md modifications

## Self-Check: PASSED

---
*Phase: 05-ci-vertrauen-api-test-abdeckung*
*Completed: 2026-04-18*
