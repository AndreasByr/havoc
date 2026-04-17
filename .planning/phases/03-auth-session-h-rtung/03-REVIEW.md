---
phase: 03-auth-session-haertung
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - apps/hub/server/utils/internal-auth.ts
  - apps/hub/server/utils/__tests__/internal-auth.spec.ts
  - apps/matrix-bot/src/utils/internal-sync-server.ts
  - apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts
  - apps/hub/nuxt.config.ts
  - apps/hub/server/api/dev/restore-user.post.ts
  - apps/hub/server/api/dev/switch-user.post.ts
  - apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts
  - apps/hub/server/api/dev/users.get.ts
  - apps/hub/server/api/internal/locale-context.get.ts
  - apps/hub/server/middleware/02-csrf-check.ts
  - apps/hub/server/middleware/03-session.ts
  - apps/hub/server/middleware/__tests__/session.spec.ts
  - apps/hub/server/__tests__/cookie-secure.spec.ts
  - apps/hub/server/utils/dev-role-switcher.ts
  - apps/hub/server/utils/__tests__/session-middleware.spec.ts
  - apps/hub/server/utils/__tests__/session-rotation.spec.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase delivers the auth/session hardening work: `crypto.timingSafeEqual` for internal token comparisons on both Hub and Matrix-Bot, a deny-by-default session middleware with an explicit `PUBLIC_PATHS` allow-list, `requireSession()` on the previously-unprotected `locale-context` endpoint, `import.meta.dev` guards on all `/api/dev/` endpoints, a `NODE_ENV`-based cookie `secure` flag, CSRF origin-skip documentation, and structural session-rotation verification tests.

The implementation is largely solid. The timing-safe comparison logic is correct in both services, the session middleware allow-list covers all currently-known public routes, and the CSRF origin/referer skip is correctly documented. However, two critical gaps were found: the Matrix-Bot auth guard has a bypass path when the token is empty, and the `/api/internal/` prefix in `PUBLIC_PATHS` allows completely unauthenticated access to those endpoints at the session-middleware layer (their per-endpoint `requireInternalToken` guard only triggers if the route handler is reached, but there is nothing stopping an attacker who spoofs that prefix). There are also two warning-level issues in the dev-endpoint hardening.

---

## Critical Issues

### CR-01: Matrix-Bot auth guard silently disabled when `token` is empty string

**File:** `apps/matrix-bot/src/utils/internal-sync-server.ts:69`

**Issue:** The entire auth block is wrapped in `if (token && token.length > 0)`. When the bot is started with `BOT_INTERNAL_TOKEN=""` (empty string, which is the default fallback in `nuxt.config.ts` — `process.env.BOT_INTERNAL_TOKEN || ""`), the token check is silently skipped and every request is accepted without authentication. This is the exact "silent security fallback" pattern the project's "Fail Loud, Never Fake" constraint prohibits.

The Hub counterpart (`requireInternalToken` in `internal-auth.ts`) correctly throws a `503` when the token is unconfigured. The Matrix-Bot does the opposite: it treats an unconfigured token as "no auth required."

**Fix:**
```typescript
// Replace the conditional auth block with fail-loud behavior:
if (!token || token.length === 0) {
  // Misconfiguration: token not provided at startup — refuse all requests
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Server misconfigured: internal token not set", errorCode: "MISCONFIGURED" }));
  return;
}

const authHeader = req.headers.authorization;
if (
  !authHeader ||
  !authHeader.startsWith("Bearer ") ||
  !timingSafeEqualString(authHeader.slice("Bearer ".length), token)
) {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
  return;
}
```

---

### CR-02: `/api/internal/` in `PUBLIC_PATHS` means the session middleware never enforces auth on those routes

**File:** `apps/hub/server/middleware/03-session.ts:11`

**Issue:** Adding `/api/internal/` to `PUBLIC_PATHS` means `03-session.ts` returns immediately without attaching or validating any session for those routes. The per-endpoint `requireInternalToken()` call in each handler acts as the only gate. This is fine in isolation, but creates a brittle single-layer defence:

1. Any future internal endpoint that forgets to call `requireInternalToken()` is fully public with zero auth (the session middleware will pass it through unconditionally).
2. The session middleware comment says "MCP internal endpoints (requireInternalToken as their own auth)" — this is an implicit contract that must be enforced manually on each handler, rather than by the middleware itself.

The safer pattern is to keep `/api/internal/` out of `PUBLIC_PATHS` and instead exempt those routes from the *session* check while still letting the middleware run, or to add an explicit `requireInternalToken` assertion in a dedicated internal middleware. The current design is one forgotten `requireInternalToken()` call away from an open endpoint.

**Fix (option A — belt-and-suspenders in middleware):**
```typescript
// In 03-session.ts, replace the simple PUBLIC_PATHS pass-through for /api/internal/
// with a dedicated token check:
if (event.path.startsWith("/api/internal/")) {
  // Internal endpoints use bearer-token auth; do NOT require a user session,
  // but do not pass them through silently either — leave enforcement to each handler.
  // (The alternative is to call requireInternalToken here directly.)
  return; // acceptable only if requireInternalToken is guaranteed by convention
}
```

**Fix (option B — enforce at middleware layer, removing reliance on per-handler guards):**
```typescript
if (event.path.startsWith("/api/internal/")) {
  const config = useRuntimeConfig(event);
  const expectedToken = String(config.mcpInternalToken || "").trim();
  if (!expectedToken) throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || !timingSafeEqualString(token, expectedToken)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }
  return;
}
```

Option B is the stronger fix; option A preserves the status quo but adds a comment that should become a lint rule.

---

## Warnings

### WR-01: `restore-user.post.ts` — double-invocation pattern in test causes `requireSession` to fire twice if the first throw check fails

**File:** `apps/hub/server/api/dev/restore-user.post.ts:9` / `apps/hub/server/utils/__tests__/session-middleware.spec.ts`

**Issue:** This is a pattern issue in the production code. `restore-user.post.ts` calls `requireSession(event)` after the `import.meta.dev` guard, then calls `assertDevRoleSwitcherAccess(event, session)`. However, `assertDevRoleSwitcherAccess` internally calls `isDevRoleSwitcherEnabled` which checks `import.meta.dev` again (line 17 of `dev-role-switcher.ts`). In production builds both will be `false`, so `assertDevRoleSwitcherAccess` will throw 403, but `requireSession` has already been called and a session parsed. This is benign (the session is discarded) but it means in production a request that reaches this handler will:

1. Parse the session (I/O + HMAC verify)
2. Then throw 403 because `import.meta.dev === false`

The `import.meta.dev` check (step 1 in the handler: line 6) fires before `requireSession`, which does prevent the session parse in the normal path — the handler returns 404 immediately. But the *second* guard inside `assertDevRoleSwitcherAccess` is unreachable because the handler-level guard fires first. This creates dead but confusing double-guard logic.

**Fix:** Either remove the `import.meta.dev` check from `assertDevRoleSwitcherAccess`/`isDevRoleSwitcherEnabled` (relying solely on the handler-level guard) or document that the function-level check is a defence-in-depth backstop for callers who forget the handler guard. The current state is unclear.

---

### WR-02: `internal-auth.ts` accepts token via `x-internal-token` header — not documented in Matrix-Bot server

**File:** `apps/hub/server/utils/internal-auth.ts:21`

**Issue:** `requireInternalToken` accepts the token in two ways: `Authorization: Bearer <token>` or `x-internal-token: <token>`. The Matrix-Bot's internal server only accepts `Authorization: Bearer`. The Hub's bot-bridge caller (in `platformBridge.ts` / `botSync.ts`) presumably sends `Authorization: Bearer`. However the `x-internal-token` fallback path has no callers visible in the codebase and is untested with an integration check against an actual caller. This is a widened attack surface without apparent need.

**Fix:** If `x-internal-token` is not used by any caller, remove it. If it is used by the MCP server or another caller, add a test covering that path end-to-end and document why the alternate header name is needed.

---

### WR-03: `session-rotation.spec.ts` — structural test does not verify the CSRF token is actually present in the sealed session

**File:** `apps/hub/server/utils/__tests__/session-rotation.spec.ts:147`

**Issue:** The test at line 147 verifies that `replaceUserSession` was called with a `csrfToken` argument. It does this by inspecting `mocks.replaceUserSession.mock.calls[0][1]`. However, `replaceUserSession` is a mock — calling it with `csrfToken` present only proves `replaceAuthSession` assembled the right object to pass to the mock. It does not verify that the sealed cookie payload actually contains the CSRF token (that would require the real `replaceUserSession` implementation). This is the correct approach given the architecture constraints documented in the test, but it means a regression where `csrfToken` is stripped between the `replaceAuthSession` call-site and `replaceUserSession` would not be caught by this test.

Given the constraints this is acceptable, but the test comment should explicitly note this limitation: "this verifies the call-site contract, not the sealing behavior."

**Fix:** Add a one-line comment to the expectation:
```typescript
// Verifies call-site assembles csrfToken correctly (sealing behavior is nuxt-auth-utils's contract)
expect(callArg.csrfToken).toBe("csrf-preserved-token");
```

---

## Info

### IN-01: `internal-auth.spec.ts` — try/catch pattern for status code assertion is fragile

**File:** `apps/hub/server/utils/__tests__/internal-auth.spec.ts:31-35` (and repeated at lines 45-50, 91-95, 108-111)

**Issue:** The test pattern `expect(() => fn()).toThrow(); try { fn(); } catch (e) { expect(e.statusCode).toBe(...); }` calls the function twice. If the first call has a side effect (state mutation, session write) it would happen twice. More importantly, the double-call pattern could mask timing issues. The idiomatic Vitest approach is `await expect(async () => fn()).rejects.toMatchObject({ statusCode: 503 })` (or the synchronous `.toThrowError` with a matcher).

**Fix:**
```typescript
// Replace the expect+try/catch pairs with:
expect(() => requireInternalToken(event)).toThrow(
  expect.objectContaining({ statusCode: 503 })
);
// or for synchronous throws:
let caught: any;
try { requireInternalToken(event); } catch (e) { caught = e; }
expect(caught?.statusCode).toBe(503);
```

---

### IN-02: `dev-endpoints.spec.ts` path resolution assumes specific directory depth

**File:** `apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts:30`

**Issue:** `const HUB_ROOT = resolve(__dirname, "../../../..");` hard-codes four directory levels up from the test file to reach the hub root. If the test file is moved or the directory structure changes, this silently resolves to the wrong directory and the `readFileSync` calls succeed (returning a different file) rather than failing loudly.

**Fix:** Use a workspace-relative path or add a sanity assertion:
```typescript
const HUB_ROOT = resolve(__dirname, "../../../..");
// Sanity check that we resolved to the right root
if (!existsSync(resolve(HUB_ROOT, "nuxt.config.ts"))) {
  throw new Error(`HUB_ROOT resolved incorrectly: ${HUB_ROOT}`);
}
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
