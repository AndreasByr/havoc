---
phase: 03-auth-session-h-rtung
plan: "04"
subsystem: hub-auth
tags: [security, csrf, session-rotation, documentation, verification]
dependency_graph:
  requires: [03-01-PLAN.md, 03-02-PLAN.md]
  provides: [F-09-closed, F-17-closed, SEC-05-closed]
  affects: [apps/hub/server/middleware/02-csrf-check.ts, apps/hub/server/utils/__tests__/session-rotation.spec.ts]
tech_stack:
  added: []
  patterns: [structural-verification-tests, vi.mock-dependency-isolation]
key_files:
  modified:
    - apps/hub/server/middleware/02-csrf-check.ts
  created:
    - apps/hub/server/utils/__tests__/session-rotation.spec.ts
decisions:
  - "F-17: CSRF origin-skip comment enhanced to include 'intentional exception' language (was present but missing explicit security-gap disclaimer)"
  - "F-09: Closed via structural verification test documenting h3 sealed-cookie architecture — no code change needed"
  - "vi.mock required for auth-session.ts dependencies (drizzle-orm, @guildora/shared) to isolate test in both worktree and main environments"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17T20:26:08Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 1
---

# Phase 03 Plan 04: CSRF Comment + Session-Rotation Verification Summary

One-liner: CSRF skip made explicitly intentional via comment rewrite; session-fixation prevention verified structurally via 2-test spec documenting h3 sealed-cookie architecture.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify/add CSRF skip comment in 02-csrf-check.ts (F-17) | c5fa39f | apps/hub/server/middleware/02-csrf-check.ts |
| 2 | Create session-rotation structural verification test (F-09) | ecf86e8 | apps/hub/server/utils/__tests__/session-rotation.spec.ts |

## Task 1: CSRF Origin-Skip Comment (F-17)

**Status:** Comment was already partially present — enhanced to satisfy all acceptance criteria.

The existing comment at lines 10-12 of `02-csrf-check.ts` already covered:
- SSR-internal requests have no Origin/Referer (present)
- Cross-origin CSRF attacks always carry an Origin header (present)

**Missing:** The explicit "intentional exception — not a security gap" disclaimer required by D-12.

**Action taken (Case B):** Replaced the existing comment with the full plan-specified template that adds: "This is an intentional exception — not a security gap."

Final comment (lines 10-13):
```
// SSR-internal requests originate from the Nitro server itself (e.g. useRequestFetch / $fetch
// on the server side) and carry no Origin or Referer header. Browser-initiated cross-origin
// CSRF attacks always include an Origin header, so this skip is safe for SSR internals.
// This is an intentional exception — not a security gap.
```

**Grep verification:** Both `SSR-internal` (line 10) and `intentional exception` (line 13) present.

## Task 2: Session-Rotation Structural Verification (F-09)

**Status:** Created. 2 tests passing.

**File:** `apps/hub/server/utils/__tests__/session-rotation.spec.ts`

**Architecture documented:**
- `replaceUserSession(event, data)` in h3@1.15.11 calls `session.clear()` + `session.update()`, issuing a completely new HMAC-sealed cookie blob with a new `session.id = crypto.randomUUID()`
- Since nuxt-auth-utils uses sealed cookie sessions (no server-side session store), old cookies are immediately invalidated
- Session fixation is structurally impossible

**Tests:**
1. `replaceUserSession is called during auth session replacement (not mutation)` — verifies `replaceAuthSession` uses the replacement path, not a mutation
2. `replaceAuthSession preserves csrfToken from existing session` — verifies Pitfall 5 prevention: new session carries the existing csrfToken so POST requests don't fail with 403 after login

**Test isolation:** Required `vi.mock` for `../db`, `../community`, `../moderation-rights`, and `@guildora/shared` (same pattern as `auth-session.spec.ts`) to prevent `drizzle-orm` resolution errors.

## Finding Closure

| Finding | Description | Plan | Resolution |
|---------|-------------|------|------------|
| F-17 | CSRF no-origin skip undocumented | 03-04 | Comment added explaining SSR-internal rationale and intentional exception |
| F-09 | Session fixation prevention unverified | 03-04 | Structural verification test documents sealed-cookie architecture |

## SEC-05 Full Closure

SEC-05 (Auth/Session Hardening) covered findings F-02, F-03, F-04, F-07, F-09, F-10, F-17 across plans 03-01 through 03-04:

| Finding | Plan | Topic |
|---------|------|-------|
| F-02 | 03-01 | Cookie security flags (Secure, HttpOnly, SameSite) |
| F-03 | 03-01 | OAuth state parameter validation |
| F-04 | 03-01 | Auth callback URL validation |
| F-07 | 03-02 | Session deny-by-default middleware |
| F-10 | 03-03 | CSRF token generation and validation |
| F-09 | 03-04 | Session rotation (structural verification) |
| F-17 | 03-04 | CSRF origin-skip documentation |

**SEC-05 is now fully closed.**

## Test Results

```
Test Files  33 passed (33)    [+1 new file with 2 new tests]
     Tests  281 passed (281)  [+2 new tests]
```

Full hub test suite green with no regressions.

## Deviations from Plan

**1. [Rule 2 - Enhancement] CSRF comment rewritten (not confirmed as already compliant)**

Task 1 specified "Case A" if the comment was fully compliant. The existing comment covered the security rationale but was missing the "intentional exception" phrasing required by D-12. Applied Case B (rewrite) rather than Case A (confirm).

**2. [Rule 1 - Fix] vi.mock calls required in session-rotation.spec.ts**

The plan's template did not include `vi.mock` calls for auth-session dependencies. Without them, drizzle-orm resolution fails when running from the platform's test environment. Added the same 4 `vi.mock` calls used in `auth-session.spec.ts` to isolate the test correctly.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Files modified are middleware and test files only — no new trust boundary surface.

## Self-Check: PASSED

- [x] `apps/hub/server/middleware/02-csrf-check.ts` — modified, exists on disk
- [x] `apps/hub/server/utils/__tests__/session-rotation.spec.ts` — created, exists on disk
- [x] commit c5fa39f exists: `docs(03-04): add intentional-exception comment to CSRF origin-skip (F-17)`
- [x] commit ecf86e8 exists: `test(03-04): add session-rotation structural verification tests (F-09)`
- [x] Full hub test suite: 281 tests passing, 0 failures
