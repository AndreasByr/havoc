# Phase 5: CI-Vertrauen & API-Test-Abdeckung - Research

**Researched:** 2026-04-18
**Domain:** CI/CD pipeline health, ESLint configuration, Vitest unit testing for Nuxt server routes
**Confidence:** HIGH — all findings verified by direct codebase inspection and command execution

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lint-Strategie**
- D-01: Alle bestehenden Lint-Fehler im `platform/`-Tree werden gefixed (nicht per eslint-disable unterdrückt). Danach wird `continue-on-error: true` aus `ci.yml` und `release.yml` entfernt — Lint ist wieder blocking.
- D-02: ESLint-Security-Plugins beide integrieren: `eslint-plugin-security` + `eslint-plugin-no-unsanitized`. Diese wurden in Phase 1 explizit auf Phase 5 verschoben.
- D-03: Falls die Security-Plugins neue Findings produzieren, die kurzfristig nicht fixbar sind: gezielte `// eslint-disable-next-line ... -- reason`-Kommentare pro Zeile. Kein warn-only-Modus — Lint bleibt blocking auch für Security-Plugin-Regeln.

**API-Test-Priorisierung**
- D-04: Route-Gruppen auf die priorisierte Test-Liste (alle vier): Auth+CSRF, Admin (bestehende Lücken), Mod (`/api/mod/*`), Community-Settings+Apps-API.
- D-05: Test-Tiefe: Auth-Check + Happy-Path pro Route. Konkret: 401 ohne Session, 403 bei falscher Rolle, 200/201 mit korrekter Session.
- D-06: Die Liste wird als benannte, priorisierte Aufzählung im Phase-Planning festgelegt. Success = jede Route auf der Liste hat einen Spec-File — kein Coverage-Prozent-Ziel.

**CI-Test-Scope**
- D-07: CI-Test-Scope bleibt nur `@guildora/hub`. Bot-, Matrix-Bot- und Shared-Tests laufen weiterhin nur lokal.

**Typecheck-Stabilität**
- D-08: Typecheck-Status ist aktuell unklar. Das CI-Audit-Dokument (Success Criteria 1 der Phase) klärt den Ist-Stand als allererstes: stable / flaky / slow / skipped pro Job.
- D-09: Flaky Tests: Fix oder `// TODO: flaky — <reason>` mit Todo-Referenz. Kein stilles Ignorieren, kein `it.skip` ohne Kommentar.
- D-10: "3 aufeinanderfolgende Commits" = Verifikations-Hinweis im CI-Dokument.

### Claude's Discretion

- Reihenfolge der Plan-Waves (Audit-Dokument zuerst vs. Lint-Fix zuerst) — Planner entscheidet nach Abhängigkeiten.
- Genaue Zuordnung von Routen zu Spec-Files (ob bestehende erweitert oder neue angelegt werden) — Planner entscheidet nach Codestruktur.
- Ob F-13 Auth-Rate-Limit (deferred von Phase 3) in Phase 5 als separater Plan aufgenommen wird — Planner bewertet Aufwand.

### Deferred Ideas (OUT OF SCOPE)

- Vollständiger Error-Case-Sweep für API-Tests (400, 404, 422) — zu aufwändig für Phase 5; Phase 8 oder eigene Initiative.
- Bot-, Matrix-Bot- und Shared-Package-Tests in CI — bewusst aus Scope genommen; spätere Entscheidung.
- ESLint-Regeln für weitere Pakete (marketplace, bot) — nur hub/web in Phase 5.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | Ist-Zustand der CI ist dokumentiert: welche Workflows laufen, welche Jobs sind stabil/flaky/slow/kaputt, welche Gates sind wirklich durchgesetzt vs. non-blocking | CI Workflow Audit section below — all 4 workflows mapped, status per job verified |
| CI-02 | CI ist vertrauenswürdig: Typecheck grün und stabil, Lint wieder blocking (Lint-Debt aufgelöst), Tests deterministisch, keine bekannten Flaky-Specs ohne `// TODO`-Verweis | Lint Debt Assessment + Typecheck Status + Test Status sections — concrete counts and fixes identified |
| QA-01 | Kritische API-Endpoints haben Unit/Integration-Tests — Messgröße: Liste der priorisierten Routen ist abgearbeitet | API Test Gap Analysis section — named route list with current spec coverage status |
</phase_requirements>

---

## Summary

The CI pipeline currently has two non-blocking gates: Lint in both `ci.yml` and `release.yml` carries `continue-on-error: true`, meaning a lint failure does not block merges or releases. The `pnpm typecheck` step is blocking in CI but is currently failing at the `@guildora/matrix-bot` level due to one TS2322 error in `src/index.ts:44` (passing `string | undefined` where `string` is required). Hub and Web typechecks both pass cleanly.

Lint debt in `@guildora/hub` is substantial: 257 errors across 82 files. The dominant error type is `@typescript-eslint/no-explicit-any` (149 instances), primarily concentrated in test spec files where `any` is used for mock chain builders. The remaining errors are fixable without business logic changes: unused vars, duplicate imports, `unified-signatures`, one `vue/no-mutating-props`, one `vue/no-v-text-v-html-on-component`. `@guildora/web` has only warnings (0 errors).

The test suite (36 spec files, 291 tests) runs in under 2 seconds and passes deterministically. No flaky tests detected; no `it.skip` without comment found. The established test pattern (`vi.mock` + `stubNuxtAutoImports()` + dynamic `import()` of handler) is consistent across all existing specs and fully adequate for the new mod-route and auth-route specs required by D-04.

**Primary recommendation:** Wave 0 = CI Audit document. Wave 1 = fix matrix-bot typecheck (1 line). Wave 2 = fix hub lint errors (fix code, not suppress). Wave 3 = add ESLint security plugins. Wave 4 = write mod/auth/community-settings spec files. Remove `continue-on-error` as final step once lint is green.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lint enforcement | CI pipeline (`ci.yml`, `release.yml`) | Local dev (`pnpm lint`) | Gates must be in CI to block merges |
| Typecheck | CI pipeline (turbo typecheck) | — | Already blocking in CI; scope includes all workspace apps |
| Unit tests for Hub API | `@guildora/hub` Vitest (local + CI) | CI `test.yml` | D-07: only hub runs in CI; bot/matrix-bot/shared are local-only |
| ESLint plugin integration | `apps/hub/eslint.config.mjs` | `apps/web/eslint.config.mjs` | Security plugins are per-app flat config entries |
| Security-plugin suppress decisions | Inline `// eslint-disable-next-line` in source | — | D-03: per-line, no file-level suppression |

---

## CI Workflow Audit

> This section IS the CI-01 artifact foundation. The Audit Document (Success Criteria 1) should be built from this data.

### `.github/workflows/ci.yml` — Push/PR to `main`, `dev`

| Job | Step | Status | Gate? |
|-----|------|--------|-------|
| `ci` | `pnpm install --frozen-lockfile` | STABLE | Yes |
| `ci` | `pnpm lint` | FAILS (257 hub errors) | **NON-BLOCKING** (`continue-on-error: true`) |
| `ci` | `pnpm typecheck` | **FAILING** (matrix-bot TS2322) | Yes — blocking |
| `ci` | `pnpm build` | Unknown (may be affected by typecheck failure) | Yes — blocking |

[VERIFIED: direct file read + pnpm lint/typecheck execution]

**Key finding:** Typecheck currently FAILS in CI because `pnpm typecheck` runs all workspace packages via Turbo. The matrix-bot `src/index.ts:44` passes `BOT_INTERNAL_TOKEN` (type `string | undefined`) to `startInternalSyncServer({ token: string })`. Fix is one line: either narrow with `!` assertion after the guard on line 21, or adjust the ServerConfig type.

### `.github/workflows/test.yml` — Push/PR to `main`, `dev`

| Job | Step | Status | Gate? |
|-----|------|--------|-------|
| `hub-unit-tests` | `pnpm --filter @guildora/hub test` | STABLE — 36 files, 291 tests, ~2s | Yes — blocking |

[VERIFIED: test run executed]

No flaky tests observed. All 291 tests pass deterministically. Test run is fast (1.97s total). No `it.skip`, `xit`, or `// TODO: flaky` markers found.

### `.github/workflows/release.yml` — Push to `v*` tags

| Job | Step | Status | Gate? |
|-----|------|--------|-------|
| `validate` | `pnpm lint` | FAILS | **NON-BLOCKING** (`continue-on-error: true`) |
| `validate` | `pnpm typecheck` | FAILS (matrix-bot) | Yes — blocking |
| `validate` | `pnpm build` | Unknown | Yes — blocking |
| `validate` | `pnpm --filter @guildora/hub test` | STABLE | Yes — blocking |
| `validate` | `pnpm audit --audit-level=high` | Unknown | **NON-BLOCKING** (`continue-on-error: true`) |
| `create-release` | GitHub release creation | — | Needs `validate` |
| `docker-publish` | Docker build + push (hub, web, bot) | — | Needs `create-release` |

[VERIFIED: direct file read]

### `.github/workflows/security.yml` — Daily cron 04:00 UTC + `workflow_dispatch`

| Job | Step | Status | Gate? |
|-----|------|--------|-------|
| `security-scan` | Claude Code security scan via `anthropics/claude-code-base-action@beta` | INDEPENDENT — runs separately | No (scheduled scan, no PR gate) |
| `security-scan` | `pnpm audit` | Part of scan | No (informational) |
| Notification | Linear issue creation + Discord alert | Conditional on findings | No |

[VERIFIED: direct file read]

**Note:** `security.yml` uses `anthropics/claude-code-base-action@beta` and requires `CLAUDE_CODE_OAUTH_TOKEN`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, and `DISCORD_SECURITY_WEBHOOK` secrets. This runs independently of push CI.

### Packages with Real Lint (not stubs)

Only `@guildora/hub` and `@guildora/web` have actual ESLint configured. Bot, shared, motion, and app-sdk have lint scripts that echo "No lint configured." This means `pnpm lint` (turbo) only produces real output from hub and web.

[VERIFIED: executed `pnpm --filter @guildora/bot lint` etc.]

---

## Lint Debt Assessment

### Hub (`@guildora/hub`) — 257 Errors, 75 Warnings

**Verified by:** `pnpm --filter @guildora/hub lint 2>&1` — exit code 1

| Rule | Count | Location | Fix Strategy |
|------|-------|----------|-------------|
| `@typescript-eslint/no-explicit-any` | 149 | Test files (mocks/chains) + some production utils | Fix production code with proper types; test files: use typed alternatives or `unknown` |
| `@typescript-eslint/no-unused-vars` | 51 | Production Vue + TS files | Remove unused imports/variables |
| `@typescript-eslint/unified-signatures` | 24 | Flow-builder Vue components (emit overloads) | Combine emit signatures to union types |
| `import/no-duplicates` | 16 | Production utils (application-archive.ts, application-flows.ts, etc.) | Merge duplicate import statements |
| `@typescript-eslint/no-dynamic-delete` | 5 | Production TS | Refactor delete expressions |
| `vue/no-mutating-props` | 1 | `SimpleFormSection.vue:108` | Extract local ref |
| `vue/no-v-text-v-html-on-component` | 1 | `LandingPreview.vue:74` | Use default slot or `v-html` on element, not component |
| Other | ~10 | Mixed | Various small fixes |

**Files with errors (82 total):**
- 18 test/spec files (primarily `no-explicit-any` in mock chain builders)
- 64 production files (Vue components, composables, server utils, API routes)

**Warnings (75):** All `vue/html-self-closing` in Vue templates — fixable with `--fix` flag (74 of 75 auto-fixable per ESLint output).

**Key insight for test files:** The `any` usage in test files like `mockDbWithUserRows(userRows: any[])` and chain builders (`chain.then = (resolve: Function) => ...`) is a pattern concern. The `Function` type error appears in `test-helpers.ts` itself. These can be fixed with typed generics or `vi.fn<[...], ...>()` signatures.

**Key insight for production code:** The `import/no-duplicates` pattern in `application-archive.ts`, `application-flows.ts`, `membership-sync.ts` is caused by two separate import statements from the same module (e.g., `@guildora/shared`). Merging them is a safe mechanical fix.

### Web (`@guildora/web`) — 0 Errors, 12 Warnings

**Verified by:** `pnpm --filter @guildora/web lint 2>&1` — exit code 0

Web lint already passes (exit 0). Warnings are all `vue/html-self-closing` and `vue/attributes-order` — not blocking. No action required to make lint blocking in CI for web.

### Packages with Stub Lint — No Action Needed

Bot, shared, motion, app-sdk all echo "No lint configured." They participate in `turbo run lint` but never fail.

---

## Typecheck Status

### Hub (`@guildora/hub`) — PASSING

```
pnpm --filter @guildora/hub typecheck → exit 0
```

`nuxt typecheck` runs `vue-tsc` on hub. Passes cleanly. One WARN about duplicated imports for `getUserByDiscordId` (two utils both export it) — this is a runtime warning from Nuxt, not a type error, and does not block typecheck. [VERIFIED]

### Web (`@guildora/web`) — PASSING

```
pnpm --filter @guildora/web typecheck → exit 0
```

[VERIFIED]

### Bot (`@guildora/bot`) — PASSING

```
pnpm --filter @guildora/bot typecheck → exit 0
```

[VERIFIED]

### Matrix-Bot (`@guildora/matrix-bot`) — FAILING

```
pnpm --filter @guildora/matrix-bot typecheck → exit 2

src/index.ts(44,5): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
```

**Root cause:** Line 44 in `src/index.ts` passes `BOT_INTERNAL_TOKEN` (declared as `string | undefined` from `process.env`) to `startInternalSyncServer({ token: BOT_INTERNAL_TOKEN })` where `ServerConfig.token` is typed as `string`. The guard on lines 21–27 validates `BOT_INTERNAL_TOKEN` and calls `process.exit(1)` if falsy, but TypeScript's narrowing does not carry that guarantee across the function boundary.

**Fix:** One line — change `token: BOT_INTERNAL_TOKEN` to `token: BOT_INTERNAL_TOKEN!` (non-null assertion) after the existing guard block. Alternative: `token: BOT_INTERNAL_TOKEN as string` is equivalent here given the guard.

**CI impact:** Since `pnpm typecheck` runs Turbo which includes all workspace packages, this single matrix-bot error causes the entire `pnpm typecheck` step to fail with exit code 2, blocking CI. This is a blocking bug that must be fixed before CI is trustworthy.

[VERIFIED: reproduced directly]

---

## ESLint Security Plugin Integration

### Plugin Availability and Compatibility

| Plugin | Latest Version | ESLint Compatibility | Flat Config Support |
|--------|---------------|---------------------|---------------------|
| `eslint-plugin-security` | 4.0.0 | No peer dep declared (works with ESLint 9+/10+) | Yes — `pluginSecurity.configs.recommended` |
| `eslint-plugin-no-unsanitized` | 4.1.5 | `eslint: ^9 || ^10` | Yes — `nounsanitized.configs.recommended` |

Hub uses ESLint 10.0.3 via `@nuxt/eslint`. Both plugins support flat config. Neither is currently installed in hub or root node_modules. [VERIFIED: npm view + node -e check]

### Integration Pattern with `@nuxt/eslint` Flat Config

Hub's `apps/hub/eslint.config.mjs` currently:
```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
)
```

`withNuxt()` accepts additional flat config objects as arguments (it uses `defineFlatConfigs` internally from `@nuxt/eslint-config`).

**Correct integration pattern:**
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

[CITED: github.com/eslint-community/eslint-plugin-security#readme + github.com/mozilla/eslint-plugin-no-unsanitized]

**Installation:**
```bash
pnpm --filter @guildora/hub add -D eslint-plugin-security eslint-plugin-no-unsanitized
```

### Anticipated Security Plugin Findings

`eslint-plugin-security` rules that are most likely to trigger in the Guildora hub codebase:

- `detect-object-injection` — Bracket notation `obj[variable]` access. The hub has dynamic property lookups in app config handling and JSONB field access. Likely to produce multiple findings.
- `detect-non-literal-fs-filename` — Dynamic file paths. The media upload routes and avatar storage use `path.join(...)` with variables. May trigger.
- `detect-child-process` — Child process usage. Hub does not appear to use `child_process` but app-hooks execution might.
- `detect-non-literal-require` — The app-loader uses dynamic `require()` for app bundles. This WILL trigger and is intentional by design — use targeted `eslint-disable-next-line` per D-03.

`eslint-plugin-no-unsanitized` rules:
- `method` — `document.write()`, `insertAdjacentHTML()` — unlikely to trigger in server-side code; may appear in Vue component files.
- `property` — `innerHTML` assignments — the hub uses `isomorphic-dompurify` and `marked` in Vue components; `v-html` assignments that bypass the plugin may trigger.

**Realistic estimate:** 5–25 new findings after security plugin integration. The app-loader dynamic require and any bracket-notation object access in app config handling are the highest-probability triggers.

---

## API Test Gap Analysis

### What Currently EXISTS (must not duplicate)

**Group: Auth-related utilities (tested, not route-level)**
- `server/utils/__tests__/auth.spec.ts` — Tests `requireSession`, `requireAdminSession`, `requireModeratorSession` utility functions directly
- `server/utils/__tests__/csrf-check.spec.ts` — Tests `generateCsrfToken`, `validateCsrfToken` utilities + CSRF middleware behavior
- `server/utils/__tests__/auth-session.spec.ts` — Tests session rotation utilities
- `server/middleware/__tests__/session.spec.ts` — Tests `03-session.ts` middleware (deny-by-default, public path allowlist)

**Group: Admin routes (tested)**
- `server/api/__tests__/admin-users.spec.ts` — Covers DELETE `/api/admin/users/[id]`, POST batch-delete, delete-orphaned, import
- `server/api/__tests__/admin-apps.spec.ts` — Covers POST sideload, local-sideload, PUT config, PUT status
- `server/api/__tests__/admin-platforms.spec.ts` — Covers GET/POST/PUT/DELETE/test platforms
- `server/api/__tests__/admin-operations.spec.ts` — Covers GET users (list with pagination)
- `server/api/admin/apps/__tests__/audit-log.spec.ts` — Covers audit log endpoint

**Group: Apps execution (tested)**
- `server/api/apps/__tests__/path.spec.ts` — Tests `[...path].ts` timeout and error handling
- `server/api/apps/[appId]/__tests__/messages.spec.ts` — Tests app messages endpoint

**Group: Application flow (tested)**
- `server/api/__tests__/application-flow.spec.ts`

**Group: Member profile (tested)**
- `server/api/__tests__/member-profile.spec.ts`

**Group: Dev endpoints (tested)**
- `server/api/dev/__tests__/dev-endpoints.spec.ts`

### What Is MISSING — The D-04 Priority List

All verified by `find` scan on `server/api/` subdirectories. [VERIFIED]

#### Group 1: Auth + CSRF — Route-Level Tests (NEW)

| Route | File | Guard | Missing Test Focus |
|-------|------|-------|-------------------|
| `GET /api/auth/platforms` | `auth/platforms.get.ts` | None (public — lists available platforms) | Happy path: returns platform list; 200 |
| `POST /api/auth/logout` | `auth/logout.post.ts` | None (clears session) | Happy path: clears session; 200 |
| `GET /api/csrf-token` | `csrf-token.get.ts` | Unauthenticated (creates session) | Token generated on first call; same token returned on second call |
| `GET /api/auth/dev-login` | `auth/dev-login.get.ts` | Dev-only bypass flag | 404 in non-dev mode (already tested in dev-bypass.spec.ts — may just need extension) |

**Recommended:** One new spec file `server/api/__tests__/auth-routes.spec.ts` covering logout and csrf-token route handlers.

#### Group 2: Admin — Gap Fills (EXTEND or NEW)

Existing admin specs cover: users (delete ops), apps (sideload/status), platforms (CRUD), operations (list users). Still missing:

| Route Group | Files | Guard | Missing Test Focus |
|-------------|-------|-------|-------------------|
| `GET/PUT /api/admin/community-settings` | `admin/community-settings.get.ts`, `.put.ts` | `requireAdminSession` | 401/403/200 auth checks + happy path |
| `GET/PUT /api/admin/theme` | `admin/theme.get.ts`, `.put.ts` | `requireAdminSession` | 401/403/200 auth checks |
| `GET/PUT /api/admin/membership-settings` | `admin/membership-settings.get.ts`, `.put.ts` | `requireAdminSession` | 401/403/200 auth checks |
| `GET/PUT /api/admin/moderation-rights` | `admin/moderation-rights.get.ts`, `.put.ts` | `requireAdminSession` | 401/403/200 auth checks |
| `GET/PUT /api/admin/discord-roles` | `admin/discord-roles.get.ts`, `.put.ts` | `requireAdminSession` | 401/403 auth checks (happy path requires bot sync) |

**Recommended:** One new spec file `server/api/__tests__/admin-settings.spec.ts` covering the 5 settings-type admin routes with auth-check + happy-path pattern.

#### Group 3: Mod Routes — ALL NEW (0 specs currently)

| Route | File | Guard | Test Focus |
|-------|------|-------|------------|
| `GET /api/mod/users` | `mod/users/index.get.ts` | `requireModeratorSession` | 401 (no session), 403 (non-mod), 200 (mod) + pagination |
| `GET /api/mod/community-roles` | `mod/community-roles/index.get.ts` | `requireModeratorSession` | 401/403/200 |
| `POST /api/mod/community-roles` | `mod/community-roles/index.post.ts` | `requireModeratorSession` | 401/403/201 |
| `PUT /api/mod/community-roles/[id]` | `mod/community-roles/[id].put.ts` | `requireModeratorSession` | 401/403/200 |
| `DELETE /api/mod/community-roles/[id]` | `mod/community-roles/[id].delete.ts` | `requireModeratorSession` | 401/403/200 |
| `GET /api/mod/discord-roles` | `mod/discord-roles.get.ts` | `requireModeratorSession` | 401/403/200 |
| `GET /api/mod/tags` | `mod/tags/index.get.ts` | `requireModeratorSession` | 401/403/200 |
| `POST /api/mod/tags` | `mod/tags/index.post.ts` | `requireModeratorSession` | 401/403/201 |
| `PUT /api/mod/users/[id]/community-role` | `mod/users/[id]/community-role.put.ts` | `requireModeratorSession` | 401/403/200 |
| `PUT /api/mod/users/[id]/profile` | `mod/users/[id]/profile.put.ts` | `requireModeratorSession` | 401/403/200 |
| `POST /api/mod/users/batch-community-role` | `mod/users/batch-community-role.post.ts` | `requireModeratorSession` | 401/403/200 |
| `POST /api/mod/users/batch-discord-roles` | `mod/users/batch-discord-roles.post.ts` | `requireModeratorSession` | 401/403/200 |

**Recommended:** One new spec file `server/api/__tests__/mod-routes.spec.ts`. Priority order within the file: users index (GET), community-roles CRUD, then batch ops. Not all 12 routes need equal depth — auth-check + minimal happy path suffices per D-05.

#### Group 4: Community-Settings + Apps-API

| Route | File | Guard | Missing Test Focus |
|-------|------|-------|-------------------|
| `GET /api/community-settings/display-name-template` | `community-settings/display-name-template.get.ts` | `requireSession` | 401 (no session), 200 (any authenticated user) |
| `GET /api/apps` | `apps/index.get.ts` | Check needed | Auth check + happy path |
| `GET /api/apps/navigation` | `apps/navigation.get.ts` | Check needed | Auth check + happy path |
| `POST /api/apps/[appId]/activate` | `apps/[appId]/activate.post.ts` | Check needed | 401/403/200 |
| `POST /api/apps/[appId]/deactivate` | `apps/[appId]/deactivate.post.ts` | Check needed | 401/403/200 |

**Recommended:** Extend `server/api/apps/__tests__/path.spec.ts` or create `server/api/__tests__/community-settings.spec.ts`. The display-name-template route is the primary target for community-settings.

### Summary: Spec Files to Create

| File | Routes Covered | Priority |
|------|---------------|----------|
| `server/api/__tests__/auth-routes.spec.ts` | logout, csrf-token route handlers | HIGH |
| `server/api/__tests__/mod-routes.spec.ts` | All 12 mod routes (auth-check + happy path) | HIGH |
| `server/api/__tests__/admin-settings.spec.ts` | community-settings, theme, membership-settings, moderation-rights, discord-roles (admin) | MEDIUM |
| `server/api/__tests__/community-settings.spec.ts` | display-name-template, apps/index, apps/navigation, activate/deactivate | MEDIUM |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ESLint security rules | Custom lint plugin | `eslint-plugin-security` + `eslint-plugin-no-unsanitized` | Actively maintained by eslint-community and Mozilla; covers well-known AST patterns |
| Per-file inline suppression | File-level `/* eslint-disable */` | Line-level `// eslint-disable-next-line rule -- reason` | D-03 is explicit: no file-level disables |
| Test session mocking | Custom mock factories | Existing `stubNuxtAutoImports()`, `buildSession()`, `createMockEvent()` from `test-helpers.ts` | Already tested and used by 10+ spec files |
| Flat config merging | Manual array spread | `withNuxt(plugin1, plugin2)` pattern | `withNuxt` from `.nuxt/eslint.config.mjs` accepts additional flat config objects |

---

## Test Infrastructure Pattern

All existing specs follow an identical pattern. New specs MUST follow the same pattern.

### Standard Test Pattern

```typescript
// Source: apps/hub/server/api/__tests__/admin-users.spec.ts (established pattern)

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@guildora/shared", () => ({
  // stub only what the handler imports
}));

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── GET /api/mod/users ──────────────────────────────────────────────────────

describe("GET /api/mod/users", () => {
  async function importHandler() {
    return (await import("../mod/users/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    await expect(handler(event)).rejects.toThrow();
  });

  it("rejects non-moderator users (403)", async () => {
    const { event } = createAuthenticatedEvent("user");
    // requireModeratorSession will throw 403 for non-moderator
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    // ...
  });

  it("returns user list for moderator (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("moderator"));
    // ...
  });
});
```

### Key Implementation Notes

1. **`vi.resetModules()` in `afterEach`** is critical — handler is imported dynamically per test group via `importHandler()`. Without `resetModules()`, module mocks leak between test groups.

2. **`requireModeratorSession` is NOT in `stubNuxtAutoImports()`** — it is a named import in the handler file, not a Nuxt auto-import. For mod routes, must `vi.mock("../../../utils/auth", () => ({ requireModeratorSession: vi.fn() }))` and then control the mock in each test.

3. **Relative import paths** in `vi.mock()` must be relative to the **spec file location**, not the handler location.

4. **`@guildora/shared` mock** needs only the table symbols and functions actually used by the handler being tested — check imports at top of handler file.

5. **`getQuery`, `getRouterParam`, `readBody`** are Nuxt auto-imports — stub them via `vi.stubGlobal()` in `beforeEach` when the handler uses them.

### Auth Guard Quick Reference

| Guard Function | Min Role | Lives In |
|---------------|----------|---------|
| `requireSession` | Any logged-in user | `server/utils/auth.ts` (named export, not auto-import) |
| `requireModeratorSession` | `moderator` or above | `server/utils/auth.ts` |
| `requireAdminSession` | `admin` or above | `server/utils/auth.ts` |
| `requireUserSession` | Any logged-in (nuxt-auth-utils) | Nuxt auto-import (stubbed in `stubNuxtAutoImports`) |

**Critical:** `requireSession`, `requireModeratorSession`, `requireAdminSession` are NOT Nuxt auto-imports — they are explicit imports from `../../utils/auth` in each handler. They must be mocked via `vi.mock("../../utils/auth", ...)`, not via `vi.stubGlobal`.

---

## F-13 Auth Rate-Limit Assessment (Discretionary)

**Context:** Phase 3 deferred F-13 "separate rate-limit bucket for auth endpoints" to Phase 5.

**Current state:** The existing `01-rate-limit.ts` middleware applies a global 300 req/min rate limit to all `/api/*` routes. Auth routes (`/api/auth/discord`, `/api/auth/logout`) are included in this global limit. There is no separate, tighter limit specifically for auth callbacks.

**Scope if included in Phase 5:**
- Add a second call to `checkRateLimit()` in `auth/discord.get.ts` specifically (already does this — line 2 imports `checkRateLimit`). Actually, looking at the file, it already imports rate-limit utilities. The deferred finding was about a dedicated per-IP auth-specific limit, not the global one.
- Work required: Add one rate-limit call per auth endpoint with a tighter window (e.g., 10 attempts/5 min). ~30 min of work.
- Spec work: extend `dev-endpoints.spec.ts` or write `server/api/__tests__/auth-rate-limit.spec.ts`.

**Planner recommendation:** Low effort, high security value. Include as an optional Wave 5 task if phase time allows. Not blocking for CI-01/CI-02/QA-01.

---

## Common Pitfalls

### Pitfall 1: Removing `continue-on-error` Before Lint Is Clean

**What goes wrong:** If `continue-on-error: true` is removed from `ci.yml` before all 257 hub lint errors are fixed, every commit to `main`/`dev` fails CI. No merges possible.
**Why it happens:** Temptation to "fix the gate first."
**How to avoid:** Fix all lint errors, verify `pnpm lint` exits 0 locally, THEN remove `continue-on-error`.
**Warning signs:** Running `pnpm lint` locally still shows errors.

### Pitfall 2: Using File-Level `/* eslint-disable */` for Security Plugin Findings

**What goes wrong:** Security plugin produces 15 findings; developer suppresses whole file. D-03 explicitly prohibits this.
**Why it happens:** Convenience during initial plugin integration.
**How to avoid:** Use only `// eslint-disable-next-line rule -- specific reason why this is safe`.
**Warning signs:** Any `/* eslint-disable */` without a rule name in a file touched during this phase.

### Pitfall 3: Module Mock Scope in Vitest Dynamic Imports

**What goes wrong:** `vi.mock()` at the top of a test file mocks for the whole file, but `vi.resetModules()` in `afterEach` clears the module registry. If the mock factory references variables defined in the test, it can fail.
**Why it happens:** Vitest hoists `vi.mock()` calls to the top of the file (like Jest). The mock factory must not reference non-hoisted variables.
**How to avoid:** Mock factories use only inline values. Use `vi.fn()` stubs and set return values in `beforeEach`.
**Warning signs:** "Cannot access 'variable' before initialization" errors in test output.

### Pitfall 4: `requireModeratorSession` vs `requireUserSession` Confusion

**What goes wrong:** Developer stubs `requireUserSession` (in `stubNuxtAutoImports()`) expecting to control mod-route auth, but `requireModeratorSession` in the handler calls `requireSession()` internally which calls `requireUserSession`. Setting up `requireUserSession` to resolve does NOT mean `requireModeratorSession` will pass — it also checks the role.
**Why it happens:** The function chain is `requireModeratorSession → requireSession → requireUserSession`.
**How to avoid:** For mod route tests, mock `../../utils/auth` entirely: `vi.mock("../../utils/auth", () => ({ requireModeratorSession: vi.fn() }))`. Control the mock behavior in each test case.

### Pitfall 5: Typecheck via Turbo Includes All Workspace Packages

**What goes wrong:** `pnpm typecheck` (Turbo) fails if ANY workspace package has a typecheck error, even matrix-bot which is out of D-07 scope.
**Why it happens:** `turbo.json` includes all packages in the `typecheck` task.
**How to avoid:** Fix the matrix-bot TS2322 error (1 line) as the first task in Wave 1 — it's the only typecheck failure.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `eslint-plugin-security` required eslintrc format | v4.0.0+ supports flat config via `pluginSecurity.configs.recommended` | Can integrate directly into `withNuxt()` calls |
| `eslint-plugin-no-unsanitized` required legacy config | v4.x supports flat config via `nounsanitized.configs.recommended` | Same direct integration pattern |

---

## Environment Availability

Step 2.6: SKIPPED — This phase is code/config-only changes. No external services, databases, or CLI utilities beyond what is already confirmed in the development environment. The ESLint plugins will be installed via `pnpm add -D`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.0 (hub) |
| Config file | `apps/hub/vitest.config.ts` |
| Quick run command | `pnpm --filter @guildora/hub test` |
| Full suite command | `pnpm --filter @guildora/hub test` (same — all hub tests run in ~2s) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | CI Audit document exists and accurately describes each job's status | manual / document review | — (document artifact, not automated) | ❌ Wave 0 |
| CI-02 | `pnpm typecheck` exits 0 | integration | `pnpm typecheck` | N/A — verified by running command |
| CI-02 | `pnpm --filter @guildora/hub lint` exits 0 | integration | `pnpm --filter @guildora/hub lint` | N/A — verified by running command |
| CI-02 | All 291+ hub unit tests pass | unit | `pnpm --filter @guildora/hub test` | ✅ |
| QA-01 | Auth route handlers return 401/200 correctly | unit | `pnpm --filter @guildora/hub test server/api/__tests__/auth-routes.spec.ts` | ❌ Wave 4 |
| QA-01 | All mod routes enforce `requireModeratorSession` | unit | `pnpm --filter @guildora/hub test server/api/__tests__/mod-routes.spec.ts` | ❌ Wave 4 |
| QA-01 | Admin settings routes enforce `requireAdminSession` | unit | `pnpm --filter @guildora/hub test server/api/__tests__/admin-settings.spec.ts` | ❌ Wave 4 |
| QA-01 | Community-settings routes enforce `requireSession` | unit | `pnpm --filter @guildora/hub test server/api/__tests__/community-settings.spec.ts` | ❌ Wave 4 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @guildora/hub test`
- **Per wave merge:** `pnpm --filter @guildora/hub test && pnpm --filter @guildora/hub lint`
- **Phase gate:** Full suite green + `pnpm typecheck` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] CI Audit document — CI-01 artifact (document, not code)
- [ ] `server/api/__tests__/auth-routes.spec.ts` — covers QA-01 auth routes
- [ ] `server/api/__tests__/mod-routes.spec.ts` — covers QA-01 mod routes
- [ ] `server/api/__tests__/admin-settings.spec.ts` — covers QA-01 admin settings routes
- [ ] `server/api/__tests__/community-settings.spec.ts` — covers QA-01 community-settings

*(All wave 0 gaps are new spec files or document artifacts — existing test infrastructure fully adequate, no framework changes needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — not implementing new auth | existing nuxt-auth-utils |
| V3 Session Management | no — not changing session logic | existing cookie sessions |
| V4 Access Control | yes — adding tests that verify guards | `requireModeratorSession`, `requireAdminSession` pattern |
| V5 Input Validation | yes — security plugin integration detects unsafe patterns | eslint-plugin-no-unsanitized |
| V6 Cryptography | no — not changing crypto | existing `timingSafeEqual` (Phase 3) |

### Known Threat Patterns for This Phase's Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing auth guard on new routes | Elevation of privilege | `requireModeratorSession` / `requireAdminSession` — verified by new spec tests |
| XSS via unsanitized innerHTML | Tampering | `eslint-plugin-no-unsanitized` (D-02) |
| Object injection via bracket notation | Tampering | `eslint-plugin-security detect-object-injection` (D-02) |
| Dynamic `require()` in app loader | Tampering | Known/intentional — use targeted `eslint-disable-next-line` per D-03 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `withNuxt()` accepts additional flat config objects as positional arguments alongside plugins | ESLint Plugin Integration | If wrong, integration pattern may need wrapping in array spread; minor rework |
| A2 | `detect-object-injection` and dynamic-require will be the highest-trigger security rules | Security Plugin Findings | May be more or fewer findings; affects Wave 3 timeline estimate |

**Note:** Both assumptions are LOW risk. A1 is based on `@nuxt/eslint-config` documentation pattern (the exported `withNuxt` and `defineFlatConfigs`). A2 is based on codebase pattern analysis.

---

## Open Questions

1. **Where does the CI Audit document live?**
   - What we know: CONTEXT.md says ".planning/research/ or docs/" — Planner decides
   - What's unclear: Does it need to be in a git-tracked location? Should it be `.planning/research/05-ci-audit.md`?
   - Recommendation: Place in `.planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md` for phase-local traceability

2. **Should the matrix-bot typecheck fix be in scope for this phase?**
   - What we know: It's a 1-line fix; it's currently breaking `pnpm typecheck` in CI; matrix-bot is NOT in the hub test scope (D-07)
   - What's unclear: It's technically a matrix-bot change, not hub
   - Recommendation: Yes — include it, since it's a prerequisite for CI-02 (typecheck green). 1-line fix, trivial risk.

3. **Does `pnpm --filter @guildora/hub lint` cover all files or only `app/` and `server/`?**
   - What we know: Hub's prelint runs `nuxt prepare`, then `eslint .` — scans the entire hub app directory including tests, composables, pages, components, and server
   - What's unclear: Nothing — this is confirmed by the lint output showing test files being flagged
   - Recommendation: No action needed; all files are already in scope

---

## Sources

### Primary (HIGH confidence)

- `.github/workflows/ci.yml` — Direct file read; CI job structure verified
- `.github/workflows/test.yml` — Direct file read; hub test scope verified
- `.github/workflows/release.yml` — Direct file read; non-blocking gates verified
- `.github/workflows/security.yml` — Direct file read; scheduled scan structure verified
- `pnpm --filter @guildora/hub lint` executed — 257 errors, 75 warnings confirmed
- `pnpm --filter @guildora/hub typecheck` executed — exit 0 confirmed
- `pnpm --filter @guildora/matrix-bot typecheck` executed — TS2322 error confirmed
- `pnpm --filter @guildora/hub test` executed — 291 tests, 36 files, ~2s confirmed
- `find /platform/apps/hub/server/api -name "*.spec.ts"` — spec file inventory confirmed
- `find /platform/apps/hub/server/api/mod -type f` — all mod routes enumerated
- `apps/hub/server/utils/__tests__/test-helpers.ts` — test pattern documented
- `apps/hub/vitest.config.ts` — test framework config verified
- `apps/hub/eslint.config.mjs` — current ESLint config verified
- `npm view eslint-plugin-security`, `npm view eslint-plugin-no-unsanitized` — version and peer deps verified

### Secondary (MEDIUM confidence)

- `github.com/eslint-community/eslint-plugin-security#readme` — flat config integration pattern (WebFetch)
- `github.com/mozilla/eslint-plugin-no-unsanitized` — flat config integration pattern (WebFetch)

---

## Metadata

**Confidence breakdown:**
- CI Workflow Audit: HIGH — read and executed all workflows and commands
- Lint Debt Assessment: HIGH — executed `pnpm lint` and counted/categorized all errors
- Typecheck Status: HIGH — executed typecheck for each package individually
- ESLint Plugin Integration: MEDIUM — plugins not yet installed; integration pattern from docs
- API Test Gap Analysis: HIGH — enumerated all routes by `find`, checked all existing spec files
- Test Infrastructure Pattern: HIGH — read multiple existing spec files, confirmed consistent pattern

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable domain — ESLint plugin APIs, Vitest patterns are stable; CI config is local so always current)
