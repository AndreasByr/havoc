---
phase: 02-apps-plugin-sandbox
plan: 01
subsystem: testing
tags: [vitest, promise-race, timeout, structured-logging, consola, bot, app-hooks]

# Dependency graph
requires: []
provides:
  - "BotAppHookRegistry.emit() with Promise.race() timeout after HOOK_TIMEOUT_MS ms"
  - "Structured logger.warn/error objects for hook.timeout and hook.error events"
  - "Automated tests covering timeout abandonment, structured error logging, and error boundary preservation"
affects: [02-apps-plugin-sandbox]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.race() timeout pattern for async hook execution with clearTimeout cleanup in finally block"
    - "Structured consola log objects { appId, event, durationMs/error } instead of positional string args"
    - "vi.advanceTimersByTimeAsync() for fake-timer tests that interleave with async microtasks"

key-files:
  created: []
  modified:
    - platform/apps/bot/src/utils/app-hooks.ts
    - platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts

key-decisions:
  - "Use vi.advanceTimersByTimeAsync() instead of vi.advanceTimersByTime() — emit() awaits loadAppConfig() before registering the setTimeout, so synchronous timer advancement fires before the timeout is registered"
  - "Timeout detection via error message comparison ('timeout') rather than a sentinel value or separate flag — keeps the race arms strongly typed without extra state"
  - "loadAppConfig() is awaited before entering the Promise.race() — keeps the config-refresh guarantee but means the timeout only covers the handler execution window, not the DB fetch"

patterns-established:
  - "Promise.race timeout: wrap each hook invocation in Promise.race([handler(payload,ctx), timeoutPromise]); detect timeout by error.message === 'timeout'; clear timer in finally"
  - "Structured bot log format: logger.warn/error receives a single object { appId, event, durationMs/error } — no positional string prefix"

requirements-completed: [SEC-02]

# Metrics
duration: 8min
completed: 2026-04-17
---

# Phase 2 Plan 01: Bot App Hook Timeout Summary

**Promise.race() timeout wrapper (5000ms default, env-configurable) added to BotAppHookRegistry.emit() with structured consola log objects replacing the old unstructured "App hook failed" string**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-17T11:24:00Z
- **Completed:** 2026-04-17T11:32:57Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Wrapped every app hook invocation in `Promise.race([handler(payload,ctx), timeoutPromise])` — hanging async handlers are now abandoned after `HOOK_TIMEOUT_MS` ms (default 5000, configurable via `APP_HOOK_TIMEOUT_MS` env var)
- Replaced unstructured `logger.error("App hook failed", { ... })` with structured `logger.warn({ appId, event: "hook.timeout", durationMs })` / `logger.error({ appId, event: "hook.error", error: message })` objects matching D-08 format
- `clearTimeout(timerId!)` in `finally` block prevents timer leaks when handler resolves normally
- Error boundary preserved: each app's hook failure (timeout or throw) is caught independently; subsequent apps still execute
- Extended `app-hooks.spec.ts` with 3 new passing tests (hook.timeout, hook.error, error-boundary-after-timeout); all 14 tests pass (11 existing + 3 new)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **RED — Failing tests** - `fb059e9` (test)
2. **GREEN — Implementation** - `0617843` (feat)

## Files Created/Modified

- `platform/apps/bot/src/utils/app-hooks.ts` — Added `HOOK_TIMEOUT_MS` constant; replaced `emit()` for-loop body with `Promise.race()` timeout pattern; removed old unstructured error log
- `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` — Added `import { logger }` and 3 new test cases; switched to `vi.advanceTimersByTimeAsync()` for correct fake-timer / microtask interleaving

## Decisions Made

- **`vi.advanceTimersByTimeAsync()` over `vi.advanceTimersByTime()`:** `emit()` awaits `loadAppConfig()` (a real Promise/microtask) before registering `setTimeout`. Synchronous `advanceTimersByTime` fires before the timeout is registered; the async variant properly flushes microtasks between timer ticks.
- **Timeout detection via `error.message === "timeout"`:** The `timeoutPromise` rejects with `new Error("timeout")`. This avoids extra sentinel state while keeping both race arms strongly typed.
- **`loadAppConfig` awaited before the race:** The config-refresh guarantee is preserved unchanged. The timeout window covers only handler execution, not the DB config fetch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched to `vi.advanceTimersByTimeAsync()` in timeout tests**
- **Found during:** Task 1 GREEN phase (running tests revealed 2 of 3 new tests timing out)
- **Issue:** Plan specified `vi.advanceTimersByTime(5001)` (synchronous), but `emit()` awaits `loadAppConfig()` before registering the `setTimeout`. Synchronous timer advancement fires before the timeout is registered, so the race never times out — tests hung for 5000ms.
- **Fix:** Changed both timeout tests to use `await vi.advanceTimersByTimeAsync(5001)`, which interleaves timer ticks with microtask resolution.
- **Files modified:** `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts`
- **Verification:** All 14 tests pass; timeout tests complete in <5ms with fake timers
- **Committed in:** `0617843` (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in plan's test helper usage)
**Impact on plan:** Required fix for tests to actually validate the timeout behavior. No scope creep.

## Issues Encountered

- Worktree has no local `node_modules`; tests were run using the main workspace's `node_modules` with `--root` pointing to the worktree directory. The `app-hooks.spec.ts` suite (which mocks all external modules) runs cleanly. Other bot spec files that import `discord.js`/`consola` directly without mocks fail with module-not-found in the worktree context — these are pre-existing worktree infrastructure constraints, not regressions.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The change is entirely within the in-process hook executor.

## Known Stubs

None.

## Next Phase Readiness

- `BotAppHookRegistry.emit()` is now DoS-resistant for slow/hanging async app code (T-02-01 mitigated)
- Synchronous infinite loops still accepted per D-01 (T-02-02 accepted threat — documented in code comment)
- Ready for phase 02-02 (next hardening plan)

## Self-Check: PASSED

- `platform/apps/bot/src/utils/app-hooks.ts` — exists, contains `HOOK_TIMEOUT_MS`, `Promise.race`, `hook.timeout`, `hook.error`
- `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` — exists, contains `hook.timeout` and `hook.error` test cases
- Commit `fb059e9` — exists (RED phase)
- Commit `0617843` — exists (GREEN phase)

---
*Phase: 02-apps-plugin-sandbox*
*Completed: 2026-04-17*
