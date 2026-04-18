# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Unit/Integration Runner:**
- Vitest 2.1.x
- Workspace config: `platform/vitest.workspace.ts`
- Per-app configs: `platform/apps/hub/vitest.config.ts`, `platform/apps/bot/vitest.config.ts`, `platform/apps/matrix-bot/vitest.config.ts`, `platform/packages/shared/vitest.config.ts`

**E2E Runner:**
- Playwright (hub): config at `platform/apps/hub/playwright.config.ts`
- Playwright (marketplace): config at `marketplace/playwright.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible)
- Playwright built-in `expect` with web-first assertions

**Run Commands:**
```bash
# Vitest (from platform/)
pnpm test                    # Run all unit tests via Turbo
pnpm test:watch              # Watch mode (vitest workspace)
pnpm test:coverage           # Coverage report

# Playwright - Hub (from platform/apps/hub/)
npx playwright test          # Run hub E2E tests

# Playwright - Marketplace (from marketplace/)
pnpm test:e2e                # Run marketplace E2E tests
pnpm test:e2e:ui             # Run with Playwright UI mode
```

## Test File Organization

**Location:** Co-located `__tests__/` directories next to source (preferred pattern)

**Naming:** `*.spec.ts` (dominant convention), `*.test.ts` (also accepted)

**Structure:**
```
platform/
  apps/hub/
    server/utils/__tests__/          # Unit tests for server utils
    server/api/__tests__/            # API route integration tests
    app/composables/__tests__/       # Client composable tests
    utils/__tests__/                 # Shared util tests
    tests/                           # Playwright E2E tests (separate dir)
  apps/bot/
    src/events/__tests__/            # Event handler tests
    src/interactions/__tests__/      # Interaction handler tests
    src/utils/__tests__/             # Utility tests
  apps/matrix-bot/
    src/__tests__/                   # Bot tests
  packages/shared/
    src/__tests__/                   # Package-level tests
    src/utils/__tests__/             # Utility tests
    src/test-utils/                  # Shared factories and helpers
marketplace/
  e2e/                               # Playwright E2E tests
```

**Integration tests:** Suffixed `*.integration.spec.ts`, excluded from default vitest runs (see `platform/packages/shared/vitest.config.ts` exclude pattern)

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────
vi.mock("../../utils/db", () => ({ getDb: vi.fn() }));

// ─── Setup ──────────────────────────────────────────────────────────────────
let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

// ─── Dynamic import (for modules using auto-imports) ────────────────────────
async function importModule() {
  return import("../module-under-test");
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("featureName", () => {
  it("describes expected behavior", async () => {
    const { functionUnderTest } = await importModule();
    expect(functionUnderTest()).toBe(expected);
  });
});
```

**Patterns:**
- Section dividers with box-drawing characters: `// ─── Section Name ───`
- `beforeEach` for setup, `afterEach` for cleanup
- `vi.resetModules()` in `afterEach` when using dynamic imports
- Descriptive `it` strings starting with a verb: "allows", "throws", "returns", "ignores"

## Mocking

**Framework:** Vitest built-in (`vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stubGlobal`)

**Nuxt Auto-Import Stubbing (critical pattern):**

Since Nuxt auto-imports functions like `createError`, `defineEventHandler`, `useRuntimeConfig` etc. as globals, tests must stub them explicitly. The canonical helper is at `platform/apps/hub/server/utils/__tests__/test-helpers.ts`:

```typescript
import { vi } from "vitest";

export function stubNuxtAutoImports() {
  const mocks = {
    requireUserSession: vi.fn(),
    getUserSession: vi.fn(),
    createError: vi.fn((opts) => {
      const err = new Error(opts.statusMessage);
      err.statusCode = opts.statusCode;
      return err;
    }),
    defineEventHandler: vi.fn((handler) => handler),
    useRuntimeConfig: vi.fn(() => ({})),
    // ... more auto-imports
  };
  for (const [name, fn] of Object.entries(mocks)) {
    vi.stubGlobal(name, fn);
  }
  return mocks;
}

export function cleanupAutoImportStubs() {
  vi.unstubAllGlobals();
}
```

Use `stubNuxtAutoImports()` in `beforeEach`, `cleanupAutoImportStubs()` in `afterEach`.

**Dynamic Import Pattern:**

When testing modules that depend on auto-imported globals, use dynamic `import()` after stubbing globals:

```typescript
async function importAuth() {
  return import("../auth");
}

it("test case", async () => {
  const { requireRole } = await importAuth();
  // ... assertions
});
```

**Module Mocking:**
```typescript
vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/botSync", () => ({
  addDiscordRolesToMember: vi.fn().mockResolvedValue({ addedRoleIds: [] }),
  sendDiscordDm: vi.fn().mockResolvedValue(undefined),
}));
```

**Mock DB Query Chain:**
```typescript
function mockDbChain(returnValue: any) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      Array.isArray(returnValue) ? returnValue : [returnValue]
    ),
    innerJoin: vi.fn().mockReturnThis(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
}
```

**What to Mock:**
- Nuxt/Nitro auto-imports (always, via `stubNuxtAutoImports`)
- Database layer (`getDb`)
- External services (Discord bot bridge, `botSync`)
- Loggers (`logger.info`, `logger.warn`, `logger.error`)
- Workspace package imports when testing in isolation (`@guildora/shared`, `@guildora/app-sdk`)

**What NOT to Mock:**
- The function under test itself
- Pure utility functions (test directly)
- Zod schemas (test validation behavior directly)
- Types and interfaces

## Fixtures and Factories

**Test Data Factories:**

Shared factories at `platform/packages/shared/src/test-utils/factories.ts`:
```typescript
import { resetFactoryCounters, buildUser, buildProfile,
  buildMinimalFlowGraph, buildLinearFlowGraph } from "@guildora/shared/test-utils";

beforeEach(() => {
  resetFactoryCounters();  // Reset ID counters for deterministic tests
});

const user = buildUser({ displayName: "Alice" });
const graph = buildLinearFlowGraph();
```

Hub-specific test helpers at `platform/apps/hub/server/utils/__tests__/test-helpers.ts`:
```typescript
import { buildSessionUser, buildSession, createMockEvent,
  createAuthenticatedEvent } from "./test-helpers";

const user = buildSessionUser("admin");
const session = buildSession("moderator");
const event = createMockEvent({ method: "POST", body: { name: "test" } });
const { event, session } = createAuthenticatedEvent("admin", { method: "GET" });
```

**Location:**
- `platform/packages/shared/src/test-utils/factories.ts` -- entity factories (users, profiles, flow graphs)
- `platform/apps/hub/server/utils/__tests__/test-helpers.ts` -- H3 event mocks, session builders, auto-import stubs
- `marketplace/e2e/helpers.ts` -- Playwright helpers (page ready, dev login, scroll utilities)

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
cd /home/andreas/workspace/guildora/platform && pnpm test:coverage
```

## Test Types

**Unit Tests (Vitest):**
- Scope: Individual functions, utilities, composables
- ~55 spec files across platform packages
- Co-located in `__tests__/` directories
- Environment: `node` (all vitest configs use `environment: "node"`)
- Example: `platform/packages/shared/src/utils/__tests__/profile-name.spec.ts` -- tests pure functions directly

**API Integration Tests (Vitest):**
- Scope: API route handlers with mocked DB and external services
- Located in `platform/apps/hub/server/api/__tests__/`
- Test auth enforcement, business logic, request validation
- Mock the DB layer, test handler logic with mock H3 events
- Example: `platform/apps/hub/server/api/__tests__/application-flow.spec.ts`

**DB Integration Tests (Vitest):**
- Scope: Database operations against real PostgreSQL
- Suffixed `*.integration.spec.ts`
- Excluded from default test runs
- Require `DATABASE_URL` env var
- Example: `platform/packages/shared/src/test-utils/__tests__/db-integration.integration.spec.ts`

**E2E Tests - Hub (Playwright):**
- Config: `platform/apps/hub/playwright.config.ts`
- Test dir: `platform/apps/hub/tests/`
- Base URL: `http://localhost:3003`
- Includes visual audits, auth guard verification, landing page tests
- Screenshots saved to `screenshots/` directories
- Example: `platform/apps/hub/tests/audit-auth-guards.spec.ts`

**E2E Tests - Marketplace (Playwright):**
- Config: `marketplace/playwright.config.ts`
- Test dir: `marketplace/e2e/`
- Base URL: `http://localhost:3004` (configurable via `PLAYWRIGHT_PORT`)
- Projects: `chromium` (Desktop Chrome) and `mobile` (Pixel 5)
- Captures screenshots on failure, video on failure, trace on first retry
- Helper module: `marketplace/e2e/helpers.ts`
- Example: `marketplace/e2e/foundation.spec.ts`

## Common Patterns

**Async Testing:**
```typescript
it("handles async operations", async () => {
  const { asyncFunction } = await importModule();
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

**Error Testing:**
```typescript
it("throws 403 when unauthorized", async () => {
  const { requireRole } = await importAuth();
  const user = buildSessionUser("user");
  expect(() => requireRole(user, ["admin"])).toThrow();
  try {
    requireRole(user, ["admin"]);
  } catch (e: any) {
    expect(e.statusCode).toBe(403);
  }
});
```

**Timer Testing:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("resets after window expires", async () => {
  const { checkRateLimit } = await importRateLimit();
  checkRateLimit("key", { windowMs: 60_000, max: 2 });
  checkRateLimit("key", { windowMs: 60_000, max: 2 });
  vi.advanceTimersByTime(61_000);
  const result = checkRateLimit("key", { windowMs: 60_000, max: 2 });
  expect(result.remaining).toBe(1);
});
```

**Discord Event Handler Testing:**
```typescript
function captureHandler(): MessageHandler {
  const client = { on: vi.fn() };
  registerMessageCreateEvent(client as any);
  return client.on.mock.calls.find((c) => c[0] === "messageCreate")![1];
}

it("ignores bot messages", async () => {
  const handler = captureHandler();
  const message = makeMessage({ bot: true });
  await handler(message);
  expect(mockEmit).not.toHaveBeenCalled();
});
```

**Playwright E2E Pattern:**
```typescript
import { test, expect } from "@playwright/test";
import { waitForPageReady, devLogin } from "./helpers";

test.describe("Feature Name", () => {
  test("description of behavior", async ({ page }) => {
    await page.goto("/");
    await waitForPageReady(page);
    await expect(page.locator(".hero-section")).toBeVisible();
  });
});
```

## Vitest Configuration Notes

**h3 Resolution Workaround:** Hub vitest config includes a custom `resolveH3()` function to find h3 in pnpm's `.pnpm` directory since it is not hoisted. This is at `platform/apps/hub/vitest.config.ts`.

**Excluded from Unit Tests:** Hub vitest config excludes `tests/**` (Playwright E2E tests) from vitest runs. Shared package excludes `*.integration.spec.ts`.

**Workspace Aliases:** Bot and matrix-bot vitest configs set up resolve aliases for `@guildora/shared` and `@guildora/app-sdk` pointing to source directories (not built output).

---

*Testing analysis: 2026-04-15*
