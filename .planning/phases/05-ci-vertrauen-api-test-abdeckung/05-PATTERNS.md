# Phase 5: CI-Vertrauen & API-Test-Abdeckung - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/ci.yml` | config | request-response | `.github/workflows/release.yml` | exact |
| `.github/workflows/release.yml` | config | request-response | `.github/workflows/ci.yml` | exact |
| `apps/matrix-bot/src/index.ts` | config | — | `apps/bot/src/index.ts` | role-match |
| `apps/hub/eslint.config.mjs` | config | — | `apps/web/eslint.config.mjs` | exact |
| `apps/web/eslint.config.mjs` | config | — | `apps/hub/eslint.config.mjs` | exact |
| `apps/hub/server/api/__tests__/auth-routes.spec.ts` | test | request-response | `apps/hub/server/api/apps/__tests__/path.spec.ts` | exact |
| `apps/hub/server/api/__tests__/mod-routes.spec.ts` | test | request-response | `apps/hub/server/api/__tests__/admin-users.spec.ts` | exact |
| `apps/hub/server/api/__tests__/admin-settings.spec.ts` | test | request-response | `apps/hub/server/api/__tests__/admin-platforms.spec.ts` | exact |
| `apps/hub/server/api/__tests__/community-settings.spec.ts` | test | request-response | `apps/hub/server/api/__tests__/member-profile.spec.ts` | role-match |
| `apps/hub/server/api/**/*.{ts,vue}` (257 lint fixes) | utility/controller | CRUD | `apps/hub/server/api/__tests__/admin-users.spec.ts` | role-match |
| `.planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md` | — | — | none | no analog |

---

## Pattern Assignments

### `.github/workflows/ci.yml` (config — remove `continue-on-error`)

**Change:** Remove `continue-on-error: true` from the Lint step only. The Security audit step in `release.yml` keeps its `continue-on-error: true` — only the Lint step is changed.

**Current state** (lines 20-22):
```yaml
      - name: Lint
        run: pnpm lint
        continue-on-error: true
```

**Target state** (replace with):
```yaml
      - name: Lint
        run: pnpm lint
```

**Prerequisite:** `pnpm lint` must exit 0 before this line is removed. Do not remove it while lint still fails.

---

### `.github/workflows/release.yml` (config — remove `continue-on-error` from Lint only)

**Change:** Same as ci.yml — remove `continue-on-error: true` from the Lint step only. Leave the Security audit step unchanged.

**Analog:** `.github/workflows/ci.yml` (lines 20-22 — identical lint step structure)

**Current state** (lines 22-24 in release.yml):
```yaml
      - name: Lint
        run: pnpm lint
        continue-on-error: true
```

**Keep unchanged** (lines 29-31 in release.yml):
```yaml
      - name: Security audit
        run: pnpm audit --audit-level=high
        continue-on-error: true
```

---

### `apps/matrix-bot/src/index.ts` (config — fix TS2322 typecheck error)

**Change:** One line fix at line 44. `BOT_INTERNAL_TOKEN` is `string | undefined` from `process.env`, but `startInternalSyncServer` expects `token: string`. The guard on lines 21-26 exits the process if `BOT_INTERNAL_TOKEN` is falsy, but TypeScript's narrowing does not carry across the function boundary.

**Current state** (line 44):
```typescript
    token: BOT_INTERNAL_TOKEN,
```

**Target state** (non-null assertion after the existing guard):
```typescript
    token: BOT_INTERNAL_TOKEN!,
```

**Full context of the call** (lines 40-45 of `apps/matrix-bot/src/index.ts`):
```typescript
  startInternalSyncServer({
    client,
    spaceId: SPACE_ID || null,
    port: BOT_INTERNAL_PORT,
    token: BOT_INTERNAL_TOKEN!,
  });
```

---

### `apps/hub/eslint.config.mjs` (config — add security plugins)

**Analog:** `apps/web/eslint.config.mjs` (identical current structure — both are 6-line withNuxt wrappers)

**Current state** (`apps/hub/eslint.config.mjs`, lines 1-6):
```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
)
```

**Target state** (after `pnpm --filter @guildora/hub add -D eslint-plugin-security eslint-plugin-no-unsanitized`):
```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import pluginSecurity from 'eslint-plugin-security'
import nounsanitized from 'eslint-plugin-no-unsanitized'

export default withNuxt(
  pluginSecurity.configs.recommended,
  nounsanitized.configs.recommended,
)
```

**Per D-03:** Any security plugin finding that cannot be fixed immediately must use a line-level suppress, not file-level:
```javascript
// eslint-disable-next-line security/detect-non-literal-require -- intentional: app bundle execution by design
```

---

### `apps/web/eslint.config.mjs` (config — security plugins, if needed)

**Analog:** `apps/hub/eslint.config.mjs` (same withNuxt pattern)

**Current state** (lines 1-6 — identical to hub):
```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
)
```

Web already has 0 lint errors (exit 0). Security plugin integration may produce new findings. Apply same pattern as hub if D-02 extends to web. The web app is server-side Nuxt with no dynamic require, so `detect-object-injection` is the most likely trigger.

---

### `apps/hub/server/api/__tests__/auth-routes.spec.ts` (test — NEW)

**Analog:** `apps/hub/server/api/apps/__tests__/path.spec.ts` — best match because it mocks `../../utils/auth` as a named module (not just via `stubNuxtAutoImports`), which is required for `requireSession`-based guards.

**Routes covered:** `POST /api/auth/logout`, `GET /api/csrf-token`

**Imports pattern** (copy from `path.spec.ts` lines 1-14):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;
```

**Module mocks for auth-routes.spec.ts:**

`logout.post.ts` uses only `clearUserSession` (Nuxt auto-import). No db, no shared imports.
`csrf-token.get.ts` uses `getUserSession`, `generateCsrfToken`, `setUserSession` (all Nuxt auto-imports — already stubbed in `stubNuxtAutoImports` or need `vi.stubGlobal`).

```typescript
// auth-routes.spec.ts has no vi.mock() calls — all dependencies are Nuxt auto-imports
// stub them in beforeEach via stubNuxtAutoImports() + additional vi.stubGlobal() calls

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("clearUserSession", vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal("getUserSession", vi.fn());
  vi.stubGlobal("generateCsrfToken", vi.fn().mockReturnValue("new-csrf-token-xyz"));
  vi.stubGlobal("setUserSession", vi.fn().mockResolvedValue(undefined));
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});
```

**Core test pattern for logout** (handler has no auth guard — just clears session):
```typescript
describe("POST /api/auth/logout", () => {
  async function importHandler() {
    return (await import("../auth/logout.post")).default;
  }

  it("clears session and returns ok (200)", async () => {
    const handler = await importHandler();
    const event = createMockEvent({ method: "POST", path: "/api/auth/logout" });
    const result = await handler(event);
    expect(result.ok).toBe(true);
    expect(vi.mocked(globalThis.clearUserSession as any)).toHaveBeenCalledWith(event);
  });
});
```

**Core test pattern for csrf-token** (no auth guard — creates token for any visitor):
```typescript
describe("GET /api/csrf-token", () => {
  async function importHandler() {
    return (await import("../csrf-token.get")).default;
  }

  it("generates new token when no session token exists", async () => {
    vi.mocked(globalThis.getUserSession as any).mockResolvedValue({});
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);
    expect(result.token).toBe("new-csrf-token-xyz");
    expect(vi.mocked(globalThis.setUserSession as any)).toHaveBeenCalled();
  });

  it("returns existing token when session already has one", async () => {
    vi.mocked(globalThis.getUserSession as any).mockResolvedValue({
      csrfToken: "existing-csrf-token"
    });
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);
    expect(result.token).toBe("existing-csrf-token");
    expect(vi.mocked(globalThis.setUserSession as any)).not.toHaveBeenCalled();
  });
});
```

---

### `apps/hub/server/api/__tests__/mod-routes.spec.ts` (test — NEW)

**Analog:** `apps/hub/server/api/__tests__/admin-users.spec.ts` — exact match: same role (route test), same data flow (CRUD with auth guard), same session mock pattern.

**Key difference from admin tests:** Mod routes use `requireModeratorSession` which is a **named import** in each handler file, NOT a Nuxt auto-import. Must mock `../../utils/auth` explicitly.

**Imports pattern** (copy from `admin-users.spec.ts` lines 1-17):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;
```

**Module mocks** — critical: must mock `../../utils/auth` for `requireModeratorSession`:
```typescript
// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../utils/auth", () => ({
  requireModeratorSession: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/community", () => ({
  listCommunityRoles: vi.fn().mockResolvedValue([]),
  listPermissionRoles: vi.fn().mockResolvedValue([]),
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id", discordId: "discord_id", displayName: "display_name" },
  userCommunityRoles: { userId: "user_id", communityRoleId: "community_role_id" },
  communityRoles: { id: "id", name: "name", discordRoleId: "discord_role_id" },
  parseProfileName: vi.fn((name: string) => ({ ingameName: name, rufname: name })),
}));

vi.mock("../../utils/user-directory", () => ({
  loadUserCommunityRolesMap: vi.fn().mockResolvedValue(new Map()),
  loadUserPermissionRolesMap: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../utils/http", () => ({
  parsePaginationQuery: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}));
```

**beforeEach/afterEach** (copy from `admin-users.spec.ts` lines 52-62):
```typescript
beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));
  vi.stubGlobal("getRouterParam", vi.fn());
  vi.stubGlobal("readBody", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});
```

**DB chain helper** (copy from `admin-platforms.spec.ts` lines 62-76):
```typescript
function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function) => resolve(returnValue);
  return chain;
}
```

**Auth-check pattern per describe block** — mod routes must reject 401 and 403:
```typescript
// ─── GET /api/mod/users ──────────────────────────────────────────────────────

describe("GET /api/mod/users", () => {
  async function importHandler() {
    return (await import("../mod/users/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    const { requireModeratorSession } = await import("../../utils/auth");
    vi.mocked(requireModeratorSession).mockRejectedValue(
      Object.assign(new Error("Authentication required."), { statusCode: 401 })
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/mod/users" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    const { requireModeratorSession } = await import("../../utils/auth");
    vi.mocked(requireModeratorSession).mockRejectedValue(
      Object.assign(new Error("Forbidden."), { statusCode: 403 })
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/mod/users" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("returns user list for moderator (200)", async () => {
    const { requireModeratorSession } = await import("../../utils/auth");
    vi.mocked(requireModeratorSession).mockResolvedValue(buildSession("moderator") as any);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbChain([]) as any);
    // count query for pagination:
    vi.mocked(getDb).mockReturnValueOnce(mockDbChain([{ total: 0 }]) as any);

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET", path: "/api/mod/users" });
    const result = await handler(event);
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("pagination");
  });
});
```

**Handler import paths for all 12 mod routes** (relative to `server/api/__tests__/`):
```
../mod/users/index.get
../mod/community-roles/index.get
../mod/community-roles/index.post
../mod/community-roles/[id].put
../mod/community-roles/[id].delete
../mod/discord-roles.get
../mod/tags/index.get
../mod/tags/index.post
../mod/users/[id]/community-role.put
../mod/users/[id]/profile.put
../mod/users/batch-community-role.post
../mod/users/batch-discord-roles.post
```

---

### `apps/hub/server/api/__tests__/admin-settings.spec.ts` (test — NEW)

**Analog:** `apps/hub/server/api/__tests__/admin-platforms.spec.ts` — exact match: admin-guard routes with CRUD DB pattern.

**Routes covered:** `GET/PUT /api/admin/community-settings`, `GET/PUT /api/admin/theme`, `GET/PUT /api/admin/membership-settings`, `GET/PUT /api/admin/moderation-rights`, `GET /api/admin/discord-roles`

**Key difference from mod-routes:** `requireAdminSession` is a named import from `../../utils/auth` (same pattern as `requireModeratorSession`). Must also be mocked via `vi.mock("../../utils/auth", ...)`.

**Module mocks:**
```typescript
vi.mock("../../utils/auth", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/community-settings", () => ({
  COMMUNITY_SETTINGS_SINGLETON_ID: "singleton",
  loadCommunitySettingsLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("../../../utils/locale-preference", () => ({
  normalizeCommunityDefaultLocale: vi.fn((val: string | null, fallback: string) => val ?? fallback),
}));

vi.mock("@guildora/shared", () => ({
  communitySettings: {
    id: "id",
    communityName: "community_name",
    discordInviteCode: "discord_invite_code",
    defaultLocale: "default_locale",
    displayNameTemplate: "display_name_template",
  },
}));
```

**Auth-check pattern** (copy from `admin-platforms.spec.ts` lines 85-92):
```typescript
describe("GET /api/admin/community-settings", () => {
  async function importHandler() {
    return (await import("../admin/community-settings.get")).default;
  }

  it("requires admin session (non-admin gets 403)", async () => {
    const { requireAdminSession } = await import("../../utils/auth");
    vi.mocked(requireAdminSession).mockRejectedValue(
      Object.assign(new Error("Forbidden."), { statusCode: 403 })
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    await expect(handler(event)).rejects.toThrow("Forbidden");
  });

  it("requires authentication (no session = 401)", async () => {
    const { requireAdminSession } = await import("../../utils/auth");
    vi.mocked(requireAdminSession).mockRejectedValue(
      Object.assign(new Error("Authentication required."), { statusCode: 401 })
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("returns community settings for admin (200)", async () => {
    const { requireAdminSession } = await import("../../utils/auth");
    vi.mocked(requireAdminSession).mockResolvedValue(buildSession("admin") as any);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue(mockDbChain([{
      communityName: "Test Community",
      discordInviteCode: "abc123",
      defaultLocale: "en",
      displayNameTemplate: []
    }]) as any);

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);
    expect(result).toHaveProperty("communityName");
    expect(result).toHaveProperty("defaultLocale");
  });
});
```

**Handler import paths** (relative to `server/api/__tests__/`):
```
../admin/community-settings.get
../admin/community-settings.put
../admin/theme.get
../admin/theme.put
../admin/membership-settings.get
../admin/membership-settings.put
../admin/moderation-rights.get
../admin/moderation-rights.put
../admin/discord-roles.get
```

---

### `apps/hub/server/api/__tests__/community-settings.spec.ts` (test — NEW)

**Analog:** `apps/hub/server/api/__tests__/member-profile.spec.ts` — role-match: requires a lower guard (`requireSession` not `requireAdminSession`), any authenticated user.

**Routes covered:** `GET /api/community-settings/display-name-template`, `GET /api/apps`, `GET /api/apps/navigation`, `POST /api/apps/[appId]/activate`, `POST /api/apps/[appId]/deactivate`

**Key difference:** `requireSession` is a named import from `../../utils/auth` (same pattern as above), NOT a Nuxt auto-import. Must be mocked via `vi.mock("../../utils/auth", ...)`.

**Module mocks:**
```typescript
vi.mock("../../utils/auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/community-settings", () => ({
  loadDisplayNameTemplate: vi.fn().mockResolvedValue([]),
}));
```

**Auth-check pattern** (uses `requireUserSession` rejection for unauthenticated via `requireSession` chain):
```typescript
describe("GET /api/community-settings/display-name-template", () => {
  async function importHandler() {
    return (await import("../community-settings/display-name-template.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    const { requireSession } = await import("../../utils/auth");
    vi.mocked(requireSession).mockRejectedValue(
      Object.assign(new Error("Authentication required."), { statusCode: 401 })
    );

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("returns display name template for authenticated user (200)", async () => {
    const { requireSession } = await import("../../utils/auth");
    vi.mocked(requireSession).mockResolvedValue(buildSession("user") as any);

    const { getDb } = await import("../../utils/db");
    vi.mocked(getDb).mockReturnValue({} as any);

    const { loadDisplayNameTemplate } = await import("../../utils/community-settings");
    vi.mocked(loadDisplayNameTemplate).mockResolvedValue([]);

    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    const result = await handler(event);
    expect(result).toHaveProperty("displayNameTemplate");
  });
});
```

---

### Hub lint fixes — 257 errors across 82 files

**No analog needed for the mechanical fixes.** Pattern guidance from RESEARCH.md:

| Error | Fix Strategy |
|-------|-------------|
| `@typescript-eslint/no-explicit-any` (149) — test files | Replace `any` in mock chain builders with `Record<string, unknown>` or typed generics; `Function` → `(...args: unknown[]) => unknown` |
| `@typescript-eslint/no-explicit-any` (149) — prod files | Add explicit types to function signatures and return values |
| `@typescript-eslint/no-unused-vars` (51) | Remove unused imports and variables |
| `@typescript-eslint/unified-signatures` (24) | Merge Vue emit overloads into union types |
| `import/no-duplicates` (16) | Merge split import statements from same module |
| `@typescript-eslint/no-dynamic-delete` (5) | Replace `delete obj[key]` with object rest spread or `Map.delete()` |
| `vue/no-mutating-props` (1) — `SimpleFormField.vue:108` | Extract prop value to local `ref` |
| `vue/no-v-text-v-html-on-component` (1) — `LandingPreview.vue:74` | Move `v-html` to a native HTML element, not a component |
| `vue/html-self-closing` (75 warnings) | Run `pnpm --filter @guildora/hub lint --fix` to auto-fix |

**Critical anti-pattern (D-03):** Do NOT suppress with `/* eslint-disable */`. For unavoidable suppressions after security plugin integration:
```typescript
// eslint-disable-next-line security/detect-non-literal-require -- intentional: app bundle CJS execution by design
const mod = require(bundlePath);
```

---

## Shared Patterns

### Auth Guard Mocking (applies to all 4 new spec files)

**Source:** `apps/hub/server/utils/auth.ts` (lines 33-74) + `apps/hub/server/api/apps/__tests__/path.spec.ts` (lines 27-29)

The three guard functions are named exports, NOT Nuxt auto-imports. They must be mocked via `vi.mock`, never via `vi.stubGlobal`.

```typescript
// For requireModeratorSession (mod-routes.spec.ts):
vi.mock("../../utils/auth", () => ({
  requireModeratorSession: vi.fn(),
}));

// For requireAdminSession (admin-settings.spec.ts):
vi.mock("../../utils/auth", () => ({
  requireAdminSession: vi.fn(),
}));

// For requireSession (community-settings.spec.ts):
vi.mock("../../utils/auth", () => ({
  requireSession: vi.fn(),
}));
```

**Control mock per test case** (do NOT set return value at module-mock level):
```typescript
// 401 rejection:
vi.mocked(requireModeratorSession).mockRejectedValue(
  Object.assign(new Error("Authentication required."), { statusCode: 401 })
);

// 403 rejection:
vi.mocked(requireModeratorSession).mockRejectedValue(
  Object.assign(new Error("Forbidden."), { statusCode: 403 })
);

// Success:
vi.mocked(requireModeratorSession).mockResolvedValue(buildSession("moderator") as any);
```

---

### `vi.resetModules()` + Dynamic `importHandler()` Pattern (applies to all spec files)

**Source:** `apps/hub/server/api/__tests__/admin-users.spec.ts` (lines 58-62, 77-79)

Every describe block defines its own `importHandler()` function. `vi.resetModules()` in `afterEach` ensures the handler module is re-evaluated fresh for each test group, preventing mock state leakage between describe blocks.

```typescript
afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();   // CRITICAL — clears module registry so dynamic import re-evaluates
  vi.clearAllMocks();
});

// Inside each describe block:
describe("GET /api/mod/some-route", () => {
  async function importHandler() {
    return (await import("../mod/some-route.get")).default;
  }

  it("test case", async () => {
    const handler = await importHandler(); // fresh import after resetModules
    // ...
  });
});
```

---

### `stubNuxtAutoImports()` + Session Factories (applies to all spec files)

**Source:** `apps/hub/server/utils/__tests__/test-helpers.ts` (lines 104-153)

All Nuxt/h3 auto-imported functions (`requireUserSession`, `createError`, `defineEventHandler`, `getMethod`, `getHeader`, `setResponseHeader`, `getRequestIP`, `useRuntimeConfig`, `defineNitroPlugin`, `validateCsrfToken`) are stubbed in `beforeEach` by calling `stubNuxtAutoImports()`. The return value (`mocks`) exposes each stub for per-test control.

```typescript
let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // Add extra stubs for functions the specific handler uses:
  vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
});
```

**Session factories from test-helpers.ts:**
```typescript
// Any authenticated user:
buildSession("user")
buildSession("moderator")
buildSession("admin")
buildSession("superadmin")

// With specific user ID override:
buildSession("admin", { userOverrides: { id: "specific-user-id" } })

// Returns full AppSession with csrfToken and user.permissionRoles
```

---

### DB Chain Mock Helper (applies to admin-settings.spec.ts, mod-routes.spec.ts)

**Source:** `apps/hub/server/api/__tests__/admin-platforms.spec.ts` (lines 62-76)

Drizzle ORM queries are chainable. Mock the chain by returning `this` from each method and resolving via `.then`:

```typescript
function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function) => resolve(returnValue);
  return chain;
}
```

**Usage:**
```typescript
const { getDb } = await import("../../utils/db");
vi.mocked(getDb).mockReturnValue(mockDbChain([{ id: "row-1" }]) as any);
```

---

### ESLint Flat Config Plugin Integration Pattern

**Source:** `apps/hub/eslint.config.mjs` (current 6-line structure) + RESEARCH.md ESLint Plugin Integration section

`withNuxt()` accepts flat config objects as positional arguments. Both security plugins publish a `.configs.recommended` export compatible with ESLint 10 flat config:

```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import pluginSecurity from 'eslint-plugin-security'
import nounsanitized from 'eslint-plugin-no-unsanitized'

export default withNuxt(
  pluginSecurity.configs.recommended,
  nounsanitized.configs.recommended,
)
```

**Installation command:**
```bash
pnpm --filter @guildora/hub add -D eslint-plugin-security eslint-plugin-no-unsanitized
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md` | document | — | No existing CI audit documents in codebase; document artifact, not code |

---

## Key Pitfalls (extracted from RESEARCH.md)

1. **Remove `continue-on-error` AFTER lint is clean** — not before. Running `pnpm --filter @guildora/hub lint` must exit 0 locally first.

2. **`requireModeratorSession` / `requireAdminSession` / `requireSession` are NOT auto-imports** — mock them via `vi.mock("../../utils/auth", ...)`, not `vi.stubGlobal`. The chain is `requireModeratorSession → requireSession → requireUserSession`; stubbing only `requireUserSession` via `stubNuxtAutoImports` does NOT bypass the role check.

3. **`vi.mock()` factories must not reference non-hoisted variables** — Vitest hoists `vi.mock()` calls. Use only inline values in factory functions. Set mock return values in `beforeEach` or per-test via `vi.mocked(fn).mockReturnValue(...)`.

4. **`vi.resetModules()` in `afterEach` is not optional** — without it, the second describe block's `importHandler()` returns the cached module from the first block, with stale mocks.

5. **No file-level `/* eslint-disable */`** — D-03 is explicit. Use `// eslint-disable-next-line rule -- reason` per offending line.

---

## Metadata

**Analog search scope:** `apps/hub/server/api/__tests__/`, `apps/hub/server/utils/__tests__/`, `apps/hub/server/api/apps/__tests__/`, `apps/hub/server/api/mod/`, `.github/workflows/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-04-18
