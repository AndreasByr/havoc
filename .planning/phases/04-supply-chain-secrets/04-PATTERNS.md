# Phase 4: Supply-Chain & Secrets - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 11 (8 modified, 3 new)
**Analogs found:** 9 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `platform/docker-compose.yml` | config | request-response | `platform/docker-compose.yml` lines 116–119 (existing env-var refs) | self-analog — same file, pattern already present |
| `platform/.env.example` | config | — | `platform/.env.example` lines 40–75 (existing secret sections) | self-analog — same file, section format established |
| `platform/package.json` | config | — | `platform/package.json` lines 32–49 (existing pnpm.overrides block) | self-analog — same file, override format established |
| `platform/apps/hub/server/plugins/00-b-token-check.ts` | middleware | request-response | `platform/apps/hub/server/plugins/00-a-load-env.ts` | role-match (same plugin layer, same defineNitroPlugin pattern) |
| `platform/apps/bot/src/index.ts` | config/startup | request-response | `platform/apps/bot/src/index.ts` lines 26–30 (DISCORD_BOT_TOKEN check) | self-analog — same file, pattern already present |
| `platform/apps/matrix-bot/src/index.ts` | config/startup | request-response | `platform/apps/matrix-bot/src/index.ts` lines 15–18 (HOMESERVER_URL check) | self-analog — same file, pattern already present |
| `platform/apps/hub/server/plugins/__tests__/token-check.spec.ts` | test | — | `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts` | role-match (same test layer, stubNuxtAutoImports pattern) |
| `platform/apps/bot/src/__tests__/token-check.spec.ts` | test | — | `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts` | role-match (same runtime, vi.mock process.exit pattern needed) |
| `platform/apps/matrix-bot/src/__tests__/token-check.spec.ts` | test | — | `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts` | role-match (same app, same test framework) |
| `.planning/research/04-overrides-audit.md` | documentation | — | n/a | no analog — new planning artifact |
| `.planning/research/04-audit-accepted-risks.md` | documentation | — | n/a | no analog — new planning artifact |

---

## Pattern Assignments

### `platform/docker-compose.yml` (config — env-var substitution)

**Analog:** Same file, lines 116–119 (bot service already uses `${VAR}` without defaults for secrets)

**Existing env-var pattern** (lines 116–119):
```yaml
      DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN}
      DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
      DISCORD_GUILD_ID: ${DISCORD_GUILD_ID}
      BOT_INTERNAL_TOKEN: ${BOT_INTERNAL_TOKEN}
```

**Target changes — lines 8, 15, 60, 69, 114:**

Line 8 (db service, `POSTGRES_PASSWORD`):
```yaml
# Before:
      POSTGRES_PASSWORD: postgres
# After (D-01 — no default; missing value must fail visibly):
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

Line 15 (db healthcheck):
```yaml
# Before:
      test: ["CMD-SHELL", "pg_isready -U postgres -d guildora"]
# After (D-02 — use same vars, with inline defaults for non-secrets):
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}"]
```

Lines 60 and 69 (hub service):
```yaml
# Before:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
      NUXT_DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
# After (D-01 — full URL is a secret because it embeds the password):
      DATABASE_URL: ${DATABASE_URL}
      NUXT_DATABASE_URL: ${DATABASE_URL}
```

Line 114 (bot service):
```yaml
# Before:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
# After:
      DATABASE_URL: ${DATABASE_URL}
```

**Lines that do NOT change** (D-01): lines 7 (`POSTGRES_USER: postgres`), line 9 (`POSTGRES_DB: guildora`), lines 61 and 115 (`DATABASE_SSL: "false"`).

---

### `platform/.env.example` (config — documentation)

**Analog:** Same file, lines 63–75 (existing "Secrets & Tokens" section format)

**Existing section format** (lines 63–75):
```bash
# ─── Secrets & Tokens ───────────────────────────────────────────────────────

# Shared secret for signing application tokens (hub + bot)
APPLICATION_TOKEN_SECRET=replace_with_strong_random_secret

# Shared secret for MCP service → Hub internal API (optional)
# MCP_INTERNAL_TOKEN=replace_with_strong_random_secret
```

**Target change — replace the Database section** (lines 27–35):
```bash
# ─── Database ────────────────────────────────────────────────────────────────
# ⚠ MUST change before production — default is insecure
# POSTGRES_PASSWORD is the password for the PostgreSQL user (used by docker-compose db service).
# DATABASE_URL must embed the same password.
# Production Docker: use db:5432 (internal Docker hostname). Local dev: use localhost:5433.
POSTGRES_PASSWORD=replace_with_strong_db_password

DATABASE_URL=postgresql://postgres:replace_with_strong_db_password@localhost:5433/guildora

# Set to true only when connecting to external/cloud Postgres with TLS.
DATABASE_SSL=false
```

Note: The comment on the old line 29–30 ("Production ... this value is ignored by containers") must be removed — after this change the container DOES use `DATABASE_URL` from env.

---

### `platform/package.json` (config — pnpm.overrides)

**Analog:** Same file, lines 32–49 (existing overrides block)

**Existing format** (lines 32–49):
```json
"pnpm": {
  "overrides": {
    "serialize-javascript": ">=7.0.3",
    "devalue": ">=5.6.4",
    "undici": ">=6.24.0 <8.0.0",
    ...
    "eslint>ajv": "^6"
  }
}
```

**New entries to add** (D-05, from audit findings):
```json
"defu": ">=6.1.5",
"lodash": ">=4.18.0",
"vite": ">=7.3.2"
```

No existing entries are removed per D-07 — the documentation task (04-overrides-audit.md) documents each entry; only entries confirmed unnecessary after `pnpm why` verification may be removed in the execution wave.

---

### `platform/apps/hub/server/plugins/00-b-token-check.ts` (middleware — startup)

**Analog:** `platform/apps/hub/server/plugins/00-a-load-env.ts`

**Plugin shell pattern** (00-a-load-env.ts lines 13–15 and 63–64):
```typescript
export default defineNitroPlugin(() => {
  // synchronous check — no async needed for token validation
  // ...
});
```

**runtimeConfig access pattern** — from `platform/apps/hub/server/utils/internal-auth.ts` lines 11–15:
```typescript
const config = useRuntimeConfig(event);
const expectedToken = String(config.mcpInternalToken || "").trim();
if (!expectedToken) {
  throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
}
```

**runtimeConfig key names** — from `platform/apps/hub/nuxt.config.ts` lines 50, 52:
```typescript
botInternalToken: process.env.BOT_INTERNAL_TOKEN || "",
mcpInternalToken: process.env.MCP_INTERNAL_TOKEN || "",
```

**Console logging convention** — from 00-a-load-env.ts lines 57, 61:
```typescript
console.log(`[load-env] Loaded ${loaded} env vars from ${candidate}`);
// and
console.log("[load-env] No .env file found (expected in Docker production).");
```
New plugin uses `[token-check]` tag prefix to match this convention.

**Full target pattern** (new file `00-b-token-check.ts`):
```typescript
const PLACEHOLDERS = ["replace_with_", "changeme", "your_token_here", "dev-"];

function isInvalid(value: string): boolean {
  if (!value || value.length === 0) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDERS.some((p) => lower.startsWith(p));
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();

  const botToken = String(config.botInternalToken || "");
  if (isInvalid(botToken)) {
    console.error(
      "[token-check] Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder. Set a real secret in .env."
    );
    process.exit(1);
  }

  // MCP token is optional (feature-disabled when absent) — only fail if set to a placeholder
  const mcpToken = String(config.mcpInternalToken || "");
  if (mcpToken.length > 0 && isInvalid(mcpToken)) {
    console.error(
      "[token-check] Startup aborted: MCP_INTERNAL_TOKEN contains a placeholder value. Use a real secret or remove the variable."
    );
    process.exit(1);
  }
});
```

**Filename rationale:** `00-b-` sorts after `00-a-load-env.ts` (env vars loaded first) and before `00-db-migrate.ts` (DB not started yet when this runs). Alphabetical sort: `00-a` < `00-b` < `00-db`.

---

### `platform/apps/bot/src/index.ts` (startup — token validation)

**Analog:** Same file, lines 26–30 (existing DISCORD_BOT_TOKEN check)

**Existing pattern** (lines 26–30):
```typescript
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}
```

**Logger import already present** (line 23):
```typescript
import { logger } from "./utils/logger";
```

**process.exit already used** (line 93):
```typescript
process.exit(1);
```

**Target — insert after line 30, before `const client = new Client(...)`:**
```typescript
const BOT_INTERNAL_TOKEN = process.env.BOT_INTERNAL_TOKEN;
const PLACEHOLDER_PREFIXES = ["replace_with_", "changeme", "your_token_here", "dev-"];

function isPlaceholderToken(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

if (!BOT_INTERNAL_TOKEN || BOT_INTERNAL_TOKEN.length === 0 || isPlaceholderToken(BOT_INTERNAL_TOKEN)) {
  logger.error(
    "Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value. Set a real secret in your .env file."
  );
  process.exit(1);
}
```

**Note:** D-10 — no silent fallback. The existing `|| ""` fallback for this token does NOT exist in bot/src/index.ts (the token is only used via `startInternalSyncServer`). The check is placed synchronously before `const client = new Client(...)` to guarantee it runs before any network I/O.

---

### `platform/apps/matrix-bot/src/index.ts` (startup — token validation)

**Analog:** Same file, lines 15–18 (existing HOMESERVER_URL/ACCESS_TOKEN check)

**Existing pattern** (lines 15–18):
```typescript
if (!HOMESERVER_URL || !ACCESS_TOKEN) {
  console.error("MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN are required.");
  process.exit(1);
}
```

**Current BOT_INTERNAL_TOKEN read** (line 13 — to be modified):
```typescript
const BOT_INTERNAL_TOKEN = process.env.BOT_INTERNAL_TOKEN || "";
```

**Target — replace line 13 and add validation after HOMESERVER/ACCESS_TOKEN check (after line 18):**
```typescript
// Line 13: remove the || "" fallback
const BOT_INTERNAL_TOKEN = process.env.BOT_INTERNAL_TOKEN;

// After line 18 (after the HOMESERVER/ACCESS_TOKEN guard):
const PLACEHOLDER_PREFIXES = ["replace_with_", "changeme", "your_token_here", "dev-"];

function isPlaceholderToken(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

// BOT_INTERNAL_TOKEN check runs AFTER matrix credentials are confirmed present
// (matrix-bot as a whole is optional; only validate token when the bot IS starting)
if (!BOT_INTERNAL_TOKEN || BOT_INTERNAL_TOKEN.length === 0 || isPlaceholderToken(BOT_INTERNAL_TOKEN)) {
  console.error(
    "[matrix-bot] Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value. Set a real secret in your .env file."
  );
  process.exit(1);
}
```

**Pitfall guard (from RESEARCH.md Pitfall 3):** The check is placed AFTER the `HOMESERVER_URL`/`ACCESS_TOKEN` guard. If matrix credentials are absent, the process already exits at line 17. The `BOT_INTERNAL_TOKEN` check only runs when the matrix-bot IS actually starting — preventing false startup aborts on systems that don't run matrix-bot at all.

**Logging convention:** matrix-bot uses `console.error` (not consola logger). Match existing `[matrix-bot]` prefix from line 43.

---

### `platform/apps/hub/server/plugins/__tests__/token-check.spec.ts` (test)

**Analog:** `platform/apps/hub/server/utils/__tests__/internal-auth.spec.ts`

**Test file header pattern** (internal-auth.spec.ts lines 1–17):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});
```

**Module import pattern** (internal-auth.spec.ts lines 19–21 — dynamic import to allow mocking):
```typescript
async function importInternalAuth() {
  return import("../internal-auth");
}
```

**Key test patterns to replicate for token-check plugin:**

The plugin calls `process.exit(1)`. Tests must spy on `process.exit` rather than letting it terminate the test runner:
```typescript
const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit called with ${code}`);
});
```

`useRuntimeConfig` is stubbed via `stubNuxtAutoImports()`. Tests set it per case:
```typescript
mocks.useRuntimeConfig.mockReturnValue({ botInternalToken: "", mcpInternalToken: "" });
```

`defineNitroPlugin` is stubbed in `stubNuxtAutoImports` (line 122 of test-helpers.ts):
```typescript
defineNitroPlugin: vi.fn((handler: Function) => handler),
```

**Verify the stub exposes `defineNitroPlugin`** — check `stubNuxtAutoImports` in test-helpers.ts. If it does not yet stub `defineNitroPlugin`, it must be added to the stubs map.

**Test cases required:**
1. Empty `botInternalToken` → `process.exit(1)` called
2. Placeholder `botInternalToken` (`"replace_with_..."`) → `process.exit(1)` called
3. Valid `botInternalToken` + absent `mcpInternalToken` → no exit (MCP optional)
4. Valid `botInternalToken` + placeholder `mcpInternalToken` → `process.exit(1)` called
5. Both valid → no exit, no error

---

### `platform/apps/bot/src/__tests__/token-check.spec.ts` (test)

**Analog:** `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts`

**Test framework import** (internal-sync-server.spec.ts line 6):
```typescript
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
```

**The bot's startup validation is NOT a standalone module** — it is embedded in `index.ts`. Testing approach: extract `isPlaceholderToken` and `validateBotToken` as a named export from a new utility file (`platform/apps/bot/src/utils/startup-checks.ts`), or test it by mocking `process.env` and importing the index module with `vi.isolateModules`.

**Recommended approach — extract to utility and test directly:**
```typescript
// platform/apps/bot/src/utils/startup-checks.ts (new small utility)
export const PLACEHOLDER_PREFIXES = ["replace_with_", "changeme", "your_token_here", "dev-"];

export function isPlaceholderToken(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}
```

**Test file structure:**
```typescript
import { describe, expect, it, vi } from "vitest";
import { isPlaceholderToken } from "../utils/startup-checks";

describe("isPlaceholderToken", () => {
  it("returns true for empty string", () => { ... });
  it("returns true for replace_with_ prefix", () => { ... });
  it("returns true for changeme prefix", () => { ... });
  it("returns true for dev- prefix", () => { ... });
  it("returns false for valid token", () => { ... });
});
```

**Alternative if extracting utility is not desired:** Use `vi.isolateModules` + `process.exit` spy to test index.ts startup guard. This is heavier but avoids creating a new file.

---

### `platform/apps/matrix-bot/src/__tests__/token-check.spec.ts` (test)

**Analog:** `platform/apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts`

**Test framework and mock pattern** (internal-sync-server.spec.ts lines 6–14):
```typescript
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createMockMatrixClient } from "./mock-matrix-client.js";
```

**Same approach as bot test:** Either extract `isPlaceholderToken` to `platform/apps/matrix-bot/src/utils/startup-checks.ts` and test pure logic, or use `vi.isolateModules` to test the full startup guard in index.ts.

**Note on `.js` extension:** matrix-bot uses ESM with explicit `.js` extensions in imports (see line 3 of index.ts: `import { startInternalSyncServer } from "./utils/internal-sync-server.js"`). Any new utility file imported in tests must follow this convention.

---

## Shared Patterns

### Process exit on hard failure

**Source:** `platform/apps/bot/src/index.ts` lines 83–93 (Discord login failure handler)
**Apply to:** Both bot and matrix-bot startup token checks
```typescript
logger.error("Discord login failed.", error);
process.exit(1);
```
For matrix-bot, replace `logger.error` with `console.error("[matrix-bot] ...")` to match existing convention.

### Nitro plugin naming and ordering

**Source:** `platform/apps/hub/server/plugins/` directory (observed filenames)
**Apply to:** New `00-b-token-check.ts`
```
00-a-load-env.ts    (loads env vars — must run first)
00-b-token-check.ts (validates tokens — must run after env is loaded, before DB)
00-db-migrate.ts    (runs migrations — must run after token check)
```
Nitro sorts plugins alphabetically by filename. The `00-` prefix groups startup plugins; the letter suffix controls within-group order.

### Placeholder prefix detection

**Source:** RESEARCH.md §Pattern 2 (verified against .env.example placeholder values)
**Apply to:** Hub plugin, bot startup, matrix-bot startup — all three implementations
**Canonical list (D-09):**
```typescript
const PLACEHOLDER_PREFIXES = ["replace_with_", "changeme", "your_token_here", "dev-"];
```
All three implementations must use the **identical list** so behavior is consistent. If a shared utility is introduced, it belongs in the same app's `utils/` directory — do not cross-pollinate between apps.

### runtimeConfig token read (Hub only)

**Source:** `platform/apps/hub/nuxt.config.ts` lines 50, 52
**Apply to:** Hub Nitro plugin `00-b-token-check.ts`
```typescript
botInternalToken: process.env.BOT_INTERNAL_TOKEN || "",
mcpInternalToken: process.env.MCP_INTERNAL_TOKEN || "",
```
In the Nitro plugin, read via `useRuntimeConfig()` (no event argument needed in plugins), then cast to string with `String(config.botInternalToken || "")` to match the pattern in `internal-auth.ts` line 12.

### Test stub for defineNitroPlugin

**Source:** `platform/apps/hub/server/utils/__tests__/test-helpers.ts` lines 104–143
**Apply to:** Hub plugin test file
```typescript
// stubNuxtAutoImports() already stubs most auto-imports.
// Verify defineNitroPlugin is in the mocks map; if not, add:
defineNitroPlugin: vi.fn((handler: Function) => handler),
```
The plugin test calls the handler directly after dynamic import, so `defineNitroPlugin` just needs to return its argument.

### .env.example section format

**Source:** `platform/.env.example` lines 1–6 and section headers throughout
**Apply to:** New POSTGRES_PASSWORD + DATABASE_URL block
```bash
# ─── Section Name ────────────────────────────────────────────────────────────
# Comment lines use "# " prefix.
# Optional vars are commented out: # VAR_NAME=value
# Required vars are uncommented: VAR_NAME=replace_with_value
```
The dash-divider style (`─── Name ───`) is already used for all sections. New block replaces the existing Database section (lines 27–35) using the same format.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/research/04-overrides-audit.md` | documentation | — | No existing per-override CVE documentation exists in the codebase. Planner should use the RESEARCH.md §pnpm.overrides Current State table as the template (15 entries, each with: key, current constraint, latest version, CVE/reason, keep/remove decision). |
| `.planning/research/04-audit-accepted-risks.md` | documentation | — | No existing accepted-risk documentation exists. Create per D-05. Each entry: CVE ID, package, path, reason it cannot be fixed, mitigating controls, review date. |

---

## Metadata

**Analog search scope:** `platform/apps/hub/server/plugins/`, `platform/apps/bot/src/`, `platform/apps/matrix-bot/src/`, `platform/apps/hub/server/utils/__tests__/`, `platform/apps/matrix-bot/src/__tests__/`, `platform/docker-compose.yml`, `platform/.env.example`, `platform/package.json`
**Files read:** 12
**Pattern extraction date:** 2026-04-18
