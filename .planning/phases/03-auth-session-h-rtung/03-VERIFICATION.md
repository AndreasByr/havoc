---
phase: 03-auth-session-h-rtung
verified: 2026-04-17T22:00:00Z
status: passed
score: 4/4 success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Matrix-Bot internal HTTP server silently accepted all requests when BOT_INTERNAL_TOKEN was empty — replaced conditional auth bypass with fail-loud 503 MISCONFIGURED guard (CR-01, plan 03-05)"
  gaps_remaining: []
  regressions: []
---

# Phase 3: Auth- & Session-Härtung Verification Report

**Phase Goal:** Die Authentifizierungs- und Session-Schicht im Hub ist deny-by-default, timing-sicher und gegen gängige Angriffsklassen (CSRF, Session-Fixation, Timing-Attacks) gehärtet.
**Verified:** 2026-04-17T22:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 03-05 addressed CR-01)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All token comparisons in hub/server/ and bot/src/ use crypto.timingSafeEqual — no string-equality on secrets | ✓ VERIFIED | `internal-auth.ts`: `import crypto from "node:crypto"` + `timingSafeEqualString` (2 occurrences), `!timingSafeEqualString(token, expectedToken)` in place; old `token !== expectedToken` absent. Matrix-bot `internal-sync-server.ts`: same wrapper pattern (2 occurrences). Old `authHeader !== \`Bearer ${token}\`` absent. Grep over hub/server/ and bot/src/ returns zero string-equality hits on secrets. |
| 2 | A new /api/ route without an explicit Public-Marker is blocked by session middleware — verified by test hitting /api/dashboard and receiving 401 | ✓ VERIFIED | `session.spec.ts` line 25–29: test "throws 401 for unauthenticated requests to non-public /api/ routes" creates mock event for `/api/dashboard`, asserts `rejects.toMatchObject({ statusCode: 401 })`. `03-session.ts` throws `createError({ statusCode: 401, statusMessage: "Authentication required." })` for any non-PUBLIC_PATHS /api/ request with no valid session. |
| 3 | Public routes set is explicitly declared as allow-list in code; everything else is auth-required by default | ✓ VERIFIED | `03-session.ts` defines `const PUBLIC_PATHS = [...]` with 7 explicit entries (`/api/public/`, `/api/auth/`, `/api/csrf-token`, `/api/setup/`, `/api/theme.get`, `/api/apply/`, `/api/internal/`) each with an explanatory comment. `locale-context.get.ts` has `requireSession(event)` as first handler statement (not in PUBLIC_PATHS — uses its own auth guard per D-03). |
| 4 | Session cookies have HttpOnly, Secure (production), SameSite set; session-ID rotates after login; CSRF covers state-changing routes — verified through review with file references | ✓ VERIFIED | Cookie flags in `nuxt.config.ts` line 38–40: `sameSite: "lax"`, `httpOnly: true`, `secure: process.env.NODE_ENV !== "development"`. Session rotation: `session-rotation.spec.ts` verifies `replaceUserSession` is called (not mutation) and csrfToken is preserved. CSRF: `02-csrf-check.ts` has "intentional exception" comment at line 13. Matrix-Bot gap now closed: `internal-sync-server.ts` line 69 has `if (!token \|\| token.length === 0)` returning 503 MISCONFIGURED before any routing — no silent auth bypass when token is empty. |

**Score:** 4/4 success criteria verified

### Gap Closure Record

| Gap | Previous Status | Current Status | Evidence |
|-----|----------------|----------------|----------|
| CR-01: Matrix-Bot silent auth bypass when BOT_INTERNAL_TOKEN is empty | FAILED — `if (token && token.length > 0)` wrapped entire auth block; empty token skipped all auth | ✓ CLOSED | `internal-sync-server.ts` line 69: `if (!token \|\| token.length === 0)` returns 503 MISCONFIGURED before routing. Old bypass wrapper absent. Two new tests in `describe("internal sync server — misconfigured (empty token)")` verify both 503 cases. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/apps/hub/server/utils/internal-auth.ts` | timing-safe requireInternalToken() using timingSafeEqualString | ✓ VERIFIED | Contains `import crypto from "node:crypto"`, `function timingSafeEqualString`, `!timingSafeEqualString(token, expectedToken)` |
| `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts` | Unit tests including equal-length wrong-token case | ✓ VERIFIED | Contains "equal-length wrong token still rejected" test case |
| `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` | timing-safe auth block + fail-loud 503 when token empty | ✓ VERIFIED | `timingSafeEqualString` defined and used. `if (!token \|\| token.length === 0)` returns 503 before routing. Old conditional bypass absent. |
| `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts` | Integration tests: same-length wrong token + 503 MISCONFIGURED | ✓ VERIFIED | Contains timing-safe test and 2 new MISCONFIGURED tests in separate describe block |
| `platform/apps/hub/server/middleware/03-session.ts` | deny-by-default session middleware with PUBLIC_PATHS | ✓ VERIFIED | Contains `const PUBLIC_PATHS = [` (7 entries), `PUBLIC_PATHS.some`, `throw createError({ statusCode: 401` |
| `platform/apps/hub/server/api/internal/locale-context.get.ts` | requireSession() guard at top of handler | ✓ VERIFIED | Contains `import { requireSession }` and `const session = await requireSession(event)` as first handler statement; no `EventUserSession` type |
| `platform/apps/hub/server/middleware/__tests__/session.spec.ts` | Tests: deny-by-default 401, PUBLIC_PATHS pass-through, non-/api/ pass-through | ✓ VERIFIED | Contains `describe("03-session middleware"` with 10 tests covering all scenarios |
| `platform/apps/hub/server/utils/__tests__/session-middleware.spec.ts` | Updated tests aligned with deny-by-default (no old graceful-degradation assertions) | ✓ VERIFIED | No `resolves.not.toThrow` or old `toBeNull` assertions for unauthenticated paths |
| `platform/apps/hub/server/api/dev/switch-user.post.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | `if (!import.meta.dev)` on line 11, before requireSession |
| `platform/apps/hub/server/api/dev/restore-user.post.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | Guard on line 6, before requireSession |
| `platform/apps/hub/server/api/dev/users.get.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | Guard on line 8, before requireSession |
| `platform/apps/hub/server/utils/dev-role-switcher.ts` | isDevRoleSwitcherEnabled returns import.meta.dev only | ✓ VERIFIED | Returns `import.meta.dev` only; no `enablePerformanceDebug`, no `NODE_ENV === "development"` fallback |
| `platform/apps/hub/nuxt.config.ts` | Cookie secure = NODE_ENV !== development | ✓ VERIFIED | `secure: process.env.NODE_ENV !== "development"` on line 40; no `NUXT_SESSION_COOKIE_SECURE` or URL heuristic |
| `platform/apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts` | Architecture documentation test for import.meta.dev guards | ✓ VERIFIED | File exists; contains `describe("Dev endpoint guards"` with grep-based assertions |
| `platform/apps/hub/server/__tests__/cookie-secure.spec.ts` | Architecture documentation test for cookie-secure config | ✓ VERIFIED | File exists; contains `describe("Cookie secure configuration"` |
| `platform/apps/hub/server/middleware/02-csrf-check.ts` | Explanatory comment for no-origin/no-referer CSRF skip | ✓ VERIFIED | Lines 10–13 contain "SSR-internal" and "This is an intentional exception — not a security gap." |
| `platform/apps/hub/server/utils/__tests__/session-rotation.spec.ts` | Structural verification test for session rotation (F-09) | ✓ VERIFIED | File exists; contains `describe("Session rotation (F-09 structural verification)")` with 2 tests verifying replaceUserSession is called and csrfToken is preserved |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `internal-auth.ts` | `node:crypto` | `import crypto from 'node:crypto'` | ✓ WIRED | `timingSafeEqualString` uses `crypto.timingSafeEqual`; no unsafe comparison remains |
| `matrix-bot/internal-sync-server.ts` | `node:crypto` | `import crypto from 'node:crypto'` | ✓ WIRED | `timingSafeEqualString` helper defined and called in auth block |
| `03-session.ts` | `PUBLIC_PATHS` | `PUBLIC_PATHS.some(p => event.path.startsWith(p))` | ✓ WIRED | Allow-list used at line 19 before 401 guard |
| `locale-context.get.ts` | `auth.ts requireSession` | `requireSession(event)` | ✓ WIRED | Import and call both present; first statement in handler |
| `matrix-bot/internal-sync-server.ts` | fail-loud 503 guard | `if (!token \|\| token.length === 0)` | ✓ WIRED | Guard at line 69 before any routing; old bypass pattern absent |
| `nuxt.config.ts` | `runtimeConfig.session.cookie.secure` | `secure: process.env.NODE_ENV !== "development"` | ✓ WIRED | Line 40; no NUXT_SESSION_COOKIE_SECURE or URL heuristic |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-03 | 03-01-PLAN, 03-05-PLAN | All internal token comparisons use crypto.timingSafeEqual; fail-loud when unconfigured | ✓ SATISFIED | Hub `internal-auth.ts` and Matrix-Bot `internal-sync-server.ts` both use `timingSafeEqualString` wrapping `crypto.timingSafeEqual`. Matrix-Bot now has fail-loud 503 guard when token is empty (CR-01 closed). No string-equality on secrets found via grep across hub/server/ and bot/src/. |
| SEC-04 | 03-02-PLAN | Session middleware deny-by-default; public routes explicitly marked | ✓ SATISFIED | `03-session.ts` with `PUBLIC_PATHS` allow-list and 401 enforcement. `locale-context.get.ts` guarded with `requireSession()`. 10 new session tests, 6 updated session-middleware tests. |
| SEC-05 | 03-03-PLAN, 03-04-PLAN | Auth/OAuth hardening: cookie flags, CSRF, session rotation, dev endpoints | ✓ SATISFIED | Findings F-07 (dev endpoints), F-09 (session rotation), F-10 (cookie secure), F-17 (CSRF comment) all addressed. Cookie flags confirmed. Dev endpoints guarded with build-time `import.meta.dev`. CSRF comment present. Session rotation structurally verified. |

### Anti-Patterns Found

No blockers or warnings found in the phase-modified files. All changed files contain substantive security mitigations with no TODO/FIXME/PLACEHOLDER markers.

### Behavioral Spot-Checks

Static spot-checks performed (Step 7b: runtime checks skipped — auth middleware and config files are not runnable entry points):

| Check | Result | Status |
|-------|--------|--------|
| `token !== expectedToken` absent in hub/server/ | 0 matches | ✓ PASS |
| `authHeader !== \`Bearer ${token}\`` absent in matrix-bot/ | 0 matches | ✓ PASS |
| Old `if (token && token.length > 0)` bypass absent in matrix-bot | 0 matches | ✓ PASS |
| Fail-loud 503 guard present in matrix-bot | 1 match (line 69) | ✓ PASS |
| `PUBLIC_PATHS` in 03-session.ts | 3+ matches | ✓ PASS |
| 401 deny-by-default in 03-session.ts | 1 match | ✓ PASS |
| `NODE_ENV !== "development"` for cookie secure in nuxt.config.ts | 1 match (line 40) | ✓ PASS |
| `NUXT_SESSION_COOKIE_SECURE` absent from nuxt.config.ts | 0 matches | ✓ PASS |
| `enablePerformanceDebug` absent from dev-role-switcher.ts | 0 matches | ✓ PASS |
| "intentional exception" comment in 02-csrf-check.ts | 1 match (line 13) | ✓ PASS |
| `replaceUserSession` in session-rotation.spec.ts | Found in test assertions | ✓ PASS |
| 503 test count in internal-sync-server.spec.ts | 5 matches | ✓ PASS |

### Human Verification Required

None. All must-haves were verifiable programmatically via static code analysis. The gap (CR-01) is closed by a structural code change and two new test cases, both confirmed present in the actual files.

### Gaps Summary

No gaps remain. The single gap from the previous verification (CR-01: Matrix-Bot silent auth bypass when BOT_INTERNAL_TOKEN is empty) has been fully resolved by plan 03-05:

- `internal-sync-server.ts` line 69: `if (!token || token.length === 0)` returns 503 MISCONFIGURED before any routing — mirrors Hub's `requireInternalToken()` pattern exactly.
- Two new tests in `describe("internal sync server — misconfigured (empty token)")` cover both the configured-token-with-any-auth and no-header cases.
- The old conditional wrapper `if (token && token.length > 0)` is absent.

All 4 ROADMAP success criteria for Phase 3 are now verified. Requirements SEC-03, SEC-04, and SEC-05 are satisfied.

---

_Verified: 2026-04-17T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
