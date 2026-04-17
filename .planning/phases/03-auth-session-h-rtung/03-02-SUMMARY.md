---
phase: 03-auth-session-h-rtung
plan: "02"
subsystem: hub-server-middleware
tags: [security, auth, session, middleware, deny-by-default]
dependency_graph:
  requires: []
  provides: [deny-by-default-session-middleware, locale-context-auth-guard]
  affects: [hub-api-routes, hub-session-middleware, hub-locale-context]
tech_stack:
  added: []
  patterns: [deny-by-default, PUBLIC_PATHS-allow-list, requireSession-guard]
key_files:
  created:
    - apps/hub/server/middleware/__tests__/session.spec.ts
  modified:
    - apps/hub/server/middleware/03-session.ts
    - apps/hub/server/api/internal/locale-context.get.ts
    - apps/hub/server/utils/__tests__/session-middleware.spec.ts
decisions:
  - "/api/internal/ added to PUBLIC_PATHS because requireInternalToken() handles its own auth — no session gap"
  - "locale-context.get.ts gets requireSession() per D-03; composable try/catch ensures graceful degradation on unauthenticated SSR pages"
  - "console.warn retained for session parse errors before throwing 401 — visible in logs per Fail Loud constraint"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_changed: 4
requirements:
  - SEC-04
---

# Phase 03 Plan 02: Deny-by-Default Session Middleware Summary

**One-liner:** Rewrote 03-session.ts with PUBLIC_PATHS deny-by-default 401 enforcement and added requireSession() guard to locale-context.get.ts, closing security finding F-02.

## What Was Built

### Task 1: Deny-by-Default Session Middleware (TDD)

**File rewritten:** `apps/hub/server/middleware/03-session.ts`

The old 9-line middleware silently set `event.context.userSession = null` for unauthenticated requests, leaving every new /api/ route open by default. The new middleware:

1. Defines a `PUBLIC_PATHS` constant with 7 explicit allow-list entries
2. Returns early for non-/api/ paths (SSR pages, assets unaffected)
3. Returns early for any path matching PUBLIC_PATHS
4. Calls `getUserSession()` and attaches result to `event.context.userSession`
5. Throws `createError({ statusCode: 401 })` if `userSession?.user?.id` is falsy

**PUBLIC_PATHS as implemented:**
```typescript
const PUBLIC_PATHS = [
  "/api/public/",    // branding, footer-pages, landing (public community data)
  "/api/auth/",      // OAuth callbacks, logout, platform list, dev-login
  "/api/csrf-token", // CSRF token initialisation (before login)
  "/api/setup/",     // Setup wizard (runs before first auth is configured)
  "/api/theme.get",  // Public theming data
  "/api/apply/",     // Application-flow uploads (own token auth via verifyAndLoadToken)
  "/api/internal/",  // MCP internal endpoints (requireInternalToken as their own auth)
];
```

**New test file created:** `apps/hub/server/middleware/__tests__/session.spec.ts`
- 10 tests covering: unauthenticated deny, all 7 PUBLIC_PATHS pass-through, non-/api/ pass-through, authenticated pass

**Updated test file:** `apps/hub/server/utils/__tests__/session-middleware.spec.ts`
- Removed 3 old graceful-degradation assertions that contradicted deny-by-default:
  - "sets event.context.userSession to null when session validation fails"
  - "does not throw when getUserSession throws (graceful degradation)"
  - "handles empty session object from getUserSession"
- Replaced with deny-by-default assertions (throw 401, empty session → 401)
- Added: "passes through requests to /api/public/ without calling getUserSession"
- Total: 6 tests (was 6, content changed)

**TDD gate compliance:**
- RED: 9/10 session.spec.ts tests failed with old middleware (expected)
- GREEN: All 16 tests (10 + 6) pass after middleware rewrite

### Task 2: requireSession() Guard on locale-context.get.ts

**File modified:** `apps/hub/server/api/internal/locale-context.get.ts`

- Added `import { requireSession } from "../../utils/auth";`
- Added `const session = await requireSession(event);` as first handler statement
- Removed `EventUserSession` local type definition (redundant)
- Removed `event.context.userSession` direct access
- Simplified `userId` extraction: `session.user.id` (guaranteed non-null by requireSession)

**Caller safety analysis (RESEARCH.md Open Question #2 — RESOLVED):**
- `useLocaleContext.ts` wraps the fetch in `try { ... } catch { return null }` (line 27)
- `locale.global.ts` falls back to `localeCookie.value ?? getPathLocale(to.path)` when null
- Unauthenticated SSR pages degrade gracefully — locale still resolves from cookie or URL
- Adding requireSession() is confirmed safe

## Test Counts

| Suite | Before | After |
|-------|--------|-------|
| session.spec.ts (new) | 0 | 10 |
| session-middleware.spec.ts | 6 | 6 (content updated) |
| Hub server unit tests total | 268 | 268 |

All 268 hub server unit tests pass after both changes.

## Security Findings Closed

| Finding | Description | Status |
|---------|-------------|--------|
| F-02 | Middleware allows unauthenticated access to non-public /api/ routes | CLOSED |
| T-03-02-01 | 03-session.ts missing deny-by-default | MITIGATED |
| T-03-02-02 | locale-context.get.ts has no auth guard | MITIGATED |
| T-03-02-03 | Future /api/ routes open by default | MITIGATED (PUBLIC_PATHS acts as explicit register) |
| T-03-02-04 | Session middleware could block SSR pages | ACCEPTED (non-/api/ early return) |

**SEC-04: CLOSED** — Deny-by-default session enforcement implemented and tested.

## Commits

| Hash | Description |
|------|-------------|
| dbc8fa2 | feat(03-02): deny-by-default session middleware with PUBLIC_PATHS allow-list |
| 51f5254 | feat(03-02): add requireSession() guard to locale-context.get.ts (D-03) |

## Deviations from Plan

None — plan executed exactly as written. The PUBLIC_PATHS list, middleware logic, test structure, and locale-context changes all match the plan specification.

## Known Stubs

None.

## Threat Flags

None — changes align exactly with the plan's threat model. No new network endpoints, auth paths, or trust boundaries introduced beyond what was planned.

## Self-Check: PASSED

- [x] `apps/hub/server/middleware/03-session.ts` exists and contains `PUBLIC_PATHS` and `statusCode: 401`
- [x] `apps/hub/server/middleware/__tests__/session.spec.ts` exists with `describe("03-session middleware"`
- [x] `apps/hub/server/utils/__tests__/session-middleware.spec.ts` does NOT contain `resolves.not.toThrow` or `toBeNull`
- [x] `apps/hub/server/api/internal/locale-context.get.ts` contains `requireSession` (import + call)
- [x] `apps/hub/server/api/internal/locale-context.get.ts` does NOT contain `EventUserSession`
- [x] Commits dbc8fa2 and 51f5254 exist in git log
- [x] 268 hub server unit tests pass
