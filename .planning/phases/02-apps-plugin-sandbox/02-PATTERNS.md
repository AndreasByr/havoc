# Phase 2: Apps-Plugin-Sandbox - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `platform/apps/bot/src/utils/app-hooks.ts` | utility (execution site) | event-driven | self (modify in-place) | exact |
| `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` | test | event-driven | self (extend in-place) | exact |
| `platform/apps/hub/server/api/apps/[...path].ts` | API route handler | request-response | self (modify in-place) | exact |
| `platform/apps/hub/server/api/apps/__tests__/path.spec.ts` | test | request-response | `platform/apps/hub/server/api/__tests__/admin-apps.spec.ts` | role-match |
| `platform/apps/hub/server/api/admin/apps/sideload.post.ts` | API route handler | request-response | self (modify in-place) | exact |
| `platform/apps/hub/server/api/admin/apps/local-sideload.post.ts` | API route handler | request-response | self (modify in-place) | exact |
| `platform/apps/hub/server/api/admin/apps/[id].delete.ts` | API route handler | request-response | self (modify in-place) | exact |
| `platform/apps/bot/package.json` + `platform/apps/hub/Dockerfile` | config | — | self (modify in-place) | exact |
| `platform/.env.example` | config/docs | — | self (extend in-place) | exact |

---

## Pattern Assignments

### `platform/apps/bot/src/utils/app-hooks.ts` (utility, event-driven)

**Change type:** Modify in-place — wrap `emit()` handler invocation with `Promise.race()` timeout, replace unstructured error log with structured format.

**Current handler invocation** (`app-hooks.ts` lines 78-89 — the block to replace):
```typescript
for (const [appId, { handler, ctx }] of scopedHandlers.entries()) {
  try {
    const freshConfig = await loadAppConfig(appId);
    if (Object.keys(freshConfig).length > 0) {
      ctx.config = freshConfig;
    }
    await (handler as BotHookHandler<K>)(payload, ctx);
  } catch (error) {
    logger.error("App hook failed", { appId, hookName: eventName, error });
  }
}
```

**Target pattern — add above the class, before `BotAppHookRegistry`:**
```typescript
// Configurable timeout for app hook execution.
// NOTE: Promise.race() only interrupts async-yielding code. Tight synchronous
// loops in app code will still block the event loop — accepted per D-01 threat model.
const HOOK_TIMEOUT_MS = parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10);
```

**Target pattern — replace the `emit()` try/catch block:**
```typescript
for (const [appId, { handler, ctx }] of scopedHandlers.entries()) {
  const freshConfig = await loadAppConfig(appId);
  if (Object.keys(freshConfig).length > 0) {
    ctx.config = freshConfig;
  }

  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error("timeout")),
      HOOK_TIMEOUT_MS
    );
  });

  try {
    await Promise.race([
      (handler as BotHookHandler<K>)(payload, ctx),
      timeoutPromise
    ]);
  } catch (error) {
    const isTimeout = (error as Error).message === "timeout";
    if (isTimeout) {
      logger.warn({ appId, event: "hook.timeout", durationMs: HOOK_TIMEOUT_MS });
    } else {
      logger.error({ appId, event: "hook.error", error: (error as Error).message });
    }
  } finally {
    clearTimeout(timerId!);
  }
}
```

**Existing logger import** (`app-hooks.ts` line 8 — no change needed):
```typescript
import { logger } from "./logger";
```

---

### `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` (test, event-driven)

**Change type:** Extend in-place — add new test cases to existing `"BotAppHookRegistry"` describe block.

**Existing mock logger setup** (lines 37-39 — already present, used as-is):
```typescript
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
```

**Existing mockLogger access pattern** — the spec file does NOT capture the mock logger in a variable. Pattern from `admin-apps.spec.ts` (see Shared Patterns below) shows how to grab it after import. For the new timeout tests, import the mocked logger:

After the existing import block at the top (after line 42), add:
```typescript
import { logger } from "../logger.js";
```
This gives access to the mocked `logger.warn` / `logger.error` via `vi.mocked(logger.warn)`.

**New test cases to append inside the `"BotAppHookRegistry"` describe block:**

```typescript
it("hook.timeout: slow async handler is abandoned and warn is logged", async () => {
  vi.useFakeTimers();
  const slowHandler = vi.fn(() => new Promise<void>(() => {})); // never resolves
  const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
  botAppHookRegistry.register("app-slow", "onMessage", slowHandler, ctx);

  const emitPromise = botAppHookRegistry.emit("onMessage", {} as any);
  vi.advanceTimersByTime(5001);
  await emitPromise;

  expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
    expect.objectContaining({ appId: "app-slow", event: "hook.timeout" })
  );
  vi.useRealTimers();
});

it("hook.error: throwing handler logs structured error", async () => {
  const errorHandler = vi.fn().mockRejectedValue(new Error("boom"));
  const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
  botAppHookRegistry.register("app-err", "onMessage", errorHandler, ctx);

  await botAppHookRegistry.emit("onMessage", {} as any);

  expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
    expect.objectContaining({ appId: "app-err", event: "hook.error", error: "boom" })
  );
});

it("error boundary preserved after timeout: next handler still executes", async () => {
  vi.useFakeTimers();
  const slowHandler = vi.fn(() => new Promise<void>(() => {}));
  const fastHandler = vi.fn().mockResolvedValue(undefined);
  const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
  botAppHookRegistry.register("app-slow", "onMessage", slowHandler, ctx);
  botAppHookRegistry.register("app-fast", "onMessage", fastHandler, ctx);

  const emitPromise = botAppHookRegistry.emit("onMessage", {} as any);
  vi.advanceTimersByTime(5001);
  await emitPromise;

  expect(fastHandler).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
```

---

### `platform/apps/hub/server/api/apps/[...path].ts` (API route handler, request-response)

**Change type:** Modify in-place — replace `return handler(event)` at line 111 with `Promise.race()` timeout block; add structured logging.

**Hub logging approach:** consola is NOT available in hub (not in `platform/apps/hub/package.json` dependencies, not hoisted). Use `console.log(JSON.stringify(...))` / `console.error(JSON.stringify(...))` for structured output.

**Add at top of file, after existing imports** (lines 1-8):
```typescript
// Configurable timeout for app route handler execution.
// NOTE: Promise.race() only interrupts async-yielding code. Tight synchronous
// loops in app code will still block the event loop — accepted per D-01 threat model.
const HOOK_TIMEOUT_MS = parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10);
```

**Replace line 111** (`return handler(event);`) with:
```typescript
let timerId: ReturnType<typeof setTimeout>;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(
    () => reject(new Error("timeout")),
    HOOK_TIMEOUT_MS
  );
});

try {
  return await Promise.race([
    Promise.resolve(handler(event)),
    timeoutPromise
  ]);
} catch (error) {
  const isTimeout = (error as Error).message === "timeout";
  if (isTimeout) {
    console.warn(JSON.stringify({ appId, event: "route.timeout", durationMs: HOOK_TIMEOUT_MS }));
    throw createError({ statusCode: 504, statusMessage: `App '${appId}' route handler timed out.` });
  }
  console.error(JSON.stringify({ appId, event: "route.error", error: (error as Error).message }));
  throw createError({ statusCode: 500, statusMessage: `App '${appId}' route handler failed.` });
} finally {
  clearTimeout(timerId!);
}
```

---

### `platform/apps/hub/server/api/apps/__tests__/path.spec.ts` (test, request-response) — NEW FILE

**Analog:** `platform/apps/hub/server/api/__tests__/admin-apps.spec.ts`

**Test file structure to copy** (from `admin-apps.spec.ts` lines 1-50):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

// ... additional mocks ...

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // stub additional auto-imports as globals
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});
```

**Mocks needed for `[...path].ts`:**
```typescript
vi.mock("@guildora/shared", () => ({
  installedApps: Symbol("installedApps"),
}));

vi.mock("../../utils/auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../../utils/apps", () => ({
  hasRequiredRoles: vi.fn().mockReturnValue(true),
  refreshAppRegistry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/app-db", () => ({
  createAppDb: vi.fn(() => ({})),
}));

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));
```

**Stub pattern for `installedApps` on event context** (from `admin-apps.spec.ts` pattern):
```typescript
// In createMockEvent, set event.context.installedApps to mock app list
const mockApp = {
  appId: "test-app",
  manifest: {
    apiRoutes: [{ method: "GET", path: "/api/apps/test-app/data", handler: "src/api/data.ts", requiredRoles: [] }]
  },
  codeBundle: { "src/api/data.ts": `module.exports = { default: function handler(event) { return { ok: true }; } };` },
  config: {},
  source: "marketplace"
};
```

**Test cases to implement:**
```typescript
describe("GET /api/apps/:appId/:path — route.timeout", () => {
  it("returns 504 and logs route.timeout when handler hangs", async () => {
    vi.useFakeTimers();
    // set up slow handler code (never resolves)
    // emit request, advance timers, expect createError 504
    vi.useRealTimers();
  });
});

describe("GET /api/apps/:appId/:path — route.error", () => {
  it("returns 500 and logs route.error when handler throws", async () => {
    // set up handler code that throws
    // expect createError 500
  });
});
```

---

### `platform/apps/hub/server/api/admin/apps/sideload.post.ts` (API route handler, request-response)

**Change type:** Modify in-place — add `app.installed` log after successful `installAppFromUrl` call.

**Current success block** (lines 20-27):
```typescript
const { appId } = await installAppFromUrl(parsedBody.githubUrl, {
  activate: parsedBody.activate,
  verified: parsedBody.verified,
  createdBy: session.user.id,
  preserveAutoUpdate: false
});

return { ok: true, appId };
```

**Target — insert log line between destructuring and return:**
```typescript
const { appId } = await installAppFromUrl(parsedBody.githubUrl, {
  activate: parsedBody.activate,
  verified: parsedBody.verified,
  createdBy: session.user.id,
  preserveAutoUpdate: false
});

console.log(JSON.stringify({ appId, event: "app.installed" }));

return { ok: true, appId };
```

---

### `platform/apps/hub/server/api/admin/apps/local-sideload.post.ts` (API route handler, request-response)

**Change type:** Modify in-place — same `app.installed` log as `sideload.post.ts`.

**Current success block** (lines 19-24):
```typescript
const result = await installAppFromLocalPath(localPath, {
  activate,
  preserveConfig: true
});

return { ok: true, appId: result.appId };
```

**Target:**
```typescript
const result = await installAppFromLocalPath(localPath, {
  activate,
  preserveConfig: true
});

console.log(JSON.stringify({ appId: result.appId, event: "app.installed" }));

return { ok: true, appId: result.appId };
```

---

### `platform/apps/hub/server/api/admin/apps/[id].delete.ts` (API route handler, request-response)

**Change type:** Modify in-place — add `app.uninstalled` log after successful delete.

**Current success block** (lines 13-24):
```typescript
const db = getDb();
const deletedRows = await db.delete(installedApps).where(eq(installedApps.id, id)).returning();
const deleted = deletedRows[0];
if (!deleted) {
  throw createError({ statusCode: 404, statusMessage: "App not found." });
}

await refreshAppRegistry();

return {
  success: true,
  id: deleted.id
};
```

**Target — insert log before return:**
```typescript
const db = getDb();
const deletedRows = await db.delete(installedApps).where(eq(installedApps.id, id)).returning();
const deleted = deletedRows[0];
if (!deleted) {
  throw createError({ statusCode: 404, statusMessage: "App not found." });
}

await refreshAppRegistry();
console.log(JSON.stringify({ appId: deleted.appId, event: "app.uninstalled" }));

return {
  success: true,
  id: deleted.id
};
```

Note: `deleted.appId` assumes the `installedApps` schema has an `appId` column alongside `id`. Verify at `platform/packages/shared/src/db/schema.ts` — if the column is named differently, adjust accordingly.

---

### `platform/apps/bot/package.json` (config)

**Change type:** Modify `start` script to add `NODE_OPTIONS=--max-old-space-size=512`.

**Current `start` script** (line 9):
```json
"start": "node dist/apps/bot/src/index.js"
```

**Target:**
```json
"start": "NODE_OPTIONS=--max-old-space-size=512 node dist/apps/bot/src/index.js"
```

Note: The `dev` script uses `tsx` which inherits `NODE_OPTIONS` too, but this is acceptable — `tsx` is only used in development where memory pressure is lower.

---

### `platform/apps/hub/Dockerfile` (config)

**Change type:** Modify runner stage `CMD` to add `--max-old-space-size=1024`.

**Current CMD** (`Dockerfile` line 28):
```dockerfile
CMD ["node", ".output/server/index.mjs"]
```

**Target:**
```dockerfile
CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]
```

This is cleaner than `NODE_OPTIONS` in the Dockerfile because the Hub Dockerfile already uses a plain `node` CMD — adding the flag inline is explicit and Docker-layer-cached.

The Hub `package.json` `start` script currently is:
```json
"start": "node --env-file=../../.env .output/server/index.mjs"
```
This script is used for local preview runs (outside Docker). Add the flag there too for consistency:
```json
"start": "node --max-old-space-size=1024 --env-file=../../.env .output/server/index.mjs"
```

---

### `platform/.env.example` (config/docs)

**Change type:** Add `APP_HOOK_TIMEOUT_MS` documentation entry in the appropriate section.

**Existing pattern for optional vars** (`platform/.env.example` — commented-out optional vars):
```bash
# Optional: shared cookie domain for cross-subdomain sessions (e.g. .myweby.org)
# NUXT_SESSION_COOKIE_DOMAIN=
```

**Target — add to Apps section (create if absent, or append to appropriate section):**
```bash
# ─── Apps / Plugin System ────────────────────────────────────────────────────

# Timeout in milliseconds for app hook and route handler execution.
# Applies to both bot hooks (BotAppHookRegistry.emit) and Hub API route handlers.
# NOTE: Only interrupts async operations; synchronous tight loops are not affected.
# APP_HOOK_TIMEOUT_MS=5000
```

---

## Shared Patterns

### Structured Log Format (Hub — no consola)

**Source:** Verified by checking `platform/apps/hub/package.json` (no consola dep) and workspace hoisting (not hoisted).
**Apply to:** All three Hub files that need audit logging (`[...path].ts`, `sideload.post.ts`, `local-sideload.post.ts`, `[id].delete.ts`).

```typescript
// Structured log — machine-readable for `docker logs | grep '"event"'`
console.log(JSON.stringify({ appId, event: "app.installed" }));
console.warn(JSON.stringify({ appId, event: "route.timeout", durationMs: HOOK_TIMEOUT_MS }));
console.error(JSON.stringify({ appId, event: "route.error", error: (error as Error).message }));
```

Key names (`appId`, `event`, `durationMs`, `error`) are identical to the bot's consola format — consistent across both apps.

### Structured Log Format (Bot — consola)

**Source:** `platform/apps/bot/src/utils/logger.ts` lines 1-13.
**Apply to:** `app-hooks.ts` emit() method.

consola accepts an object as the first argument — no need for `JSON.stringify`:
```typescript
import { logger } from "./logger";

logger.warn({ appId, event: "hook.timeout", durationMs: HOOK_TIMEOUT_MS });
logger.error({ appId, event: "hook.error", error: (error as Error).message });
logger.info({ appId, event: "app.installed" }); // not needed in bot — only Hub install routes
```

### Auth Guard Pattern (Hub API routes)

**Source:** `platform/apps/hub/server/api/apps/[...path].ts` lines 9-11 and `sideload.post.ts` lines 17-18.
**Apply to:** All Hub API route handlers — already present, do not remove.

```typescript
// Existing pattern — requireSession throws 401 if no session, 403 if wrong role
const session = await requireSession(event);          // in [...path].ts
// or
await requireSuperadminSession(event);               // in sideload.post.ts, local-sideload.post.ts
await requireAdminSession(event);                    // in [id].delete.ts
```

### createError Pattern (Hub API routes)

**Source:** `platform/apps/hub/server/api/apps/[...path].ts` lines 16-17, 21-22.
**Apply to:** The new timeout/error throws in `[...path].ts`.

```typescript
// Auto-imported by Nuxt/Nitro — no explicit import needed
throw createError({ statusCode: 504, statusMessage: "App '${appId}' route handler timed out." });
throw createError({ statusCode: 500, statusMessage: "App '${appId}' route handler failed." });
```

### Hub Test File Structure

**Source:** `platform/apps/hub/server/api/__tests__/admin-apps.spec.ts` lines 1-50.
**Apply to:** New `path.spec.ts` test file.

Key invariants:
- Always import `stubNuxtAutoImports` / `cleanupAutoImportStubs` from `../../utils/__tests__/test-helpers`
- `beforeEach` calls `stubNuxtAutoImports()` to set up `createError`, `defineEventHandler`, `useRuntimeConfig`, `requireUserSession` as globals
- `afterEach` calls `cleanupAutoImportStubs()` + `vi.resetModules()` + `vi.clearAllMocks()`
- Handlers are imported via dynamic `await import(...)` inside each describe block (not at module top-level) so `vi.resetModules()` works correctly
- `createError` mock produces an `Error` with `.statusCode` and `.statusMessage` properties (see test-helpers.ts lines 112-120)

---

## No Analog Found

None — all files have direct analogs or are in-place modifications of existing files.

---

## Open Questions for Planner

1. **`deleted.appId` in `[id].delete.ts`** — The delete route uses `installedApps.id` (numeric PK) but needs `appId` (string) for the log. Verify the `returning()` result includes `appId`. If not, fetch `appId` before deleting, or omit `appId` from the `app.uninstalled` log and use `id` instead. Check `platform/packages/shared/src/db/schema.ts`.

2. **Activate/deactivate logging scope** — D-09 lists only `app.installed` and `app.uninstalled`. The `[appId]/status.put.ts` route toggles `active`/`inactive` status (not install/uninstall). Per RESEARCH.md open question #1, this should be `app.activated`/`app.deactivated` if logged at all. D-09 does not list these — planner should confirm with D-09 intent before adding. Default: skip `status.put.ts` in Phase 2.

3. **Bot `dev` script and NODE_OPTIONS** — Adding `NODE_OPTIONS=--max-old-space-size=512` to the `start` script does not affect `dev` (tsx). This is the safest approach; if dev-time memory cap is also desired, add `NODE_OPTIONS` to the `dev` script too.

---

## Metadata

**Analog search scope:** `platform/apps/bot/src/`, `platform/apps/hub/server/`
**Files read:** 13 source files + 2 config files
**Pattern extraction date:** 2026-04-17
