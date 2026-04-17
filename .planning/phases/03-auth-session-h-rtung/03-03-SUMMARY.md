---
phase: 03-auth-session-h-rtung
plan: "03"
subsystem: hub
tags: [security, dev-endpoints, cookie, auth, import.meta.dev]
requires: [03-01-PLAN.md, 03-02-PLAN.md]
provides: [F-07-closure, F-10-closure, SEC-05-partial]
affects: [apps/hub/server/api/dev, apps/hub/server/utils/dev-role-switcher.ts, apps/hub/nuxt.config.ts]
tech-stack:
  added: []
  patterns: [import.meta.dev-guard, grep-based-doc-test]
key-files:
  created:
    - apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts
    - apps/hub/server/__tests__/cookie-secure.spec.ts
  modified:
    - apps/hub/server/api/dev/switch-user.post.ts
    - apps/hub/server/api/dev/restore-user.post.ts
    - apps/hub/server/api/dev/users.get.ts
    - apps/hub/server/utils/dev-role-switcher.ts
    - apps/hub/nuxt.config.ts
    - .planning/phases/03-auth-session-h-rtung/03-VALIDATION.md
decisions:
  - "Documentation tests (grep-based) are the correct verification method for import.meta.dev guards: the constant is always undefined in Vitest (never replaced by Vite), so unit tests cannot test the dev=true branch"
  - "Cookie secure uses NODE_ENV !== 'development' rather than URL heuristic: explicit, predictable, and not dependent on NUXT_PUBLIC_HUB_URL being set correctly"
  - "isDevRoleSwitcherEnabled simplified to return import.meta.dev only: removes enablePerformanceDebug and NODE_ENV fallbacks which could bypass the guard in production"
metrics:
  duration: "~11 minutes"
  completed: "2026-04-17T20:27:59Z"
  tasks_completed: 3
  files_modified: 6
  files_created: 2
---

# Phase 03 Plan 03: Dev Endpoint Hardening + Cookie Secure Summary

Import.meta.dev build-time guard added to three dev API handlers, cookie secure flag replaced with NODE_ENV check, and grep-based documentation tests created to verify both hardening measures.

## What Was Done

### Task 1: import.meta.dev guards + isDevRoleSwitcherEnabled fix (F-07)

Added `if (!import.meta.dev) { throw createError({ statusCode: 404, statusMessage: "Not Found." }); }` as the first statement in three dev API handlers:

- `apps/hub/server/api/dev/switch-user.post.ts` (line 11)
- `apps/hub/server/api/dev/restore-user.post.ts` (line 6)
- `apps/hub/server/api/dev/users.get.ts` (line 8)

Simplified `isDevRoleSwitcherEnabled` in `dev-role-switcher.ts`:
- Removed `|| process.env.NODE_ENV === "development"` fallback
- Removed `|| Boolean(config.public.enablePerformanceDebug)` fallback
- Function now returns `import.meta.dev` only
- Renamed parameter to `_event` (unused after removing `useRuntimeConfig` call)

Commit: `09464bd`

### Task 2: Cookie Secure flag fix (F-10)

Replaced 3-line URL heuristic in `apps/hub/nuxt.config.ts` (lines 40-42):

```typescript
// Before (UNSAFE — depends on NUXT_PUBLIC_HUB_URL being set correctly):
secure: process.env.NUXT_SESSION_COOKIE_SECURE
  ? process.env.NUXT_SESSION_COOKIE_SECURE !== "false"
  : (process.env.NUXT_PUBLIC_HUB_URL || "").startsWith("https://"),

// After (correct — always true in prod, always false in dev):
secure: process.env.NODE_ENV !== "development",
```

Removed `NUXT_SESSION_COOKIE_SECURE` env var dependency entirely.

Commit: `62a7fda`

### Task 3: Documentation tests + VALIDATION.md update

Created two documentation test files that use `readFileSync` to assert source patterns exist:

**`apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts`** (4 tests):
- Verifies `!import.meta.dev` guard appears before `requireSession(event)` call in all three handlers
- Verifies `isDevRoleSwitcherEnabled` body contains `return import.meta.dev` and no `enablePerformanceDebug`

**`apps/hub/server/__tests__/cookie-secure.spec.ts`** (1 test):
- Verifies `nuxt.config.ts` contains `process.env.NODE_ENV !== "development"` for cookie secure
- Verifies `NUXT_SESSION_COOKIE_SECURE` is gone
- Verifies old `NUXT_PUBLIC_HUB_URL || "").startsWith("https://")` heuristic is gone

Updated `03-VALIDATION.md`:
- `nyquist_compliant: false` → `nyquist_compliant: true`
- `wave_0_complete: false` → `wave_0_complete: true`
- Rows 3-03-01 and 3-03-02: `❌ W0` → `✅`
- Wave 0 Requirements: dev-endpoints and cookie-secure items checked off with rationale notes

Commit: `777150d`

## Security Findings Closed

| Finding | Status | Method |
|---------|--------|--------|
| F-07: Dev endpoints activatable via enablePerformanceDebug in prod | Closed | import.meta.dev build-time guard (first statement in handler) |
| F-10: Cookie secure derived from URL heuristic (silent false fallback) | Closed | NODE_ENV !== "development" (explicit, predictable) |

**SEC-05 partial closure:** F-07 and F-10 closed in this plan. F-09 (session rotation) and F-17 (CSRF-skip comment) are in plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect relative paths in documentation test specs**

- **Found during:** Task 3 — running tests in worktree revealed path errors
- **Issue:** Plan-provided `HUB_ROOT` paths were off by one directory level. `resolve(__dirname, "../../..")` from `server/__tests__/` resolves to `apps/` not `apps/hub/`. `resolve(__dirname, "../../../../..")` from `server/api/dev/__tests__/` resolves to `apps/` not `apps/hub/`.
- **Fix:** Changed `../../..` → `../..` in cookie-secure.spec.ts; changed `../../../../..` → `../../../..` in dev-endpoints.spec.ts
- **Files modified:** both new spec files
- **Commit:** included in `777150d`

**2. [Rule 1 - Bug] Fixed imprecise requireSession lookup in dev-endpoints test**

- **Found during:** Task 3 — test assertion `guardIndex < requireSessionIndex` failed because `indexOf("requireSession")` finds the import statement at the top of the file, not the function call in the handler body
- **Fix:** Changed lookup to `indexOf("requireSession(event)")` which finds only the call site (after the guard)
- **Files modified:** dev-endpoints.spec.ts
- **Commit:** included in `777150d`

**3. [Rule 1 - Bug] Fixed overly broad cookie-secure assertion matching unrelated startsWith**

- **Found during:** Task 3 — assertion `not.toContain("startsWith(\"https://\")")` failed because `nuxt.config.ts` line 6 uses `hubUrl.startsWith("https://")` for HMR tunnel detection (unrelated to cookies)
- **Fix:** Changed to `not.toContain('NUXT_PUBLIC_HUB_URL || "").startsWith("https://")')` which matches the specific old cookie heuristic pattern
- **Files modified:** cookie-secure.spec.ts
- **Commit:** included in `777150d`

**4. [Rule 2 - Missing functionality] Removed NODE_ENV/enablePerformanceDebug words from dev-role-switcher comment**

- **Found during:** Task 1 — acceptance criteria greps for `enablePerformanceDebug` and `NODE_ENV` are exact string matches; initial comment contained those words
- **Fix:** Rephrased comment to "Do NOT add runtime fallbacks here (env-var checks, feature flags, etc.)" — same intent without the literal strings
- **Files modified:** dev-role-switcher.ts
- **Commit:** included in `09464bd`

## Known Stubs

None — all changes are complete hardening mitigations with no stubs or placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All changes narrow the attack surface.

## Self-Check: PASSED

All files confirmed present. All commits confirmed in git log.

| File | Status |
|------|--------|
| apps/hub/server/api/dev/switch-user.post.ts | FOUND |
| apps/hub/server/api/dev/restore-user.post.ts | FOUND |
| apps/hub/server/api/dev/users.get.ts | FOUND |
| apps/hub/server/utils/dev-role-switcher.ts | FOUND |
| apps/hub/nuxt.config.ts | FOUND |
| apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts | FOUND |
| apps/hub/server/__tests__/cookie-secure.spec.ts | FOUND |
| .planning/phases/03-auth-session-h-rtung/03-VALIDATION.md | FOUND |

| Commit | Task | Status |
|--------|------|--------|
| 09464bd | Task 1 — import.meta.dev guards + isDevRoleSwitcherEnabled | FOUND |
| 62a7fda | Task 2 — cookie secure NODE_ENV fix | FOUND |
| 777150d | Task 3 — documentation tests + VALIDATION.md | FOUND |
