---
phase: 02-apps-plugin-sandbox
verified: 2026-04-17T13:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification:
  - test: "Run pnpm --filter @guildora/bot test and confirm all tests (including hook.timeout, hook.error, error-boundary tests) pass green"
    expected: "14+ tests pass, including the 3 new timeout/error tests; exit code 0"
    why_human: "Bot test suite cannot run in verification context due to worktree node_modules constraints documented in 02-01-SUMMARY.md"
  - test: "Run pnpm --filter @guildora/hub test and confirm path.spec.ts (route.timeout 504, route.error 500) and audit-log.spec.ts (app.installed x2, app.uninstalled x1) all pass"
    expected: "266+ tests pass across 30 test files; exit code 0"
    why_human: "Hub test suite cannot run in verification context (Nuxt vitest environment requires full platform node_modules)"
---

# Phase 2: Apps-Plugin-Sandbox Verification Report

**Phase Goal:** App-Plugin-Execution-Sites sind gegen reale Risiken (hängende async Handlers, unkontrolliertes Memory-Wachstum) gehärtet; alle Lifecycle-Events sind audit-logbar. Die kritischste bekannte Lücke (kein Execution-Timeout) ist geschlossen.
**Verified:** 2026-04-17T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ein langsamer/hängender async App-Hook wird nach APP_HOOK_TIMEOUT_MS (default 5000 ms) abgebrochen — verifiziert durch dedizierte Spec-Tests in bot und hub | ✓ VERIFIED | `app-hooks.ts` lines 91-113: `Promise.race()` with 5000ms timer; `app-hooks.spec.ts` lines 147-161: `hook.timeout` test; `path.spec.ts` lines 105-144: `route.timeout` test (504) |
| 2 | CPU-/Execution-Timeout ist konfigurierbar via `APP_HOOK_TIMEOUT_MS` env var; Überschreitung führt zu einem sichtbaren Fehler (Fail Loud: hook.timeout / route.timeout geloggt, HTTP 504 zurückgegeben) | ✓ VERIFIED | Both files: `parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10)`; bot logs `logger.warn({ appId, event: "hook.timeout", durationMs })`; hub throws `createError({ statusCode: 504 })` and `console.warn(JSON.stringify({ appId, event: "route.timeout" }))` |
| 3 | Memory-Cap via `--max-old-space-size` ist in beiden App-Prozessen (bot: 512 MB, hub: 1024 MB) in Startup-Scripts dokumentiert und konfiguriert | ✓ VERIFIED | `apps/bot/package.json` start: `NODE_OPTIONS=--max-old-space-size=512`; `apps/hub/package.json` start: `--max-old-space-size=1024`; `apps/hub/Dockerfile` CMD: `["node", "--max-old-space-size=1024", ...]` |
| 4 | Beide Execution-Sites — `app-hooks.ts` und `[...path].ts` — verwenden denselben Promise.race()-Mechanismus mit identischem Log-Format (`{ appId, event, durationMs?, error? }`) | ✓ VERIFIED | Both files: `Promise.race([handler, timeoutPromise])`, `clearTimeout(timerId!)` in finally. Log keys identical: `{ appId, event: "hook.timeout"/"route.timeout", durationMs }` and `{ appId, event: "hook.error"/"route.error", error }` |
| 5 | App-Install/Uninstall-Lifecycle ist in strukturierten Audit-Logs (`app.installed`, `app.uninstalled`) sichtbar — verifiziert durch Hub-Spec-Tests | ✓ VERIFIED | `sideload.post.ts` line 27; `local-sideload.post.ts` line 24; `[id].delete.ts` line 21 — all `console.log(JSON.stringify({appId, event}))`. `audit-log.spec.ts` covers all three. |

**Score:** 5/5 truths verified

### Deferred Items

None. All success criteria are met within this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/bot/src/utils/app-hooks.ts` | BotAppHookRegistry.emit() with Promise.race() + structured logging | ✓ VERIFIED | Contains `HOOK_TIMEOUT_MS`, `Promise.race`, `clearTimeout(timerId!)`, `hook.timeout`, `hook.error`. Old `"App hook failed"` string removed. |
| `apps/bot/src/utils/__tests__/app-hooks.spec.ts` | 3 new tests: hook.timeout, hook.error, error-boundary | ✓ VERIFIED | Lines 147-189: all 3 test cases present, use `vi.advanceTimersByTimeAsync`, assert structured log objects. |
| `apps/hub/server/api/apps/[...path].ts` | Hub route handler with Promise.race() + console.warn/error JSON logging | ✓ VERIFIED | Contains `HOOK_TIMEOUT_MS`, `Promise.race`, `clearTimeout(timerId!)`, `route.timeout`, `route.error`. No consola import. Old `return handler(event)` removed. |
| `apps/hub/server/api/apps/__tests__/path.spec.ts` | New spec covering route.timeout (504) and route.error (500) | ✓ VERIFIED | Created. Contains 2 tests: `route.timeout` asserts 504 + consoleWarnSpy; `route.error` asserts 500 + consoleErrorSpy. |
| `apps/hub/server/api/admin/apps/sideload.post.ts` | app.installed audit log after successful install | ✓ VERIFIED | Line 27: `console.log(JSON.stringify({ appId, event: "app.installed" }))` after `installAppFromUrl()` |
| `apps/hub/server/api/admin/apps/local-sideload.post.ts` | app.installed audit log after successful local install | ✓ VERIFIED | Line 24: `console.log(JSON.stringify({ appId: result.appId, event: "app.installed" }))` |
| `apps/hub/server/api/admin/apps/[id].delete.ts` | app.uninstalled audit log using deleted.appId | ✓ VERIFIED | Line 21: `console.log(JSON.stringify({ appId: deleted.appId, event: "app.uninstalled" }))` — uses text `appId`, not numeric `id` |
| `apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts` | Spec covering app.installed (both paths) and app.uninstalled | ✓ VERIFIED | Created. 3 tests: sideload, local-sideload, delete. Uses `vi.spyOn(console, "log")` + JSON.parse assertion. |
| `apps/bot/package.json` | Memory-capped bot start script | ✓ VERIFIED | `"start": "NODE_OPTIONS=--max-old-space-size=512 node dist/apps/bot/src/index.js"`. Dev script unchanged: `tsx src/index.ts`. |
| `apps/hub/package.json` | Memory-capped hub start script | ✓ VERIFIED | `"start": "node --max-old-space-size=1024 --env-file=../../.env .output/server/index.mjs"`. Dev script unchanged: `nuxt dev`. |
| `apps/hub/Dockerfile` | Memory-capped hub Docker CMD | ✓ VERIFIED | Line 28: `CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]` |
| `platform/.env.example` | APP_HOOK_TIMEOUT_MS documented in Apps/Plugin System section | ✓ VERIFIED | Lines 115-121: New section `─── Apps / Plugin System` with commented-out `APP_HOOK_TIMEOUT_MS=5000` and async-only limitation NOTE. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BotAppHookRegistry.emit()` | `Promise.race([handler(payload,ctx), timeoutPromise])` | `HOOK_TIMEOUT_MS` from `process.env` | ✓ WIRED | Lines 91-113 in `app-hooks.ts` — constant declared at line 13, used at line 95 |
| `app-hooks.spec.ts` | `logger.warn` / `logger.error` assertion | `vi.mocked(logger.warn)` + `hook.timeout` string | ✓ WIRED | Lines 157-159, 170-172: `expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.objectContaining({ event: "hook.timeout" }))` |
| `[...path].ts handler invocation` | `Promise.race([Promise.resolve(handler(event)), timeoutPromise])` | `HOOK_TIMEOUT_MS` from `process.env` | ✓ WIRED | Lines 116-139 in `[...path].ts` — 504 on timeout, 500 on error, `clearTimeout` in finally |
| `path.spec.ts` | `createError` mock (statusCode 504/500) | `stubNuxtAutoImports` + fake timers | ✓ WIRED | Lines 129, 166: `rejects.toMatchObject({ statusCode: 504/500 })` |
| `sideload.post.ts` | `console.log(JSON.stringify({ appId, event: 'app.installed' }))` | after `installAppFromUrl()` resolves | ✓ WIRED | Line 27 — placed between destructuring result and `return` statement |
| `[id].delete.ts` | `console.log(JSON.stringify({ appId: deleted.appId, event: 'app.uninstalled' }))` | after `refreshAppRegistry()`, using `.returning()` result | ✓ WIRED | Line 21 — placed after `refreshAppRegistry()`, before return. Uses `deleted.appId` (text column), not `deleted.id` (numeric). |

### Data-Flow Trace (Level 4)

No dynamic data rendering components involved. All changes are:
- In-process execution guards (Promise.race + clearTimeout) — data flows through the existing handler invocation path
- Structured log emission to stdout — data is already available in scope (`appId`, `error.message`, `HOOK_TIMEOUT_MS`)
- Config-file edits (package.json, Dockerfile, .env.example) — no data flow

Level 4 trace: SKIPPED (no UI components render dynamic data from these changes).

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `HOOK_TIMEOUT_MS` constant in app-hooks.ts | `grep -c "HOOK_TIMEOUT_MS" apps/bot/src/utils/app-hooks.ts` | 2 matches (line 13 + line 95) | ✓ PASS |
| `Promise.race` in app-hooks.ts | `grep -c "Promise.race" apps/bot/src/utils/app-hooks.ts` | 1 match | ✓ PASS |
| `clearTimeout` in app-hooks.ts | `grep "clearTimeout" apps/bot/src/utils/app-hooks.ts` | Match at line 112 | ✓ PASS |
| Old unstructured log removed | `grep "App hook failed" apps/bot/src/utils/app-hooks.ts` | No match | ✓ PASS |
| `HOOK_TIMEOUT_MS` in [...path].ts | `grep -c "HOOK_TIMEOUT_MS" apps/hub/server/api/apps/[...path].ts` | 2 matches | ✓ PASS |
| `Promise.race` in [...path].ts | `grep "Promise.race" apps/hub/server/api/apps/[...path].ts` | Match at line 125 | ✓ PASS |
| Old `return handler(event)` removed | `grep "return handler(event)" apps/hub/server/api/apps/[...path].ts` | No match | ✓ PASS |
| No consola in [...path].ts | `grep "consola" apps/hub/server/api/apps/[...path].ts` | No match | ✓ PASS |
| `app.installed` in sideload.post.ts | `grep "app.installed" apps/hub/server/api/admin/apps/sideload.post.ts` | Match at line 27 | ✓ PASS |
| `app.installed` in local-sideload.post.ts | `grep "app.installed" apps/hub/server/api/admin/apps/local-sideload.post.ts` | Match at line 24 | ✓ PASS |
| `app.uninstalled` in [id].delete.ts | `grep "app.uninstalled" apps/hub/server/api/admin/apps/[id].delete.ts` | Match at line 21 | ✓ PASS |
| `deleted.appId` used (not `deleted.id`) | `grep "deleted.appId" apps/hub/server/api/admin/apps/[id].delete.ts` | Match at line 21 | ✓ PASS |
| `status.put.ts` untouched | `grep "app.installed\|app.uninstalled" apps/hub/server/api/admin/apps/status.put.ts` | No match | ✓ PASS |
| Bot start memory cap | `grep "max-old-space-size=512" apps/bot/package.json` | Match in start script | ✓ PASS |
| Hub start memory cap | `grep "max-old-space-size=1024" apps/hub/package.json` | Match in start script | ✓ PASS |
| Hub Dockerfile memory cap | `grep "max-old-space-size=1024" apps/hub/Dockerfile` | Match at CMD line 28 | ✓ PASS |
| Bot dev script unchanged | `grep '"dev"' apps/bot/package.json` | `tsx src/index.ts` — unchanged | ✓ PASS |
| Hub dev script unchanged | `grep '"dev"' apps/hub/package.json` | `nuxt dev -p 3003` — unchanged | ✓ PASS |
| APP_HOOK_TIMEOUT_MS in .env.example | `grep "APP_HOOK_TIMEOUT_MS" platform/.env.example` | Match at line 121, in new Apps/Plugin System section | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-02 | 02-01, 02-02, 02-03, 02-04 | Apps-Plugin-Code mit Memory-Limit, Execution-Timeout; Zugriff nur über gewhitelistete APIs | PARTIALLY SATISFIED | Execution-Timeout (Promise.race), Memory-cap (--max-old-space-size), audit logs, and whitelisted API access all implemented. Full "echter Sandbox" (isolated-vm / worker threads) is explicitly an accepted threat (D-01) — not claimed in phase goal or SCs. Phase satisfies all 5 roadmap SCs. SEC-02 checkbox in REQUIREMENTS.md remains pending (full sandbox would require isolated-vm — deferred to future milestone). |

**SEC-02 partial satisfaction note:** The REQUIREMENTS.md says "echter Sandbox mit CPU-Limit" — CPU limiting (true isolate-level CPU cap) is not achievable via `Promise.race()` alone (synchronous loops are not interruptible). This is an explicitly accepted threat per the phase threat model (T-02-02, T-02-05), documented in code comments. Phase 2 was never scoped to deliver full process isolation; the phase goal and all 5 roadmap SCs are satisfied. The SEC-02 requirement in REQUIREMENTS.md will remain unchecked until a future phase adds isolated-vm or Worker Thread sandboxing.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/bot/src/utils/app-hooks.ts` | 152-158 | `logger.warn(\`Skipping app hooks for ${...}\`)` — positional string format in `loadInstalledAppHooks` (different function, not part of this phase's scope) | ℹ️ Info | Pre-existing inconsistency outside this phase's change boundary; does not block goal |

No new blockers or warnings introduced. The pre-existing positional log in `loadInstalledAppHooks` was not modified by this phase (only `emit()` was changed) and is out of scope.

### Human Verification Required

#### 1. Bot Test Suite Pass

**Test:** Run `cd /home/andreas/workspace/guildora/platform && pnpm --filter @guildora/bot test -- --reporter=verbose`
**Expected:** All 14+ tests pass including the 3 new tests (`hook.timeout`, `hook.error`, `error boundary preserved after timeout`); exit code 0
**Why human:** Bot vitest suite requires the full platform `node_modules` tree (discord.js, consola) which cannot run inside this verification agent context. The SUMMARY documents that all 14 tests passed (11 existing + 3 new). Code-level verification confirms the test cases and implementation are correctly wired, but execution must be confirmed by the developer.

#### 2. Hub Test Suite Pass

**Test:** Run `cd /home/andreas/workspace/guildora/platform && pnpm --filter @guildora/hub test -- --reporter=verbose`
**Expected:** All 266+ tests pass across 30 test files, including `path.spec.ts` (2 tests: route.timeout 504, route.error 500) and `audit-log.spec.ts` (3 tests: sideload app.installed, local-sideload app.installed, delete app.uninstalled); exit code 0
**Why human:** Hub vitest environment (Nuxt/Nitro module resolution, `stubNuxtAutoImports`) requires the full platform build context. The SUMMARY documents 266 tests passed across 30 files after all changes.

### Gaps Summary

No gaps blocking goal achievement. All 5 roadmap success criteria are met by the actual codebase:

1. Both execution sites (`app-hooks.ts` and `[...path].ts`) implement `Promise.race()` timeout with identical log key format
2. `APP_HOOK_TIMEOUT_MS` is read from env with parseInt, defaults to 5000ms, documented in `.env.example`
3. Memory caps (`--max-old-space-size=512/1024`) are set in all 3 startup locations: bot `package.json`, hub `package.json`, hub `Dockerfile`
4. Structured audit logs (`app.installed`, `app.uninstalled`) are wired into all 3 admin lifecycle routes
5. TDD test coverage exists for all new behaviors (5 new spec files / test additions across 4 plans)

The `human_needed` status reflects that test suite execution cannot be verified programmatically in this context — the code-level evidence strongly supports that tests pass, and the SUMMARY documents confirm 266 hub tests and 14 bot tests all green.

---

_Verified: 2026-04-17T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
