# Phase 3: Auth- & Session-Härtung - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 10 (9 modified + 1 utility touched via dev-role-switcher)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `platform/apps/hub/server/middleware/03-session.ts` | middleware | request-response | `platform/apps/hub/server/middleware/01-rate-limit.ts` | exact |
| `platform/apps/hub/server/utils/internal-auth.ts` | utility | request-response | `platform/apps/bot/src/utils/internal-sync-server.ts` (timingSafeEqualString) | exact |
| `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` | utility | request-response | `platform/apps/bot/src/utils/internal-sync-server.ts` (timingSafeEqualString) | exact |
| `platform/apps/hub/server/api/dev/switch-user.post.ts` | controller | request-response | `platform/apps/hub/server/api/dev/switch-user.post.ts` (self — guard added) | self |
| `platform/apps/hub/server/api/dev/restore-user.post.ts` | controller | request-response | `platform/apps/hub/server/api/dev/switch-user.post.ts` | exact |
| `platform/apps/hub/server/api/dev/users.get.ts` | controller | request-response | `platform/apps/hub/server/api/dev/switch-user.post.ts` | exact |
| `platform/apps/hub/nuxt.config.ts` | config | — | `platform/apps/hub/nuxt.config.ts` (self — line 40-42) | self |
| `platform/apps/hub/server/middleware/02-csrf-check.ts` | middleware | request-response | `platform/apps/hub/server/middleware/02-csrf-check.ts` (self — comment only) | self |
| `platform/apps/hub/server/api/internal/locale-context.get.ts` | controller | request-response | `platform/apps/hub/server/api/dev/switch-user.post.ts` (requireSession pattern) | role-match |
| `platform/apps/hub/server/utils/dev-role-switcher.ts` | utility | — | `platform/apps/hub/server/utils/dev-role-switcher.ts` (self — isDevRoleSwitcherEnabled) | self |

---

## Pattern Assignments

### `platform/apps/hub/server/middleware/03-session.ts` (middleware, request-response)

**Analog:** `platform/apps/hub/server/middleware/01-rate-limit.ts`

**Current file** (lines 1-9) — the entire content:
```typescript
export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    event.context.userSession = session;
  } catch (error) {
    console.warn("[Auth] Session validation failed:", error instanceof Error ? error.message : String(error));
    event.context.userSession = null;
  }
});
```

**Path-guard pattern from analog** (`01-rate-limit.ts` line 4):
```typescript
if (!event.path.startsWith("/api/")) return;
```

**Deny-by-default target shape** — replace the entire file:
```typescript
// PUBLIC_PATHS: Routes accessible without a user session.
// Every new /api/ route that does NOT require authentication MUST be listed here.
// Anything not listed is auth-required (deny-by-default).
const PUBLIC_PATHS = [
  "/api/public/",    // branding, footer-pages, landing (public community data)
  "/api/auth/",      // OAuth callbacks, logout, platform list, dev-login
  "/api/csrf-token", // CSRF token initialisation (before login)
  "/api/setup/",     // Setup wizard (runs before first auth is configured)
  "/api/theme.get",  // Public theming data
  "/api/apply/",     // Application-flow uploads (own token auth via verifyAndLoadToken)
  "/api/internal/",  // MCP internal endpoints (requireInternalToken as their own auth)
];

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  if (PUBLIC_PATHS.some((p) => event.path.startsWith(p))) return;

  try {
    const session = await getUserSession(event);
    event.context.userSession = session;
  } catch (error) {
    console.warn("[Auth] Session validation failed:", error instanceof Error ? error.message : String(error));
    event.context.userSession = null;
  }

  if (!event.context.userSession?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: "Authentication required." });
  }
});
```

**Existing test file to update:** `platform/apps/hub/server/utils/__tests__/session-middleware.spec.ts`

The current tests assert that middleware sets `userSession = null` on failure and never throws — both assertions contradict the new deny-by-default behaviour. They must be updated:
- Test "sets event.context.userSession to null when session validation fails" → now expects `createError` with 401.
- Test "does not throw when getUserSession throws (graceful degradation)" → now expects 401 throw for non-public paths.
- Add test: path in `PUBLIC_PATHS` returns without calling `getUserSession`.
- Add test: missing session on non-public path throws 401.

---

### `platform/apps/hub/server/utils/internal-auth.ts` (utility, request-response)

**Analog (copy source):** `platform/apps/bot/src/utils/internal-sync-server.ts` lines 70-87

**Current file** (lines 1-19):
```typescript
import type { H3Event } from "h3";

export function requireInternalToken(event: H3Event): void {
  const config = useRuntimeConfig(event);
  const expectedToken = String(config.mcpInternalToken || "").trim();

  if (!expectedToken) {
    throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
  }

  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : getHeader(event, "x-internal-token")?.trim() || "";

  if (!token || token !== expectedToken) {     // <-- timing-unsafe: replace this line
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }
}
```

**timingSafeEqualString pattern to copy** (`bot/src/utils/internal-sync-server.ts` lines 70-73):
```typescript
function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
```

**Target shape** — full replacement:
```typescript
import crypto from "node:crypto";
import type { H3Event } from "h3";

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireInternalToken(event: H3Event): void {
  const config = useRuntimeConfig(event);
  const expectedToken = String(config.mcpInternalToken || "").trim();

  if (!expectedToken) {
    throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
  }

  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : getHeader(event, "x-internal-token")?.trim() || "";

  if (!token || !timingSafeEqualString(token, expectedToken)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }
}
```

**Existing test file:** `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts`

All 5 existing tests must remain green — the function signature is unchanged. Add one new test case:
```typescript
it("uses timing-safe comparison (equal-length wrong token still rejected)", async () => {
  mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token-abc" });
  mocks.getHeader.mockImplementation((_event: any, name: string) => {
    if (name === "authorization") return "Bearer secret-token-xyz"; // same length
    return undefined;
  });
  const { requireInternalToken } = await importInternalAuth();
  const event = createMockEvent();
  expect(() => requireInternalToken(event)).toThrow();
  try { requireInternalToken(event); } catch (e: any) {
    expect(e.statusCode).toBe(401);
  }
});
```

---

### `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` (utility, request-response)

**Analog (copy source):** `platform/apps/bot/src/utils/internal-sync-server.ts` lines 70-87

**Current auth block** (lines 66-75):
```typescript
const server = http.createServer(async (req, res) => {
  // Auth check
  if (token && token.length > 0) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${token}`) {   // <-- timing-unsafe
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
      return;
    }
  }
```

**Import to add** (top of file, alongside existing `import http from "node:http"`):
```typescript
import crypto from "node:crypto";
```

**timingSafeEqualString helper to add** (after existing `parseBody` function, before `startInternalSyncServer`):
```typescript
function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
```

**Auth block replacement**:
```typescript
  if (token && token.length > 0) {
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
  }
```

**Existing test file:** `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts`

Tests at lines 73-79 ("rejects requests without auth token", "rejects requests with wrong auth token") already cover the required behaviour and must remain green.

---

### `platform/apps/hub/server/api/dev/switch-user.post.ts` (controller, request-response)

**Current file** (lines 10-13) — handler opening:
```typescript
export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  assertDevRoleSwitcherAccess(event, session);
```

**import.meta.dev guard to insert** — first 3 lines of handler body, before any other logic:
```typescript
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not Found." });
  }
  const session = await requireSession(event);
  assertDevRoleSwitcherAccess(event, session);
  // ... rest unchanged
```

---

### `platform/apps/hub/server/api/dev/restore-user.post.ts` (controller, request-response)

Same guard pattern as `switch-user.post.ts`. Insert at lines 5-7:
```typescript
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not Found." });
  }
  const session = await requireSession(event);
  // ... rest unchanged
```

---

### `platform/apps/hub/server/api/dev/users.get.ts` (controller, request-response)

Same guard pattern. Insert at lines 7-9:
```typescript
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not Found." });
  }
  const session = await requireSession(event);
  // ... rest unchanged
```

---

### `platform/apps/hub/server/utils/dev-role-switcher.ts` (utility)

`isDevRoleSwitcherEnabled` also needs updating to remove the `enablePerformanceDebug` bypass. **Current** (lines 5-8):
```typescript
export function isDevRoleSwitcherEnabled(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event);
  return import.meta.dev || process.env.NODE_ENV === "development" || Boolean(config.public.enablePerformanceDebug);
}
```

**Target shape** (function is now a no-arg check; `event` parameter retained for signature compatibility):
```typescript
export function isDevRoleSwitcherEnabled(_event: Parameters<typeof useRuntimeConfig>[0]) {
  // import.meta.dev is a Vite/Nitro build-time constant — always false in production builds.
  // Do NOT add runtime fallbacks here (NODE_ENV, enablePerformanceDebug, etc.).
  return import.meta.dev;
}
```

Note: The `useRuntimeConfig` call is removed, so the unused `event` parameter can be prefixed with `_` to suppress lint. The existing test in `dev-role-switcher.spec.ts` does not test `isDevRoleSwitcherEnabled` directly (it tests `canUseDevRoleSwitcher` and `hasModeratorAccess`) — no test changes needed there.

---

### `platform/apps/hub/nuxt.config.ts` (config)

**Current** (lines 40-42):
```typescript
secure: process.env.NUXT_SESSION_COOKIE_SECURE
  ? process.env.NUXT_SESSION_COOKIE_SECURE !== "false"
  : (process.env.NUXT_PUBLIC_HUB_URL || "").startsWith("https://"),
```

**Replacement** (single line, D-08):
```typescript
secure: process.env.NODE_ENV !== "development",
```

No import changes. The surrounding `runtimeConfig.session.cookie` block (lines 34-44) stays intact.

---

### `platform/apps/hub/server/middleware/02-csrf-check.ts` (middleware — comment only)

**Current** (lines 12-15):
```typescript
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  if (!origin && !referer) return;
```

Note: The CSRF comment has already been added to this file (lines 10-15 show the explanatory comment is present in the current codebase). Verify the existing comment matches the required wording before treating this as done. If the comment already satisfies F-17, no code change is needed. If it is absent, insert:

```typescript
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  // SSR-internal requests originate from the Nitro server itself (e.g. useRequestFetch / $fetch
  // on the server side) and carry no Origin or Referer header. Browser-initiated cross-origin
  // CSRF attacks always include an Origin header, so no-origin requests are safe for SSR internals.
  // This is an intentional exception — not a security gap.
  if (!origin && !referer) return;
```

**Status:** The file already contains a compliant comment (lines 10-14 in the current codebase). Confirm during implementation; if already present, F-17 is closed as-is.

---

### `platform/apps/hub/server/api/internal/locale-context.get.ts` (controller, request-response)

**Analog:** `requireSession` guard pattern from `platform/apps/hub/server/utils/auth.ts` lines 33-46

**Current file** — no guard at all. The handler reads `event.context.userSession` directly (lines 21-22):
```typescript
const session = (event.context.userSession ?? null) as EventUserSession;
const userId = typeof session?.user?.id === "string" ? session.user.id : null;
```

**Target shape** — add import and guard at top of handler:
```typescript
import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { requireSession } from "../../utils/auth";   // <-- add this import
import {
  normalizeUserLocalePreference,
  readLegacyLocalePreferenceFromCustomFields,
  resolveEffectiveLocale
} from "../../../utils/locale-preference";
import { loadCommunitySettingsLocale } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);       // <-- add guard; throws 401 if unauthenticated
  const db = getDb();
  const communityDefaultLocale = await loadCommunitySettingsLocale(db);

  const userId = session.user.id;                    // <-- use session directly, remove EventUserSession type

  let localePreference = null;
  // ... rest of handler unchanged from line 24 onwards, using userId directly
```

**Important:** The `EventUserSession` type alias (lines 11-15) and the `userSession`-based `userId` extraction (lines 21-22) become redundant after adding `requireSession`. Remove them. `hasSession` in the return value (line 48) can use `Boolean(userId)` as before.

---

## Shared Patterns

### requireSession Guard
**Source:** `platform/apps/hub/server/utils/auth.ts` lines 33-46
**Apply to:** `locale-context.get.ts` (F-02 delta)
```typescript
export async function requireSession(event: Parameters<typeof requireUserSession>[0]): Promise<AppSession> {
  try {
    const session = (await requireUserSession(event)) as AppSession;
    if (!session.user?.id) {
      throw new Error("Missing user id in session.");
    }
    return session;
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required."
    });
  }
}
```

### timingSafeEqualString
**Source:** `platform/apps/bot/src/utils/internal-sync-server.ts` lines 70-73
**Apply to:** `internal-auth.ts` (F-03), `matrix-bot/internal-sync-server.ts` (F-04)
```typescript
function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
```
Requires `import crypto from "node:crypto"` at top of each consuming file.

### import.meta.dev Guard
**Apply to:** All three `/api/dev/` route handlers
```typescript
if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: "Not Found." });
}
```
Insert as first statement inside `defineEventHandler` callback, before any other logic including `requireSession`.

### createError Pattern
**Source:** `platform/apps/hub/server/utils/auth.ts` lines 41-44, `internal-auth.ts` lines 7-9
**Apply to:** All modified server files
```typescript
throw createError({ statusCode: 401, statusMessage: "Authentication required." });
// or
throw createError({ statusCode: 404, statusMessage: "Not Found." });
```
`createError` is a Nitro auto-import — no explicit import needed in `.ts` server files.

### Middleware Path Guard
**Source:** `platform/apps/hub/server/middleware/01-rate-limit.ts` line 4
**Apply to:** `03-session.ts`
```typescript
if (!event.path.startsWith("/api/")) return;
```

---

## Test Infrastructure Reference

### Hub unit test pattern
**Source:** `platform/apps/hub/server/utils/__tests__/test-helpers.ts`

All hub server-utils tests follow this structure:
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMockEvent, stubNuxtAutoImports, cleanupAutoImportStubs } from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => { mocks = stubNuxtAutoImports(); });
afterEach(() => { cleanupAutoImportStubs(); vi.resetModules(); });
```

`stubNuxtAutoImports()` stubs: `getUserSession`, `requireUserSession`, `replaceUserSession`, `createError`, `defineEventHandler`, `getMethod`, `getHeader`, `setResponseHeader`, `getRequestIP`, `useRuntimeConfig`, `validateCsrfToken`.

**New test files needed** (Wave 0 gaps from RESEARCH.md):
- Session-rotation documentation test: `server/utils/__tests__/session-rotation.spec.ts`
- Dev-endpoint guard test: `server/api/__tests__/dev-endpoints.spec.ts` — note `import.meta.dev` is `false`/`undefined` in Vitest; test via HTTP status code rather than mocking the build constant directly.

### Matrix-bot integration test pattern
**Source:** `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts`

Tests start a real HTTP server on `port: 0` (OS-assigned), make actual HTTP requests via `node:http`, and check status codes. Auth tests at lines 73-79 cover `token: ""` (401) and `token: "wrong"` (401). After the `timingSafeEqualString` fix, add a case for `token: "X".repeat(TEST_TOKEN.length)` (same-length wrong token, must return 401).

---

## No Analog Found

None. All 10 files have close analogs or are self-modifications with clear target shapes derived from RESEARCH.md.

---

## Metadata

**Analog search scope:** `platform/apps/hub/server/`, `platform/apps/matrix-bot/src/`, `platform/apps/bot/src/`
**Files scanned:** 18 (all modified/analog files read directly)
**Pattern extraction date:** 2026-04-17
