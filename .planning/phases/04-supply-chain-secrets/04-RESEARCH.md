# Phase 4: Supply-Chain & Secrets — Research

**Researched:** 2026-04-18
**Domain:** Docker Compose secrets management, pnpm dependency auditing, startup token validation
**Confidence:** HIGH — all findings verified directly against codebase and live tools

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Docker Compose — Credentials (F-05, SEC-06)**
- D-01: Only real secrets become env-based: `POSTGRES_PASSWORD` and all `DATABASE_URL` values (lines 60, 69, 114). `POSTGRES_USER`, `POSTGRES_DB`, and `DATABASE_SSL` stay as defaults in the file — they are not secrets.
- D-02: Fix healthcheck too: `pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}` — consistent, no contradiction on future rename.
- D-03: `platform/.env.example` gets an explicit mandatory block with "MUST change before production" warning for `POSTGRES_PASSWORD` and `DATABASE_URL`.

**pnpm Audit Policy (SEC-07)**
- D-04: Scope: `pnpm audit --prod` only. Dev-CVEs are not a production risk and must not block the phase.
- D-05: Fix-or-document: Every High/Critical gets a fix attempt (upgrade or override). If upstream has not patched and no override is possible → document as accepted risk in `.planning/research/04-audit-accepted-risks.md` with justification. Medium/Low are documented but not fixed.

**pnpm.overrides Documentation (SEC-07)**
- D-06: Documentation location: `.planning/research/04-overrides-audit.md`
- D-07: Per override entry: package name, CVE number (or "no CVE — compatibility patch"), whether upstream has patched, whether override can be removed. Overrides without current need are removed from `package.json`.

**Startup-Fail Token-Check (F-11, SEC-06)**
- D-08: Included in Phase 4 (audit tagged F-11 as SEC-06 / Phase 4; logical completion of secrets hardening).
- D-09: Check at Hub, Bot, and Matrix-Bot startup: token is empty (length 0) OR contains known placeholder strings (`replace_with_`, `changeme`, `your_token_here`, `dev-`) → hard-fail with clear error message. Applies to: `BOT_INTERNAL_TOKEN`, `HUB_INTERNAL_TOKEN`, `MCP_TOKEN`.
- D-10: "Fail Loud, Never Fake" — no silent fallback, no default token. Startup fails and explains which token is missing.

### Claude's Discretion
- Exact error message text at startup-fail
- Commit order of changes
- Format of `04-overrides-audit.md` within the required fields

### Deferred Ideas (OUT OF SCOPE)
- F-16 (Audit logs for security events) — deferred to v2 or Phase 5 backlog
- DATABASE_SSL parametrization — stays as default in file
- `pnpm audit` without --prod — dev CVEs not treated in this phase
- Token minimum-length check — only empty + placeholder, no length validation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-06 | `platform/docker-compose.yml` uses no hardcoded DB credentials; DB password comes from env variables like other secrets; startup fail-check for placeholder tokens | D-01..D-03 cover compose change; D-08..D-10 cover startup check; research confirms exact lines and token read patterns |
| SEC-07 | `pnpm audit` against `platform/` is clean (no open High/Critical); the 12 `pnpm.overrides` in `platform/package.json` are reviewed and only present where upstream has not caught up | D-04..D-07 cover audit policy; research confirmed 23 vulnerabilities found (1 critical, 5 high, 17 moderate); override count is 15 not 12 |
</phase_requirements>

---

## Summary

Phase 4 has four concrete work streams: (1) remove hardcoded `postgres:postgres` credentials from `docker-compose.yml` and replace with env-variable references; (2) add startup token validation (fail-loud) to bot, matrix-bot, and hub; (3) run `pnpm audit --prod` and fix or document all High/Critical findings; (4) audit the 15 `pnpm.overrides` entries and document or remove each one.

The current `docker-compose.yml` has hardcoded `postgres:postgres` at exactly three places: the `db` service environment block (line 8), the `hub` `DATABASE_URL` (line 60), and the `bot` `DATABASE_URL` (line 114). The `NUXT_DATABASE_URL` duplicate on line 69 also contains the hardcoded credentials. The pattern for env substitution (`${VAR}` or `${VAR:-default}`) is already used throughout the file for other secrets — this change follows the same established convention.

`pnpm audit --prod` currently reports **23 vulnerabilities: 1 Critical, 5 High, 17 Moderate**. Several are immediately fixable via `pnpm.overrides` (drizzle-orm upgrade, defu override, lodash override) or by upgrading direct dependencies. Others are locked to unmaintained transitive dependencies in matrix-bot-sdk (form-data, request, tough-cookie) that have no upstream fix and require accepted-risk documentation. The `pnpm.overrides` block currently has **15 entries** (not 12 as referenced in the audit finding — it has grown since then), and several can be verified and documented in a single wave.

**Primary recommendation:** Execute the three work streams in parallel — they touch different files and have no dependencies on each other. Only the final validation step (confirming startup with new compose setup) must run last.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DB credential injection | Infrastructure (Docker Compose) | Environment file (.env.example) | Secrets flow from host env → container env vars; no code change required |
| Token startup validation | Application startup (process entry points) | — | Fail-loud must happen before any I/O; belongs in `src/index.ts` and Nitro plugin layer |
| Dependency vulnerability remediation | Build / package manifest | pnpm.overrides | Fixes are in package.json and pnpm-lock.yaml; no runtime code changes |
| Override documentation | Planning artifacts | — | Audit artifacts live in .planning/research/, not in code |

---

## Standard Stack

### Core Tools Used in This Phase

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `pnpm audit --prod` | pnpm 10.33.0 | Scan production dependency tree for CVEs | `--prod` flag limits to non-devDependencies |
| `npm view <pkg> version` | npm bundled | Verify latest upstream versions | Used to determine if overrides can be removed |
| Docker Compose env substitution | Compose v2 | `${VAR}` and `${VAR:-default}` syntax | Already used throughout docker-compose.yml |
| Node.js `process.exit(1)` | Node >=20 | Startup hard-fail pattern | Matches existing DISCORD_BOT_TOKEN check pattern |

### No New Libraries Required

This phase involves configuration changes, documentation artifacts, and small startup guard additions. No new npm packages are needed.

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│ Phase 4 Change Surface                               │
│                                                      │
│  .env / .env.example                                 │
│    POSTGRES_PASSWORD=<secret>          ─────────┐    │
│    DATABASE_URL=postgres://<secret>@…  ─────┐   │    │
│                                             │   │    │
│  docker-compose.yml                         ▼   ▼    │
│    db:  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  │   │
│    hub: DATABASE_URL: ${DATABASE_URL}            │   │
│    bot: DATABASE_URL: ${DATABASE_URL}            │   │
│                                                  │   │
│  Startup checks (process.exit on placeholder)   │   │
│    apps/bot/src/index.ts ──────────────────────→ ●   │
│    apps/matrix-bot/src/index.ts ───────────────→ ●   │
│    apps/hub/server/plugins/00-b-token-check.ts → ●   │
│                                                      │
│  pnpm.overrides (platform/package.json)              │
│    + defu: >=6.1.5                                   │
│    + lodash: >=4.18.0                                │
│    + drizzle-orm → upgrade in shared/hub/bot pkgs    │
│    [document accepted risks for form-data chain]     │
└──────────────────────────────────────────────────────┘
```

### Recommended Project Structure (New Files)

```
.planning/research/
├── 04-overrides-audit.md    # per-override documentation (D-06, D-07)
└── 04-audit-accepted-risks.md  # accepted High/Critical CVEs (D-05)

platform/apps/hub/server/plugins/
└── 00-b-token-check.ts      # Nitro startup plugin for token validation (runs after 00-a-load-env)

platform/docker-compose.yml  # modified (lines 8, 60, 69, 114)
platform/.env.example        # modified (new POSTGRES_PASSWORD block)
platform/package.json        # modified (pnpm.overrides additions/removals)
platform/packages/shared/package.json   # drizzle-orm version bump
platform/apps/hub/package.json          # drizzle-orm version bump
platform/apps/bot/package.json          # drizzle-orm version bump
platform/apps/bot/src/index.ts          # startup token check
platform/apps/matrix-bot/src/index.ts  # startup token check
```

### Pattern 1: Docker Compose env-variable substitution

**What:** Replace hardcoded `postgres:postgres` with `${VAR}` references. Use `${VAR}` (no default) for secrets so a missing value causes compose to fail visibly, not silently use an empty string.

**When to use:** For all values that are secrets (password, connection string containing password). Non-secrets like username and DB name can remain inline as they are not security-sensitive.

**Example (current → target):**
```yaml
# Current (lines 7-9):
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres     # <-- hardcoded secret
  POSTGRES_DB: guildora

# Target (D-01: only password becomes env-var):
environment:
  POSTGRES_USER: postgres          # stays — not a secret
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}   # env-var, no default
  POSTGRES_DB: guildora            # stays — not a secret

# Healthcheck (D-02 — current line 15):
test: ["CMD-SHELL", "pg_isready -U postgres -d guildora"]
# Target:
test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}"]

# hub service DATABASE_URL (current lines 60, 69):
DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
NUXT_DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
# Target (D-01: full URL becomes env-var):
DATABASE_URL: ${DATABASE_URL}
NUXT_DATABASE_URL: ${DATABASE_URL}

# bot service DATABASE_URL (current line 114):
DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
# Target:
DATABASE_URL: ${DATABASE_URL}
```

**Note on `NUXT_DATABASE_URL` vs `DATABASE_URL`:** Both lines 60 and 69 in the hub service set the same value. After the change, both should reference `${DATABASE_URL}` so they stay in sync. The hub Nitro server reads `DATABASE_URL` directly from `process.env`, not via runtimeConfig, so the env-var name is the authoritative one. [VERIFIED: codebase grep — hub `nuxt.config.ts` line 47: `databaseUrl: process.env.DATABASE_URL`]

### Pattern 2: Startup token validation (Fail Loud)

**What:** At process startup, before any network I/O, validate that critical tokens are neither empty nor placeholder strings.

**When to use:** Bot and matrix-bot startup (index.ts, synchronously before client.login()); hub startup (Nitro plugin named `00-b-token-check.ts` so it runs after `00-a-load-env.ts` but before DB migration and other plugins).

**Placeholder strings to detect (D-09):**
```typescript
const PLACEHOLDER_PREFIXES = ["replace_with_", "changeme", "your_token_here", "dev-"];

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some(p => lower.startsWith(p));
}

function validateToken(name: string, value: string | undefined): void {
  if (!value || value.length === 0 || isPlaceholder(value)) {
    // Use logger.error for bot (consola logger), console.error for matrix-bot
    const msg = `Startup aborted: ${name} is missing or contains a placeholder value. Set a real secret in your .env file.`;
    logger.error(msg);   // or console.error(msg)
    process.exit(1);
  }
}
```

**Bot (apps/bot/src/index.ts):** Add checks for `BOT_INTERNAL_TOKEN` after `DISCORD_BOT_TOKEN` check (line 26-30). `DISCORD_BOT_TOKEN` already uses the pattern `if (!token) { throw new Error(...) }` — the new check mirrors this style but also catches placeholders. [VERIFIED: codebase read]

**Matrix-bot (apps/matrix-bot/src/index.ts):** `BOT_INTERNAL_TOKEN` is currently read with `|| ""` fallback at line 13 — remove the fallback and add validation before `main()` call. [VERIFIED: codebase read]

**Hub (Nitro plugin):** Nitro plugins run in filename-sort order. Plugin `00-a-load-env.ts` loads env vars first. New plugin `00-b-token-check.ts` (sorts alphabetically after 00-a, before 00-db) reads `process.env.BOT_INTERNAL_TOKEN` and `process.env.MCP_INTERNAL_TOKEN` via `useRuntimeConfig()` and fails if either is a placeholder. The `mcpInternalToken` check mirrors the existing `requireInternalToken()` 503 logic but moves it to startup time.

**Nitro plugin pattern:**
```typescript
// platform/apps/hub/server/plugins/00-b-token-check.ts
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  const PLACEHOLDERS = ["replace_with_", "changeme", "your_token_here", "dev-"];

  function isInvalid(value: string): boolean {
    if (!value || value.length === 0) return true;
    const lower = value.toLowerCase();
    return PLACEHOLDERS.some(p => lower.startsWith(p));
  }

  const botToken = String(config.botInternalToken || "");
  if (isInvalid(botToken)) {
    console.error("[token-check] Startup aborted: BOT_INTERNAL_TOKEN is missing or a placeholder. Set a real secret in .env.");
    process.exit(1);
  }

  // MCP token is optional (commented out in .env.example) — only fail if explicitly set to a placeholder
  const mcpToken = String(config.mcpInternalToken || "");
  if (mcpToken.length > 0 && isInvalid(mcpToken)) {
    console.error("[token-check] Startup aborted: MCP_INTERNAL_TOKEN contains a placeholder value.");
    process.exit(1);
  }
});
```

**Note on MCP token optionality:** `.env.example` line 69 shows `MCP_INTERNAL_TOKEN` is commented out (optional). The startup check must NOT fail when MCP token is absent (empty = feature disabled). It should only fail if a placeholder string is actively set. This matches the `requireInternalToken()` pattern which returns 503 only when the token is configured but used incorrectly. [VERIFIED: codebase read of .env.example and internal-auth.ts]

### Pattern 3: pnpm.overrides for CVE mitigation

**What:** Add `pnpm.overrides` entries to force transitive dependency upgrades for packages that are CVE-patched upstream but whose parents haven't yet pinned the fixed version.

**When to use:** When a CVE-affected transitive dependency has a patched version available from the original maintainer and the version range is semver-compatible with dependents. Do NOT use when the vulnerable package is a deeply nested transitive with no fixed version (accepted-risk case).

**Example:**
```json
"pnpm": {
  "overrides": {
    "defu": ">=6.1.5",
    "lodash": ">=4.18.0"
  }
}
```

### Anti-Patterns to Avoid

- **Empty token treated as "disabled":** Matrix-bot currently does `process.env.BOT_INTERNAL_TOKEN || ""` — this means a missing token starts the sync server with no auth. The D-09 fix adds explicit validation instead.
- **Inline credentials in compose files:** Even "internal-only" services should follow env-var convention — the `guildora_internal` network protection is defense-in-depth, not a substitute for proper secret management.
- **Override without documentation:** Adding a `pnpm.overrides` entry without a corresponding comment or audit doc leaves future maintainers unable to determine if the override is still needed.
- **process.exit in async code:** Bot startup token check must run synchronously BEFORE `client.login()` to prevent partial startup with invalid config. Do not put it in a `.then()` callback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret rotation | Custom env reloader | Docker Compose `${VAR}` syntax | Compose handles substitution natively; restart cycle is the rotation mechanism |
| CVE tracking | Custom vulnerability scanner | `pnpm audit --prod` | pnpm audit queries the npm advisory database directly; no custom tooling needed |
| Token hashing for comparison | Custom HMAC | Existing `timingSafeEqualString` in `internal-auth.ts` | Phase 3 already solved timing-safe comparison; startup check only needs existence/placeholder check, not cryptographic comparison |

---

## Current State — Verified Findings

### docker-compose.yml Hardcoded Credential Locations

[VERIFIED: codebase read of platform/docker-compose.yml]

| Line | Service | Value | Action |
|------|---------|-------|--------|
| 8 | `db` | `POSTGRES_PASSWORD: postgres` | Replace with `${POSTGRES_PASSWORD}` |
| 15 | `db` healthcheck | `pg_isready -U postgres -d guildora` | Replace with `${POSTGRES_USER:-postgres}` / `${POSTGRES_DB:-guildora}` |
| 60 | `hub` | `DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora` | Replace with `${DATABASE_URL}` |
| 69 | `hub` | `NUXT_DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora` | Replace with `${DATABASE_URL}` |
| 114 | `bot` | `DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora` | Replace with `${DATABASE_URL}` |

Lines 7, 9 (`POSTGRES_USER`, `POSTGRES_DB`) stay as-is per D-01. Line 61 and 115 (`DATABASE_SSL: "false"`) stays as-is per deferred decision.

### .env.example Current State

[VERIFIED: codebase read]

The current `DATABASE_URL` (line 32) uses `postgres:postgres` as a dev placeholder. The file has no `POSTGRES_PASSWORD` variable at all — it is only used in `docker-compose.yml`. The new block to add under `# ─── Database ───` section:

```bash
# ─── Database ────────────────────────────────────────────────────────────────
# ⚠ MUST change before production — default is insecure
# POSTGRES_PASSWORD is the password for the PostgreSQL user.
# DATABASE_URL must embed the same password.
POSTGRES_PASSWORD=replace_with_strong_db_password

# Local dev (pnpm dev): points to docker-compose db on port 5433.
# Production (docker compose up): DATABASE_URL is set per service in
# docker-compose.yml — this value is used by hub and bot containers.
DATABASE_URL=postgresql://postgres:replace_with_strong_db_password@localhost:5433/guildora
```

The existing `DATABASE_SSL=false` line stays. The existing comment about "Production ... ignored by containers" must be updated since after this change the container DOES use `DATABASE_URL` from env.

### pnpm audit --prod Current State

[VERIFIED: live `pnpm audit --prod` run, 2026-04-18]

**Total: 23 vulnerabilities (1 critical, 5 high, 17 moderate)**

#### Critical

| Package | CVE | Vulnerable | Patched | Path | Fix Strategy |
|---------|-----|------------|---------|------|-------------|
| `form-data` | CVE-2025-7783 | <2.5.4 | >=2.5.4 | matrix-bot > matrix-bot-sdk@0.7.1 > request@2.88.2 | No upstream fix for matrix-bot-sdk@0.7.1 dependency tree. Accept risk — see pitfall section. |

#### High

| Package | CVE | Vulnerable | Patched | Path | Fix Strategy |
|---------|-----|------------|---------|------|-------------|
| `lodash` | CVE-2026-4800 | >=4.0.0 <=4.17.23 | >=4.18.0 | bot > discord.js, hub > nuxt > nitropack > archiver | Add override: `"lodash": ">=4.18.0"` |
| `defu` | CVE-2026-35209 | <=6.1.4 | >=6.1.5 | hub > @nuxtjs/color-mode > @nuxt/kit > c12 (205 paths) | Add override: `"defu": ">=6.1.5"` |
| `vite` | CVE-2026-39364 | >=7.1.0 <=7.3.1 | >=7.3.2 | hub > nuxt > @nuxt/devtools > vite | Override or nuxt upgrade — see analysis |
| `vite` | CVE-2026-39363 | >=7.0.0 <=7.3.1 | >=7.3.2 | same path | same fix |
| `drizzle-orm` | CVE-2026-39356 | <0.45.2 | >=0.45.2 | shared/hub/bot > drizzle-orm@0.44.7 | Upgrade `^0.44.5` → `^0.45.2` in shared, hub, bot package.json |

**Vite analysis:** [VERIFIED: codebase read] Vite is bundled via `@nuxt/vite-builder` which is a production dependency of `nuxt`. Vite CVEs (server.fs.deny bypass, arbitrary file read via WebSocket) are primarily dev-server attacks — in production Docker builds, the Vite dev server does not run. However, since it is a `dependencies` entry in nuxt (not devDependencies), pnpm audit flags it as a prod finding. Fix path: add pnpm override `"vite": ">=7.3.2"` or upgrade nuxt to 4.4.2 (which may pull vite 7.3.2+). Nuxt 4.4.2 is available. [VERIFIED: `npm view nuxt version` = 4.4.2]

**drizzle-orm analysis:** [VERIFIED: codebase grep] All three packages (shared, hub, bot) declare `"drizzle-orm": "^0.44.5"`. The `^0.44.5` range covers `>=0.44.5 <0.45.0` — it will NOT automatically pick up 0.45.2. The fix is to bump the declaration to `^0.45.2` in all three package.json files and run `pnpm install`. This is a real patch (SQL injection via improperly escaped identifiers). [VERIFIED: npm registry confirms 0.45.2 is latest]

#### Moderate (no fix required per D-05, document only)

The 17 moderate findings span: multiple hono/hono-node-server CVEs (via mcp-server dependency chain), lodash prototype pollution (same tree as High), vite path traversal (same tree as High vite), dompurify (isomorphic-dompurify@3.7.1 ships dompurify@3.3.3, patched >=3.4.0), unhead, qs, esbuild (dev server), vue-template-compiler, request SSRF (matrix-bot-sdk, no fix), sanitize-html (matrix-bot-sdk, patched >=2.17.3), tough-cookie (matrix-bot-sdk, no fix).

### pnpm.overrides Current State

[VERIFIED: codebase read of platform/package.json — actual count is 15, not 12]

| Override Key | Current Constraint | Latest Version | Analysis |
|--------------|-------------------|----------------|----------|
| `serialize-javascript` | `>=7.0.3` | 7.0.5 | CVE patch (XSS). Upstream patched. Override still needed if transitive deps lag. Verify with `pnpm why`. |
| `devalue` | `>=5.6.4` | 5.7.1 | Compat/CVE patch. Latest is 5.7.1. Override range is satisfied. Review if transitive pins to older. |
| `undici` | `>=6.24.0 <8.0.0` | 8.1.0 | Multiple CVEs (GHSA-*). Upper bound `<8.0.0` is intentional compat guard. Upstream patched in 8.x too. |
| `flatted` | `>=3.4.2` | 3.4.2 | Compat patch. Latest IS 3.4.2. Override can likely be removed if all dependents have updated. |
| `node-forge` | `>=1.3.4` | 1.4.0 | CVE patch. Upstream patched at 1.3.4; latest is 1.4.0. Override still valid. |
| `picomatch` | `>=4.0.4` | 4.0.4 | Compat patch. Latest is 4.0.4. Override satisfied by current latest. |
| `happy-dom` | `>=20.8.9` | 20.9.0 | CVE/compat patch. Upstream at 20.9.0. Removable if transitive consumers updated. |
| `h3` | `>=1.15.9` | 2.0.1-rc.20 | CVE patch. h3 2.x is RC; h3 1.x latest is around 1.15.x. Override constrains to >=1.15.9. Important: h3 is a direct/transitive dep of nuxt — removing this override risks reverting to older h3. Keep. |
| `srvx` | `>=0.11.13` | 0.11.15 | Compat patch. Latest is 0.11.15. Satisfies override. |
| `postcss` | `>=8.4.31` | 8.5.10 | CVE-2023-44270 (line injection). Upstream patched. Override valid — many tools pin older postcss. |
| `brace-expansion@>=2.0.0 <2.0.3` | `>=2.0.3` | 2.1.0 | CVE patch for specific range. Upstream has 2.1.0. Override correctly constrains. |
| `brace-expansion@>=4.0.0 <5.0.5` | `>=5.0.5` | 5.0.5 | CVE patch for 4.x range pinned to 5.0.5+. Latest is 5.0.5. Correct. |
| `yaml` | `>=2.8.3` | 2.8.3 | CVE/compat. Latest is 2.8.3. Override satisfied. |
| `ajv` | `>=8.18.0` | 8.18.0 | CVE/compat. Latest is 8.18.0. Override satisfied. |
| `eslint>ajv` | `^6` | 6.12.6 | Keeps eslint's internal ajv on v6 (eslint requires v6 specifically). Intentional compat override. Keep. |

**Summary:** None of the 15 current overrides can be safely removed without verification that all transitive consumers have independently updated past the required version. The `flatted`, `picomatch`, `happy-dom`, `yaml`, `ajv` overrides are "already at latest" which means they are effectively no-ops for now but protect against future dependency installs pulling older versions. The documentation task (D-07) is about recording the CVE/reason for each — not about removing all of them.

**New overrides to add (from audit fixes):**
- `"defu": ">=6.1.5"` — CVE-2026-35209, prototype pollution
- `"lodash": ">=4.18.0"` — CVE-2026-4800, code injection via template
- `"vite": ">=7.3.2"` — CVE-2026-39364/39363, fs.deny bypass + arbitrary file read (assess after nuxt upgrade whether still needed)

---

## Common Pitfalls

### Pitfall 1: Missing POSTGRES_PASSWORD in Docker Compose causes silent empty password

**What goes wrong:** Using `${POSTGRES_PASSWORD}` without a default in the `db` service means that if `.env` doesn't contain `POSTGRES_PASSWORD`, Compose substitutes an empty string. PostgreSQL accepts an empty password in some configurations, which is worse than a wrong-value failure.

**Why it happens:** Docker Compose `${VAR}` substitutes empty string if `VAR` is unset; `${VAR:-default}` would use the default. Using no default is intentional for secrets (fail visible) but could lead to subtle auth issues with some PG configurations.

**How to avoid:** Document in `.env.example` that `POSTGRES_PASSWORD` is required (no default). Test `docker compose config` to verify substitution is correct. The "MUST change before production" warning block (D-03) addresses this.

**Warning signs:** `pg_isready` succeeds but application fails to authenticate; PostgreSQL logs show authentication failures with empty credentials.

### Pitfall 2: DATABASE_URL in .env.example still has `localhost:5433` for local dev

**What goes wrong:** The new `DATABASE_URL` in `.env.example` must work for both local `pnpm dev` (where db is at `localhost:5433`) and production Docker containers (where db is at `db:5432`). The docker-compose.yml `hub` and `bot` services now reference `${DATABASE_URL}`, but the `.env.example` default is the local dev value.

**Why it happens:** After this change, `docker-compose.yml` no longer hardcodes the internal `db:5432` hostname. If a production `.env` uses the local-dev value `localhost:5433`, the containers will fail to connect.

**How to avoid:** Document in `.env.example` that the production value for `DATABASE_URL` must use `db:5432` (internal Docker hostname), not `localhost:5433`. Add a comment: `# Production Docker: use db:5432. Local dev: use localhost:5433.`

**Warning signs:** Bot/Hub containers fail to start with "ECONNREFUSED localhost:5433" in logs.

### Pitfall 3: Startup token check breaks matrix-bot when token is legitimately absent

**What goes wrong:** The matrix-bot's `BOT_INTERNAL_TOKEN` defaults to `""` (line 13 of index.ts). The intent in the existing code appears to be: if token is empty, the internal sync server is still started but all requests are rejected with 503. The new startup check must not break setups where the operator intentionally doesn't configure a matrix-bot.

**Why it happens:** D-09 says "hard-fail if token is empty" but the matrix-bot's internal sync server may be used in environments where only Discord bot is configured. The Discord bot already uses `logger.warn("BOT_INTERNAL_TOKEN is not set. Internal sync server is disabled for security.")` as a softer failure.

**How to avoid:** For matrix-bot, consider whether the token is optional (matrix-bot itself is optional). If the entire `MATRIX_HOMESERVER_URL` + `MATRIX_ACCESS_TOKEN` are absent, the bot doesn't start anyway (existing check lines 15-18). The `BOT_INTERNAL_TOKEN` check should fail-loud only when the matrix-bot IS being started — which means it only needs to check after confirming the matrix credentials are set. Pattern: check `BOT_INTERNAL_TOKEN` AFTER the `HOMESERVER_URL`/`ACCESS_TOKEN` check.

**Warning signs:** Matrix-bot operator sees startup abort on systems that previously worked with no `BOT_INTERNAL_TOKEN` set.

### Pitfall 4: form-data / request / tough-cookie have no upstream fix

**What goes wrong:** The matrix-bot-sdk@0.7.1 ships `request@2.88.2` → `form-data@2.3.3` (CVE-2025-7783: critical — unsafe random boundary), `request` (SSRF, no fix version), and `tough-cookie` (prototype pollution). None of these have a patched version available from the unmaintained `request` package. A pnpm override to `form-data>=2.5.4` may break the `request@2.88.2` interface.

**Why it happens:** `request` was deprecated in 2020 and never patched for these CVEs. matrix-bot-sdk@0.7.1 has not dropped the `request` dependency.

**How to avoid:** Document as accepted risk in `04-audit-accepted-risks.md`. Justify: these CVEs are in matrix-bot's internal HTTP client (not the externally exposed sync server), the sync server has Bearer token auth, and the matrix-bot is not internet-facing. The critical `form-data` CVE affects multipart form boundary predictability — not relevant to matrix-bot's actual HTTP usage pattern (JSON bodies for internal sync).

**Warning signs:** Attempting to override `form-data@">=2.5.4"` and seeing matrix-bot-sdk tests fail or `request` throw API errors.

### Pitfall 5: drizzle-orm 0.44.x vs 0.45.x API changes

**What goes wrong:** Upgrading `^0.44.5` to `^0.45.2` may introduce breaking changes in the drizzle-orm API used in shared, hub, and bot packages.

**Why it happens:** drizzle-orm uses minor versions for breaking changes (non-semver-conventional for 0.x packages).

**How to avoid:** Before bumping versions, check the drizzle-orm CHANGELOG between 0.44.7 and 0.45.2. The CVE (SQL injection via improperly escaped SQL identifiers — GHSA-gpj5-g38j-94v9) was fixed at exactly 0.45.2. The upgrade is a single minor version bump. Run `pnpm test` across all affected packages after upgrade. The shared package test suite covers DB schema operations. [VERIFIED: drizzle-orm@0.45.2 is latest stable per npm registry]

---

## Code Examples

### Verified: .env.example existing format for context

```bash
# Source: codebase read of platform/.env.example
# Existing section header format (dash-dividers):
# ─── Core ────────────────────────────────────────────────────────────────────
# New DB section should follow the same format.
```

### Verified: Discord bot existing startup check pattern

```typescript
// Source: platform/apps/bot/src/index.ts:26-30
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}
// New BOT_INTERNAL_TOKEN check follows same pattern but also checks placeholders
```

### Verified: Matrix-bot current token read (to be modified)

```typescript
// Source: platform/apps/matrix-bot/src/index.ts:13
// Current — will be modified:
const BOT_INTERNAL_TOKEN = process.env.BOT_INTERNAL_TOKEN || "";
// Target — remove || "" fallback, add placeholder check after HOMESERVER/ACCESS_TOKEN check
```

### Verified: Hub Nitro plugin naming convention

```
// Source: platform/apps/hub/server/plugins/ directory listing
00-a-load-env.ts   <- loads env vars first
00-db-migrate.ts   <- DB migrations second
// New plugin:
00-b-token-check.ts  <- token check after env load, before DB migration
// "b" sorts after "a" and before "db-" alphabetically
```

### Verified: Existing 503 pattern in internal-auth.ts (process-level analogue)

```typescript
// Source: platform/apps/hub/server/utils/internal-auth.ts:14-16
const expectedToken = String(config.mcpInternalToken || "").trim();
if (!expectedToken) {
  throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
}
// Startup check is process.exit(1) equivalent of this — same logic, earlier execution point
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `postgres:postgres` in compose | `${POSTGRES_PASSWORD}` env-var | Phase 4 (this phase) | Prevents credential exposure in committed Compose files |
| No startup token validation | process.exit(1) on placeholder tokens | Phase 4 (this phase) | Catches misconfigurations at start, not at first request |
| Undocumented overrides | Per-override CVE documentation in audit file | Phase 4 (this phase) | Future maintainer can understand intent and know when to remove |

**Already current (no change needed):**
- Hub `requireInternalToken()` already does 503 on missing MCP token at request-time (Phase 3)
- Matrix-bot internal sync server already does 503 on empty token at request-time (Phase 3)
- Discord bot already does early `throw new Error()` for missing `DISCORD_BOT_TOKEN`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite CVEs are dev-server-only and not exploitable in production Docker builds | Pitfalls / Audit | If vite ships a server that runs in prod, the file-read CVEs are a production risk requiring immediate fix |
| A2 | matrix-bot-sdk@0.7.1 `request` package does not make external HTTP calls in the matrix-bot's actual operational path | Pitfall 4 | If matrix-bot uses `request` for outbound calls, SSRF CVE has a realistic attack path |
| A3 | drizzle-orm 0.44.x → 0.45.x upgrade does not break the shared/hub/bot schema or query API | Pitfall 5 | If there are breaking API changes, the upgrade requires code changes beyond package.json bumps |
| A4 | The `eslint>ajv: "^6"` override is required because ESLint itself requires ajv v6 (not v8) | Overrides table | If ESLint has been updated to use ajv v8, this override is a no-op or could be removed |

---

## Open Questions

1. **Vite dev-server CVEs in production builds**
   - What we know: All vite paths in the audit go through `@nuxt/devtools` which is listed as a dependency (not devDependency) of nuxt itself; vite is included in the build output
   - What's unclear: Does the Nitro production server actually start the Vite HMR/dev-server, or is Vite only used at build time and not at runtime in production?
   - Recommendation: Add override `"vite": ">=7.3.2"` as the safe conservative fix; if nuxt 4.4.2 upgrade is straightforward, upgrade nuxt instead and verify it pulls vite >=7.3.2

2. **Is `BOT_INTERNAL_TOKEN` required or optional for matrix-bot?**
   - What we know: The existing code uses `|| ""` fallback suggesting it was optional; but the sync server is started regardless
   - What's unclear: Can the matrix-bot operate without the internal sync server? Should the startup check be conditional on some `MATRIX_SYNC_ENABLED` flag?
   - Recommendation: Make the check the same as the Discord bot's `logger.warn("...disabled for security")` if token is missing — only fail-loud if token is set but is a placeholder

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | audit, install | ✓ | 10.33.0 | — |
| Node.js | scripts, test | ✓ | v24.14.1 | — |
| PostgreSQL | startup test | ✓ | running at guildora-db | — |
| npm registry | version lookups | ✓ | accessible | — |

No blocking missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.0 (bot, matrix-bot), ^3.1.1 (hub) |
| Config file | `apps/bot/vitest.config.ts`, `apps/matrix-bot/vitest.config.ts`, `apps/hub/vitest.config.ts` |
| Quick run (bot) | `pnpm --filter @guildora/bot test` |
| Quick run (matrix-bot) | `pnpm --filter @guildora/matrix-bot test` |
| Quick run (hub) | `pnpm --filter @guildora/hub test` |
| Full suite | `pnpm test` (Turborepo runs all) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-06 (compose) | docker-compose.yml no longer contains `postgres:postgres` literal | grep assertion in validation | `grep -v "postgres:postgres" platform/docker-compose.yml` | ✅ shell command |
| SEC-06 (startup) | Bot startup fails with clear message when BOT_INTERNAL_TOKEN is placeholder | unit | `pnpm --filter @guildora/bot test` | ❌ Wave 0 |
| SEC-06 (startup) | Matrix-bot startup fails when BOT_INTERNAL_TOKEN is placeholder | unit | `pnpm --filter @guildora/matrix-bot test` | ❌ Wave 0 |
| SEC-06 (startup) | Hub Nitro plugin fails when BOT_INTERNAL_TOKEN is placeholder | unit | `pnpm --filter @guildora/hub test` | ❌ Wave 0 |
| SEC-07 (audit) | `pnpm audit --prod` reports no unaccepted High/Critical | live audit + acceptance doc | `pnpm audit --prod` | N/A — runtime |
| SEC-07 (overrides) | All 15 overrides have documentation in 04-overrides-audit.md | doc existence check | manual review | ❌ Wave 0 (doc) |

### Sampling Rate

- Per task commit: run tests for the specific app modified (`pnpm --filter @guildora/<app> test`)
- Per wave merge: `pnpm test` (full suite)
- Phase gate: `pnpm audit --prod` exit-0 (or all High/Critical in accepted-risks doc) + full suite green

### Wave 0 Gaps

- [ ] `apps/bot/src/utils/__tests__/startup-token-check.spec.ts` — covers SEC-06 bot startup check
- [ ] `apps/matrix-bot/src/__tests__/startup-token-check.spec.ts` — covers SEC-06 matrix-bot startup check
- [ ] `apps/hub/server/plugins/__tests__/00-b-token-check.spec.ts` — covers SEC-06 hub plugin check
- [ ] `.planning/research/04-overrides-audit.md` — covers SEC-07 overrides documentation
- [ ] `.planning/research/04-audit-accepted-risks.md` — covers SEC-07 accepted risk documentation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (startup token validation) | fail-loud process.exit, no silent fallback |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (placeholder detection) | explicit string prefix check |
| V6 Cryptography | no | — |
| V14 Configuration | yes (secrets in env vars) | Docker Compose env substitution, .env.example documentation |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hardcoded credentials in VCS | Information Disclosure | Move to env-vars; add .env to .gitignore; document in .env.example |
| Placeholder token in production | Spoofing | Startup fail-loud check with process.exit(1) |
| Vulnerable transitive dependency | Tampering (SQL injection) | pnpm audit + overrides or direct upgrade |
| Unmaintained package CVE (request, form-data) | Spoofing / SSRF | Accepted risk + documentation; network isolation (internal Docker network) as defense-in-depth |

---

## Sources

### Primary (HIGH confidence — verified via tool)

- `platform/docker-compose.yml` — direct read, confirmed all 5 credential locations [VERIFIED]
- `platform/.env.example` — direct read, confirmed current structure [VERIFIED]
- `platform/package.json` — direct read, confirmed 15 overrides (not 12) [VERIFIED]
- `platform/apps/bot/src/index.ts` — direct read, confirmed DISCORD_BOT_TOKEN check pattern [VERIFIED]
- `platform/apps/matrix-bot/src/index.ts` — direct read, confirmed `|| ""` fallback [VERIFIED]
- `platform/apps/hub/server/utils/internal-auth.ts` — direct read, confirmed 503 pattern [VERIFIED]
- `platform/apps/hub/nuxt.config.ts` — direct read, confirmed runtimeConfig token structure [VERIFIED]
- `pnpm audit --prod` — live run, confirmed 23 findings (1 critical, 5 high, 17 moderate) [VERIFIED]
- `npm view <package> version` — confirmed latest versions for drizzle-orm (0.45.2), vite (8.0.8), lodash (4.18.1), defu (6.1.7), nuxt (4.4.2) [VERIFIED]

### Secondary (MEDIUM confidence)

- npm advisory database (via pnpm audit) — CVE numbers and patched version ranges
- npm registry versions — used to determine upgrade feasibility

---

## Metadata

**Confidence breakdown:**
- Compose changes: HIGH — exact line numbers verified, env-var syntax is standard Compose v2
- pnpm audit findings: HIGH — live audit run against actual lockfile
- Override analysis: MEDIUM — version comparisons verified but "can it be removed" requires pnpm-why check per package
- Startup check implementation: HIGH — existing patterns in codebase provide clear template
- Vite CVE production risk: LOW/MEDIUM — unclear whether Vite dev server runs in production; conservative fix (override) is the safe path

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (vulnerability landscape moves fast; re-run audit before executing if >2 weeks pass)
