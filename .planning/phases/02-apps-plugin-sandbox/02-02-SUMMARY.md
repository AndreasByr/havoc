---
phase: 02-apps-plugin-sandbox
plan: "02"
subsystem: hub-apps-routing
tags: [security, timeout, dos-mitigation, tdd, structured-logging]
dependency_graph:
  requires: []
  provides: [hub-route-timeout-504, hub-route-error-500, path-spec-tests]
  affects: [apps/hub/server/api/apps/[...path].ts]
tech_stack:
  added: []
  patterns: [Promise.race-timeout, console-json-structured-logging, vitest-fake-timers-async]
key_files:
  created:
    - apps/hub/server/api/apps/__tests__/path.spec.ts
  modified:
    - apps/hub/server/api/apps/[...path].ts
decisions:
  - "Used console.warn/error(JSON.stringify(...)) instead of consola — hub has no consola dep (bot-only)"
  - "Used vi.advanceTimersByTimeAsync() + pre-attached catch for fake-timer timeout test — handles async microtask drainage correctly"
  - "Worktree-specific vitest.config.worktree.ts created for test execution (not committed — worktree artifact)"
metrics:
  duration: "~7 minutes"
  completed: "2026-04-17T11:36:36Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 2 Plan 02: Hub Route Handler Timeout Summary

**One-liner:** Promise.race() timeout guard wrapping app route handler invocations in `[...path].ts`, returning 504 on hang and 500 on error, with structured JSON console logging and full TDD test coverage.

## What Was Built

### Task 1: Failing tests (RED)
Created `platform/apps/hub/server/api/apps/__tests__/path.spec.ts` with two test cases:
- `route.timeout`: asserts 504 is returned when the app handler never resolves past `HOOK_TIMEOUT_MS`
- `route.error`: asserts 500 is returned when the app handler throws

Tests used the Hub standard pattern: `stubNuxtAutoImports`, `createMockEvent`, dynamic handler import, module mocks for `drizzle-orm`, `@guildora/shared`, `../../../utils/auth`, `apps`, `app-db`, `db`.

### Task 2: Implementation (GREEN)
Modified `platform/apps/hub/server/api/apps/[...path].ts`:

1. Added `HOOK_TIMEOUT_MS` constant after imports (reads from `process.env.APP_HOOK_TIMEOUT_MS`, defaults to 5000ms)
2. Replaced `return handler(event)` (line 111) with:
   - A `timeoutPromise` that rejects after `HOOK_TIMEOUT_MS` via `setTimeout`
   - `await Promise.race([Promise.resolve(handler(event)), timeoutPromise])`
   - `catch` that distinguishes timeout vs real errors by checking `error.message === "timeout"`
   - Timeout path: `console.warn(JSON.stringify({appId, event:"route.timeout", durationMs}))` + `throw createError({statusCode:504})`
   - Error path: `console.error(JSON.stringify({appId, event:"route.error", error}))` + `throw createError({statusCode:500})`
   - `finally { clearTimeout(timerId!) }` prevents timer leak when handler wins the race

## Test Execution

Tests run via worktree-specific vitest invocation (main platform node_modules, worktree source files):

```
Tests: 2 passed (2)
Duration: ~315ms
```

Full hub regression suite: `263 tests passed (29 files)` — no regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree vitest config missing pnpm/.pnpm directory**
- **Found during:** Task 1 (RED phase test execution)
- **Issue:** The git worktree has no `node_modules/.pnpm` — the `vitest.config.ts` `resolveH3()` function scans `__dirname/../../node_modules/.pnpm` which doesn't exist in the worktree
- **Fix:** Created `apps/hub/vitest.config.worktree.ts` pointing to `/home/andreas/workspace/guildora/platform/node_modules` for module resolution. Also mocked `drizzle-orm` in the spec (it's only used in `saveConfig` which isn't exercised in timeout/error tests).
- **Files modified:** `apps/hub/vitest.config.worktree.ts` (worktree-only, not committed to main branch)
- **Commit:** N/A (excluded from commit — worktree artifact)

**2. [Rule 1 - Bug] Fake-timer unhandled rejection warning**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `vi.advanceTimersByTime(5001)` fired the timeout before the `await expect(resultPromise).rejects` assertion attached its catch, causing vitest to log an unhandled rejection warning
- **Fix:** Changed to `await vi.advanceTimersByTimeAsync(5001)` (drains microtasks between ticks) and pre-attached `resultPromise.catch(() => {})` before advancing timers
- **Files modified:** `apps/hub/server/api/apps/__tests__/path.spec.ts`
- **Commit:** 610b3cb

**3. [Rule 1 - Bug] Import path depth incorrect (spec at apps/__tests__/ not api/__tests__/)**
- **Found during:** Task 1 (initial test run)
- **Issue:** Plan template used `../../utils/__tests__/test-helpers` (correct depth for `api/__tests__/`) but spec is at `api/apps/__tests__/` (one directory deeper), requiring `../../../utils/__tests__/test-helpers`
- **Fix:** Updated all relative imports in the spec file to use `../../../` prefix
- **Files modified:** `apps/hub/server/api/apps/__tests__/path.spec.ts`
- **Commit:** 11dc477

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 11dc477 | Both tests FAILED before implementation |
| GREEN (feat) | 610b3cb | Both tests PASS after implementation |
| REFACTOR | — | Not needed — code is clean |

## Known Stubs

None. All behavior is fully implemented and tested.

## Threat Flags

No new threat surface introduced. This plan mitigates existing threat T-02-04 (DoS via hanging handler) per the plan's threat register.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `apps/hub/server/api/apps/__tests__/path.spec.ts` exists | FOUND |
| `apps/hub/server/api/apps/[...path].ts` exists | FOUND |
| `.planning/phases/02-apps-plugin-sandbox/02-02-SUMMARY.md` exists | FOUND |
| Commit 11dc477 (test RED) exists | FOUND |
| Commit 610b3cb (feat GREEN) exists | FOUND |
