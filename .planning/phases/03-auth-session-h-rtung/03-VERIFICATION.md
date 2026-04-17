---
phase: 03-auth-session-h-rtung
verified: 2026-04-17T21:00:00Z
status: gaps_found
score: 3/4 success criteria verified
overrides_applied: 0
gaps:
  - truth: "Session-Cookies have HttpOnly, Secure (in Production), and SameSite set; Session-ID rotates after successful login; CSRF protection covers all state-changing routes — verified through a review section in docs/ or .planning/research/ note with file references"
    status: partial
    reason: "Cookie flags (HttpOnly, SameSite=lax, Secure=NODE_ENV!='development') are correctly set in nuxt.config.ts. Session rotation is structurally verified via session-rotation.spec.ts. CSRF is documented. However, the Matrix-Bot auth guard (internal-sync-server.ts line 69) silently disables auth when BOT_INTERNAL_TOKEN is empty, violating the 'Fail Loud, Never Fake' constraint. This is a post-execution finding from the code reviewer (03-REVIEW.md CR-01). The 03-session.ts correctly enforces deny-by-default for Hub API routes, but the Matrix-Bot has a bypass path."
    artifacts:
      - path: "platform/apps/matrix-bot/src/utils/internal-sync-server.ts"
        issue: "Auth block wrapped in 'if (token && token.length > 0)' — empty token silently skips auth; all requests accepted when BOT_INTERNAL_TOKEN is unset. Hub's requireInternalToken() throws 503 in this case; Matrix-Bot does the opposite."
    missing:
      - "Replace 'if (token && token.length > 0) { auth check }' pattern with fail-loud check: if (!token) return 503 MISCONFIGURED, else enforce auth unconditionally"
      - "Add test for empty-token misconfiguration (analogous to Hub's 'returns 503 when token not configured' test)"
---

# Phase 3: Auth- & Session-Härtung Verification Report

**Phase Goal:** Close all SEC-03, SEC-04, SEC-05 security findings with verified, testable mitigations. No unsafe token comparisons, no open-by-default API routes, no dev-only endpoints reachable in production.
**Verified:** 2026-04-17T21:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All Token-Vergleiche in hub/server/ and bot/src/ use crypto.timingSafeEqual — no string-equality on secrets | ✓ VERIFIED | `internal-auth.ts` has `timingSafeEqualString` using `crypto.timingSafeEqual`; unsafe `token !== expectedToken` removed. Matrix-bot `internal-sync-server.ts` has same wrapper; unsafe `authHeader !== \`Bearer ${token}\`` removed. Both have `import crypto from "node:crypto"`. Tests confirmed: 6 hub internal-auth tests, 9 matrix-bot sync tests. |
| 2 | A new /api/ route without explicit Public-Marker is blocked by session middleware (deny-by-default) | ✓ VERIFIED | `03-session.ts` rewritten with `PUBLIC_PATHS` constant (7 entries) and `throw createError({ statusCode: 401 })` for any unauthenticated non-public /api/ request. `session.spec.ts` verifies this with 10 tests including "throws 401 for unauthenticated requests to non-public /api/ routes" using `/api/dashboard`. Commits: dbc8fa2, 51f5254. |
| 3 | Public routes set is explicitly declared as allow-list in code; everything else is auth-required by default | ✓ VERIFIED | `PUBLIC_PATHS` constant in `03-session.ts` lists 7 explicit paths. `locale-context.get.ts` has `requireSession(event)` as first handler statement (not in PUBLIC_PATHS). No `EventUserSession` type or `event.context.userSession` direct access remaining. |
| 4 | Session cookies have HttpOnly, Secure (in production), SameSite set; session-ID rotates after login; CSRF covers state-changing routes — verified through review with file references | ✗ FAILED (partial) | Cookie flags confirmed: nuxt.config.ts has `sameSite: "lax"`, `httpOnly: true`, `secure: process.env.NODE_ENV !== "development"`. Session rotation: structurally verified via `session-rotation.spec.ts`. CSRF: `02-csrf-check.ts` has "intentional exception" comment. Research documented in `03-RESEARCH.md` with file references. **BUT:** Matrix-bot auth guard silently bypasses all auth when `BOT_INTERNAL_TOKEN` is empty (CR-01 in `03-REVIEW.md`) — violates "Fail Loud, Never Fake" constraint and leaves the Matrix-Bot internal HTTP server fully open when misconfigured. |

**Score:** 3/4 truths verified

### Deferred Items

None — all phase 3 scope items have been addressed or are gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/apps/hub/server/utils/internal-auth.ts` | timing-safe requireInternalToken() using timingSafeEqualString | ✓ VERIFIED | Contains `import crypto from "node:crypto"`, `function timingSafeEqualString`, `!timingSafeEqualString(token, expectedToken)` |
| `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts` | Unit tests including equal-length wrong-token case | ✓ VERIFIED | Contains "equal-length wrong token still rejected" test case |
| `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` | timing-safe auth block using timingSafeEqualString | ✓ VERIFIED (with gap) | Contains `import crypto from "node:crypto"`, `timingSafeEqualString` defined and used. Gap: auth block wrapped in `if (token && token.length > 0)` — silent no-auth when token empty |
| `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts` | Integration test for same-length wrong token | ✓ VERIFIED | Contains "equal-length wrong auth token (timing-safe, same-length)" test |
| `platform/apps/hub/server/middleware/03-session.ts` | deny-by-default session middleware with PUBLIC_PATHS | ✓ VERIFIED | Contains `const PUBLIC_PATHS = [`, `PUBLIC_PATHS.some`, `throw createError({ statusCode: 401` |
| `platform/apps/hub/server/api/internal/locale-context.get.ts` | requireSession() guard at top of handler | ✓ VERIFIED | Contains `import { requireSession }` and `const session = await requireSession(event)` as first statement; no `EventUserSession` type |
| `platform/apps/hub/server/middleware/__tests__/session.spec.ts` | Tests: deny-by-default 401, PUBLIC_PATHS pass-through, non-/api/ pass-through | ✓ VERIFIED | Contains `describe("03-session middleware"` with 10 tests covering all scenarios |
| `platform/apps/hub/server/utils/__tests__/session-middleware.spec.ts` | Updated tests aligned with deny-by-default (no old graceful-degradation assertions) | ✓ VERIFIED | No `resolves.not.toThrow` or old `toBeNull` assertions; replaced with deny-by-default assertions |
| `platform/apps/hub/server/api/dev/switch-user.post.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | `if (!import.meta.dev) { throw createError({ statusCode: 404 }) }` on line 11, before requireSession |
| `platform/apps/hub/server/api/dev/restore-user.post.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | Guard on line 6, before requireSession |
| `platform/apps/hub/server/api/dev/users.get.ts` | import.meta.dev guard as first statement | ✓ VERIFIED | Guard on line 8, before requireSession |
| `platform/apps/hub/server/utils/dev-role-switcher.ts` | isDevRoleSwitcherEnabled returns import.meta.dev only | ✓ VERIFIED | Returns `import.meta.dev` only; no `enablePerformanceDebug`, no `NODE_ENV === "development"` fallback |
| `platform/apps/hub/nuxt.config.ts` | Cookie secure = NODE_ENV !== development | ✓ VERIFIED | `secure: process.env.NODE_ENV !== "development"` on line 40; no `NUXT_SESSION_COOKIE_SECURE` or URL heuristic |
| `platform/apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts` | Architecture documentation test for import.meta.dev | ✓ VERIFIED | Contains `describe("Dev endpoint guards"`, uses `readFileSync` grep-based assertions, documents why unit test is impossible |
| `platform/apps/hub/server/__tests__/cookie-secure.spec.ts` | Architecture documentation test for cookie secure | ✓ VERIFIED | Contains `describe("Cookie secure configuration"`, asserts `NODE_ENV !== "development"` present |
| `platform/apps/hub/server/middleware/02-csrf-check.ts` | Explanatory comment for no-origin/no-referer CSRF skip | ✓ VERIFIED | Contains "SSR-internal" (line 10) and "intentional exception — not a security gap" (line 13) |
| `platform/apps/hub/server/utils/__tests__/session-rotation.spec.ts` | Structural verification test for session rotation | ✓ VERIFIED | Contains `describe("Session rotation (F-09 structural verification)"` with 2 tests verifying `replaceUserSession` is called and csrfToken is preserved |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/apps/hub/server/utils/internal-auth.ts` | `node:crypto` | `import crypto from "node:crypto"` | ✓ WIRED | Line 1: `import crypto from "node:crypto"` |
| `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` | `node:crypto` | `import crypto from "node:crypto"` | ✓ WIRED | Line 7: `import crypto from "node:crypto"` |
| `platform/apps/hub/server/middleware/03-session.ts` | `PUBLIC_PATHS` | `PUBLIC_PATHS.some(p => event.path.startsWith(p))` | ✓ WIRED | `PUBLIC_PATHS.some` on line 19 |
| `platform/apps/hub/server/api/internal/locale-context.get.ts` | `platform/apps/hub/server/utils/auth.ts` | `requireSession(event)` | ✓ WIRED | Import and call both present |
| `platform/apps/hub/server/api/dev/switch-user.post.ts` | `import.meta.dev` | `if (!import.meta.dev) throw createError(...)` | ✓ WIRED | Line 11, before requireSession |
| `platform/apps/hub/nuxt.config.ts` | `runtimeConfig.session.cookie.secure` | `secure: process.env.NODE_ENV !== "development"` | ✓ WIRED | Line 40 |
| `platform/apps/hub/server/middleware/02-csrf-check.ts` | intentional CSRF skip documentation | inline comment | ✓ WIRED | "SSR-internal" and "intentional exception" comments present |
| `platform/apps/hub/server/utils/__tests__/session-rotation.spec.ts` | `replaceUserSession` | structural verification test | ✓ WIRED | Test verifies `mocks.replaceUserSession` is called once |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies auth middleware, security helpers, and server configuration. No components rendering dynamic data were added. Verification is by static code analysis and test suite behavior.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| timingSafeEqualString present in internal-auth.ts | `grep "timingSafeEqualString" apps/hub/server/utils/internal-auth.ts` | 2 hits (definition + call) | ✓ PASS |
| token !== expectedToken removed | `grep "token !== expectedToken" apps/hub/server/utils/internal-auth.ts` | No output | ✓ PASS |
| Matrix-bot unsafe authHeader check removed | `grep "authHeader !== \`Bearer" apps/matrix-bot/src/utils/internal-sync-server.ts` | No output | ✓ PASS |
| PUBLIC_PATHS in 03-session.ts | `grep -c "PUBLIC_PATHS" apps/hub/server/middleware/03-session.ts` | 3 | ✓ PASS |
| 401 deny-by-default in 03-session.ts | `grep "statusCode: 401" apps/hub/server/middleware/03-session.ts` | Found | ✓ PASS |
| requireSession in locale-context.get.ts | `grep "requireSession" apps/hub/server/api/internal/locale-context.get.ts` | 2 hits (import + call) | ✓ PASS |
| import.meta.dev guard in all 3 dev handlers | grep checks all 3 files | Found in all 3, before requireSession | ✓ PASS |
| enablePerformanceDebug removed | `grep "enablePerformanceDebug" apps/hub/server/utils/dev-role-switcher.ts` | No output | ✓ PASS |
| Cookie secure NODE_ENV check | `grep "NODE_ENV.*development" apps/hub/nuxt.config.ts` | `secure: process.env.NODE_ENV !== "development"` | ✓ PASS |
| NUXT_SESSION_COOKIE_SECURE removed | `grep "NUXT_SESSION_COOKIE_SECURE" apps/hub/nuxt.config.ts` | No output | ✓ PASS |
| SSR-internal CSRF comment | `grep "SSR-internal\|intentional exception" apps/hub/server/middleware/02-csrf-check.ts` | 2 hits | ✓ PASS |
| Matrix-bot auth bypass when empty token | manual code read, line 69 | `if (token && token.length > 0)` — auth skipped when empty | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-03 | 03-01-PLAN | All internal token comparisons use crypto.timingSafeEqual | ✓ SATISFIED | Hub: `timingSafeEqualString` + `!timingSafeEqualString` call in `internal-auth.ts`. Matrix-bot: same pattern. Both have `import crypto from "node:crypto"`. Tests: 6 hub, 9 matrix-bot. No remaining `token !== expectedToken` patterns. |
| SEC-04 | 03-02-PLAN | Session middleware deny-by-default; public routes explicitly marked | ✓ SATISFIED | `03-session.ts` with `PUBLIC_PATHS` and 401 enforcement. `locale-context.get.ts` guarded. 10 new session tests, 6 updated session-middleware tests. All green per commit history. |
| SEC-05 | 03-03-PLAN, 03-04-PLAN | Auth/OAuth hardening: cookie flags, CSRF, session rotation, dev endpoints | ✓ SATISFIED (with accepted residual risk) | Findings F-07, F-09, F-10, F-17 all addressed. Cookie flags confirmed in nuxt.config.ts. Dev endpoints guarded with build-time constant. CSRF comment added. Session rotation structurally verified. **Exception:** Matrix-bot silent auth bypass when empty token (CR-01) is a residual finding not covered by SEC-05's original scope (which was hub-focused). Noted as gap. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/matrix-bot/src/utils/internal-sync-server.ts` | 69 | `if (token && token.length > 0)` auth guard — silently skips all auth when token is empty | Blocker | Violates "Fail Loud, Never Fake" constraint. Any deployment where BOT_INTERNAL_TOKEN is not set accepts all requests without auth. Hub's counterpart throws 503 in this case. |

### Human Verification Required

None — all verifications were accomplished via static code analysis, grep checks, and git log inspection.

### Gaps Summary

**1 gap blocking full goal achievement:**

**Matrix-Bot silent auth bypass (CR-01):** `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` wraps the entire auth block in `if (token && token.length > 0)`. When `BOT_INTERNAL_TOKEN` is empty string (the default fallback in nuxt.config.ts is `process.env.BOT_INTERNAL_TOKEN || ""`), the auth check is skipped and every request is accepted without authentication. This directly contradicts the project's "Fail Loud, Never Fake" security constraint and leaves the Matrix-Bot internal HTTP server fully open on misconfiguration.

The Hub's equivalent (`requireInternalToken` in `internal-auth.ts`) handles this correctly by throwing 503 when the token is unconfigured. The Matrix-Bot should mirror this behavior.

This was found during post-execution code review (`03-REVIEW.md`, CR-01). The timing-safe comparison itself is correctly implemented — the bypass is in the outer conditional, not the comparison logic.

**Fix required:**
```typescript
// Replace the conditional guard:
if (token && token.length > 0) {
  // ... auth check
}

// With fail-loud pattern:
if (!token || token.length === 0) {
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Server misconfigured: internal token not set", errorCode: "MISCONFIGURED" }));
  return;
}
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith("Bearer ") || !timingSafeEqualString(authHeader.slice("Bearer ".length), token)) {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
  return;
}
```

**Note on ROADMAP.md:** The progress table shows Phase 3 as "Not started" and the `03-02-PLAN.md` checkbox is unchecked in ROADMAP.md, despite all plan 02 artifacts existing in the codebase with valid commits (dbc8fa2, 51f5254). This is a bookkeeping artifact only — the code is correct and present. The ROADMAP.md tracking table should be updated to reflect Phase 3's actual completion state.

---

_Verified: 2026-04-17T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
