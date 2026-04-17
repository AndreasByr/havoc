---
phase: 03-auth-session-haertung
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
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
  - apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts
  - apps/matrix-bot/src/utils/internal-sync-server.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This review covers the auth/session hardening deliverables: NODE_ENV-based cookie `secure` flag, deny-by-default session middleware with an explicit `PUBLIC_PATHS` allow-list, CSRF middleware with documented SSR-internal origin-skip, `import.meta.dev` compile-time guards on all dev endpoints, dev role switcher with no runtime fallbacks, CSRF-preserving session rotation, and the Matrix bot internal sync server with timing-safe token comparison and fail-loud 503 on empty token.

The core hardening changes are sound. The 503 MISCONFIGURED path in the Matrix bot correctly addresses the previous CR-01 (empty-token auth bypass). The `import.meta.dev` guard pattern, timing-safe comparison, and session rotation logic are all implemented correctly.

Three warnings were found: a CSRF bypass prefix that over-matches future routes with a `/api/auth/discord` prefix; a sort in the dev users listing that will throw a TypeError if any user's `displayName` is null; and an unbounded body accumulation in the Matrix bot's `parseBody` that allows arbitrary memory growth from large POST bodies. Three info items cover dead code and silent error suppression in the Matrix bot route handlers.

## Warnings

### WR-01: CSRF bypass prefix over-matches `/api/auth/discord*` suffixes

**File:** `apps/hub/server/middleware/02-csrf-check.ts:8`

**Issue:** The exemption `path.startsWith("/api/auth/discord")` would silently bypass CSRF validation for any future route whose path begins with `/api/auth/discord` — for example `/api/auth/discord-link`, `/api/auth/discord-connect`, `/api/auth/discord2`. The current Discord OAuth routes use locale-prefixed paths (`/[locale]/auth/discord/callback`) and do not appear to go through `/api/auth/discord` as a prefix, meaning this bypass may already be broader than necessary. Any future developer adding a route like `/api/auth/discord-settings` (POST) would bypass CSRF validation silently.

**Fix:** Replace the open `startsWith` with an exact path match or a trailing-slash-anchored prefix:
```typescript
// Replace:
if (path === "/api/csrf-token" || path.startsWith("/api/auth/discord")) return;

// With:
if (path === "/api/csrf-token" || path === "/api/auth/discord" || path.startsWith("/api/auth/discord/")) return;
```
If there are no current routes at exactly `/api/auth/discord`, the first two alternatives can be collapsed into just the slash-anchored prefix.

---

### WR-02: Sort in dev users listing throws TypeError when `displayName` is null

**File:** `apps/hub/server/api/dev/users.get.ts:29`

**Issue:** `a.profileName.localeCompare(b.profileName)` throws `TypeError: Cannot read properties of null (reading 'localeCompare')` if `user.displayName` is null for any row. The value is mapped directly: `profileName: user.displayName` (line 26), so any DB row with a null `display_name` crashes the entire dev users endpoint. If a partially-created user record exists (e.g., after a failed OAuth flow before `displayName` is written), this endpoint becomes permanently broken until that row is cleaned up.

**Fix:**
```typescript
.sort((a, b) => (a.profileName ?? "").localeCompare(b.profileName ?? ""));
```

---

### WR-03: No body size limit in Matrix bot `parseBody` allows unbounded memory allocation

**File:** `apps/matrix-bot/src/utils/internal-sync-server.ts:283-297`

**Issue:** `parseBody` accumulates all incoming data chunks into an in-memory buffer with no size cap. The `/internal/sync-user` endpoint invokes this for every POST request. An attacker with the internal token (or a misconfigured Hub sending a large payload) can cause the bot process to allocate arbitrarily large buffers before the JSON parse or garbage collection runs. For a bot process that may run for days, this is a memory exhaustion risk.

**Fix:** Add a size guard of approximately 1 MB (sufficient for any legitimate sync payload):
```typescript
function parseBody(req: http.IncomingMessage, maxBytes = 1_048_576): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : null);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
```

---

## Info

### IN-01: Dead `if (userId)` guard in `locale-context.get.ts` — always true after `requireSession`

**File:** `apps/hub/server/api/internal/locale-context.get.ts:20`

**Issue:** `requireSession(event)` on line 13 throws 401 if the user is unauthenticated, so `session.user.id` is always a non-empty string by line 17. The `if (userId)` guard on line 20 is dead code — the false branch is unreachable. The returned `hasSession` field is always `true`.

**Fix:** Remove the redundant guard and simplify:
```typescript
const [profile] = await db
  .select({ localePreference: profiles.localePreference, customFields: profiles.customFields })
  .from(profiles)
  .where(eq(profiles.userId, userId))
  .limit(1);

const localePreference = normalizeUserLocalePreference(
  profile?.localePreference ?? readLegacyLocalePreferenceFromCustomFields(profile?.customFields ?? {}),
  null
);
```
If `hasSession` in the return value is used by callers, it can remain as `hasSession: true` (a constant). If it is not used, remove it from the response shape.

---

### IN-02: Silent `catch` blocks in Matrix bot handlers mask real errors

**File:** `apps/matrix-bot/src/utils/internal-sync-server.ts:176,202,268`

**Issue:** Three bare `catch {}` blocks in `handleGetRoles`, `handleGetChannels`, and `handleSyncUser` discard all error information and return an empty/partial success response. A Matrix SDK network timeout, server-side permission error, or API shape change is indistinguishable from a valid empty state (e.g., no rooms in the space). This makes silent regressions very hard to detect.

**Fix:** Log the error before returning the fallback in each catch:
```typescript
} catch (err) {
  console.error("[matrix-bot] handleGetRoles failed:", err instanceof Error ? err.message : err);
  return { roles: [] };
}
```

---

### IN-03: Empty try block in `handleSyncUser` is dead code

**File:** `apps/matrix-bot/src/utils/internal-sync-server.ts:245-251`

**Issue:** Lines 245-251 contain a try block with no executable statements inside. The comment explains that Matrix does not support setting other users' display names, so the intent is to do nothing — but the try/catch structure implies something was planned and never implemented. The outer `if (payload.profileName && spaceId)` branch evaluates, enters the try, executes nothing, and exits. This is dead code that creates misleading structure.

**Fix:** Remove the dead block and replace with a comment at the call site:
```typescript
// Display name sync is not supported for Matrix (cannot set other users' display names).
// Power level sync below handles permission role enforcement.
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
