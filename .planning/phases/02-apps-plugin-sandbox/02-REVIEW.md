---
phase: 02-apps-plugin-sandbox
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/bot/src/utils/app-hooks.ts
  - apps/bot/src/utils/__tests__/app-hooks.spec.ts
  - apps/hub/server/api/apps/[...path].ts
  - apps/hub/server/api/apps/__tests__/path.spec.ts
  - apps/hub/server/api/admin/apps/sideload.post.ts
  - apps/hub/server/api/admin/apps/local-sideload.post.ts
  - apps/hub/server/api/admin/apps/[id].delete.ts
  - apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts
  - apps/bot/package.json
  - apps/hub/package.json
  - apps/hub/Dockerfile
  - .env.example
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 02 hardened the apps/plugin execution system across four plans: timeout guards via `Promise.race()` in the bot hook registry and Hub route handler, audit log lines on install/uninstall, and `--max-old-space-size` memory caps. The core changes are structurally sound and the test coverage for the new timeout behavior is solid.

Four concerns worth addressing before shipping:

1. **Critical** — `local-sideload.post.ts` accepts an arbitrary filesystem path from user input and reads files from it. Path traversal to any readable file on the server is possible unless `installAppFromLocalPath` (not reviewed here) validates that `localPath` is inside an allowed directory. Given the file reading confirmed in `app-sideload.ts:583-588`, this is a server-side path traversal risk.

2. **Warning** — `[id].delete.ts` uses `requireAdminSession` (admin role) while both sideload routes require `requireSuperadminSession`. Deleting an installed app is at least as privileged an action as installing one. The asymmetry looks unintentional.

3. **Warning** — The `timerId` variable in both timeout blocks is used in `finally { clearTimeout(timerId!) }` but is assigned inside the `Promise` constructor callback. Under the TypeScript type system it is `ReturnType<typeof setTimeout> | undefined` at the point `clearTimeout` runs, hence the non-null assertion `!`. This is safe at runtime when the timeout fires first, but if the handler resolves synchronously before the `Promise` constructor assigns `timerId`, there is a narrow window where `timerId` is `undefined` and `clearTimeout(undefined)` is called. In Node.js `clearTimeout(undefined)` is a no-op, so this is not a crash, but the pattern is fragile and should be structured to avoid the assertion.

4. **Warning** — The bot `dev` script (`"dev": "tsx src/index.ts"`) does not carry `NODE_OPTIONS=--max-old-space-size=512`. Only the `start` script (production) is capped. During development the bot runs without a heap limit, so any memory regression introduced during dev iteration will not be caught before the production limit is hit.

5. **Warning** — In `[...path].ts` (line 39), the sideloading guard checks `!import.meta.dev && !config.enableSideloading`. In production, sideloaded apps that are already installed in the DB and have `source === "sideloaded"` will be silently blocked at runtime. However, the check happens _after_ session validation and app lookup, meaning the error message (`"Sideloaded apps are only available when sideloading is enabled."`) leaks the existence of the installed sideloaded app to any authenticated user. This is an information disclosure, not a major risk, but worth noting.

---

## Critical Issues

### CR-01: Path traversal via `localPath` in local-sideload route

**File:** `apps/hub/server/api/admin/apps/local-sideload.post.ts:17`
**Issue:** `localPath` is taken directly from the request body (validated only as a non-empty string by the Zod schema) and passed to `installAppFromLocalPath`, which calls `readFile(join(localPath, "manifest.json"), ...)` and then reads arbitrary files under that path. A superadmin can supply e.g. `localPath: "/"` and read any file on the container filesystem. The route is correctly guarded to superadmin-only and sideloading must be enabled, so the blast radius is limited, but the path itself is completely unconstrained.

**Fix:** In `installAppFromLocalPath` (or in the route itself), resolve and validate that `localPath` is a subdirectory of an allow-listed base directory (e.g. an `APP_LOCAL_SIDELOAD_BASE_DIR` env var). Reject paths containing `..` before resolving, and after resolving compare with `startsWith`:

```typescript
import { resolve } from "node:path";

const ALLOWED_BASE = process.env.APP_LOCAL_SIDELOAD_BASE_DIR;
if (!ALLOWED_BASE) {
  throw createError({ statusCode: 500, statusMessage: "APP_LOCAL_SIDELOAD_BASE_DIR is not configured." });
}
const resolved = resolve(localPath);
if (!resolved.startsWith(resolve(ALLOWED_BASE) + "/")) {
  throw createError({ statusCode: 400, statusMessage: "localPath must be inside the configured sideload base directory." });
}
```

Add `APP_LOCAL_SIDELOAD_BASE_DIR` to `.env.example` as a required variable when local-sideloading is used.

---

## Warnings

### WR-01: `[id].delete.ts` uses `requireAdminSession` but sideload routes require `requireSuperadminSession`

**File:** `apps/hub/server/api/admin/apps/[id].delete.ts:9`
**Issue:** Installing an app requires superadmin (`requireSuperadminSession`) in both sideload routes. Uninstalling an app — a destructive, irreversible action — only requires admin (`requireAdminSession`). Any admin (not just superadmin) can delete any installed app, including marketplace apps. This asymmetry is almost certainly unintentional.

**Fix:** Elevate the delete route to `requireSuperadminSession`:

```typescript
import { requireSuperadminSession } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireSuperadminSession(event);
  // ...
});
```

If the intent is to let admins uninstall marketplace apps but only superadmins install them, document this explicitly.

### WR-02: Fragile `timerId!` non-null assertion in timeout blocks

**File:** `apps/bot/src/utils/app-hooks.ts:91-113`
**File:** `apps/hub/server/api/apps/[...path].ts:116-139`

**Issue:** Both timeout implementations declare `timerId` with `let timerId: ReturnType<typeof setTimeout>` (no initializer), assign it inside the `new Promise` executor, then access it in `finally { clearTimeout(timerId!) }`. The non-null assertion suppresses TypeScript's legitimate complaint. If `handler(event)` is synchronous and resolves before the Promise constructor executes the executor body (not possible in practice with `new Promise`, but conceptually fragile), `timerId` would be undefined. More practically: linters and future readers must trust the `!` is safe.

**Fix:** Either declare with a definite assignment assertion (`timerId!: ...`) or restructure to avoid the pattern by inlining the timer into a helper:

```typescript
// Cleaner pattern — no ! needed
let timerId: ReturnType<typeof setTimeout> | undefined;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(() => reject(new Error("timeout")), HOOK_TIMEOUT_MS);
});
try {
  await Promise.race([handler(event), timeoutPromise]);
} finally {
  clearTimeout(timerId); // undefined is safe, no assertion needed
}
```

### WR-03: Bot `dev` script lacks the memory cap set on `start`

**File:** `apps/bot/package.json:7`
**Issue:** The `start` script correctly adds `NODE_OPTIONS=--max-old-space-size=512` per Plan 02-04. The `dev` script (`"dev": "tsx src/index.ts"`) does not. Memory regressions in app hook code will only surface at the production heap limit, not during development.

**Fix:** Apply the same flag in dev mode:

```json
"dev": "NODE_OPTIONS=--max-old-space-size=512 tsx src/index.ts",
```

Or set it via an `.env` that tsx picks up, as long as the flag is consistently applied. If the full 512 MB is too restrictive for dev (e.g. source maps), use a higher value like 768 MB for dev with 512 MB for prod.

### WR-04: Sideloaded-app existence leaked to all authenticated users via error message

**File:** `apps/hub/server/api/apps/[...path].ts:37-42`
**Issue:** The sideloading guard fires _after_ the app is found in the runtime registry (line 33 succeeds). The error returned is `"Sideloaded apps are only available when sideloading is enabled."` — this tells any authenticated member that a specific sideloaded app exists in the system, even if they have no other way to enumerate installed apps.

**Fix:** Move the sideloading guard before or combine with the app-not-found check so it returns the same generic 404:

```typescript
if (!app || !app.manifest || (app.source === "sideloaded" && !import.meta.dev && !config.enableSideloading)) {
  throw createError({ statusCode: 404, statusMessage: `App '${appId}' not found or not active.` });
}
```

---

## Info

### IN-01: `loadInstalledAppHooks` test does not verify a hook actually executes

**File:** `apps/bot/src/utils/__tests__/app-hooks.spec.ts:206-229`
**Issue:** The "valid manifest with hook code registers hooks" test calls `loadInstalledAppHooks`, checks that `safeParseAppManifest` was called, but never emits the event to confirm the registered handler is invoked. The comment "The registry should have the hook — emit to check / We can't directly inspect" is incorrect — the test can emit and check:

```typescript
// After loadInstalledAppHooks:
const msgHandler = vi.fn();
botAppHookRegistry.register("test-app", "onMessage", msgHandler, /* ctx */);
// Actually: just emit and assert the real registered fn was called
```

The test as written would pass even if `register()` silently dropped the hook. This does not affect production correctness but weakens the test signal.

### IN-02: Audit log uses `console.log` inconsistently with the rest of the Hub server

**File:** `apps/hub/server/api/admin/apps/sideload.post.ts:27`
**File:** `apps/hub/server/api/admin/apps/local-sideload.post.ts:24`
**File:** `apps/hub/server/api/admin/apps/[id].delete.ts:21`
**Issue:** The project conventions (CLAUDE.md) note that server-side Nuxt uses `console` or Nitro logging with no custom logger — so `console.log` is technically within convention. However, `[...path].ts` uses `console.warn` and `console.error` for route-level events (lines 132, 135), while the audit lines use `console.log`. Using the same severity level for all structured log events makes it harder to filter by severity in log aggregation.

**Fix:** Use `console.info` for audit events (or `console.warn`/`console.error` consistently based on severity). Alternatively, promote all to a shared structured logger if one is added to Hub in a future phase.

### IN-03: `APP_HOOK_TIMEOUT_MS` env var is not in `.env.example` as a named variable

**File:** `.env.example:121`
**Issue:** The env var is documented as a comment (`# APP_HOOK_TIMEOUT_MS=5000`) rather than an uncommented entry like other optional vars. This is the correct pattern — the file is consistent. No action required; noted for awareness that the default is `5000` ms as documented.

---

_Reviewed: 2026-04-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
