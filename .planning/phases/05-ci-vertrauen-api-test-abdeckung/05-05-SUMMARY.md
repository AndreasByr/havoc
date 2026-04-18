---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: "05"
subsystem: testing
tags: [vitest, vite8, vite-node, auth-routes, mod-routes, api-tests, unit-tests]

requires:
  - phase: 05-03
    provides: ESLint-clean hub codebase enabling test files to pass lint

provides:
  - Auth+CSRF route spec file with logout and csrf-token behavioral tests
  - Mod route spec file covering all 12 /api/mod/* handlers with 401/403 auth checks
  - Vitest 3.2.4 upgrade fixing vite-8/vite-node-2.x incompatibility across all 37 hub test files

affects:
  - CI test gate (pnpm --filter @guildora/hub test now passes all 320 tests)
  - Future test plans that add hub spec files

tech-stack:
  added:
    - vitest ^3.1.0 (upgraded from ^2.1.0 — fixes __vite_ssr_exportName__ incompatibility with vite 8)
  patterns:
    - vi.mock("../../utils/auth") with requireModeratorSession/requireAdminSession/requireModeratorRight stubs
    - Dynamic importHandler() per describe block for module isolation
    - vi.resetModules() in afterEach to prevent cross-test module caching
    - Auth rejection helpers (mockModeratorReject401, mockModeratorReject403, mockRequireOk) for DRY test setup

key-files:
  created:
    - apps/hub/server/api/__tests__/auth-routes.spec.ts
    - apps/hub/server/api/__tests__/mod-routes.spec.ts
  modified:
    - apps/hub/package.json (vitest ^2.1.0 → ^3.1.0)
    - apps/hub/vitest.config.ts (remove deprecated esbuild option; oxc is now default)
    - pnpm-lock.yaml (lockfile updated for vitest 3.2.4)

key-decisions:
  - "Upgrade vitest to ^3.1.0 instead of patching vite-node internals — cleaner and permanent fix"
  - "Mock requireAdminSession separately from requireModeratorSession for community-roles POST/PUT/DELETE (they use admin-level auth, not moderator-level)"
  - "Mock requireModeratorRight for tags GET/POST (right-based auth, not requireModeratorSession)"
  - "Drop esbuild: false from vitest.config.ts — oxc is the default in vite 8 and vitest 3.x handles this automatically"

patterns-established:
  - "Auth-check test pattern: 401 (no session) + 403 (wrong role) per route, happy-path for selected routes"
  - "Auth rejection helpers exported as async functions that import and configure mocks after vi.resetModules()"
  - "vi.mock('../../utils/moderation-rights') for requireModeratorRight-protected routes"

requirements-completed:
  - QA-01

duration: 15min
completed: 2026-04-18
---

# Phase 05 Plan 05: Auth + Mod Route Spec Coverage Summary

**Two new spec files covering auth/CSRF and all 12 mod routes with 401/403/200 tests, plus vitest 3.x upgrade fixing vite-8 incompatibility that had broken 34 of 37 test files**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-18T11:48:00Z
- **Completed:** 2026-04-18T12:02:37Z
- **Tasks:** 2 spec tasks + 1 prerequisite fix
- **Files modified:** 5

## Accomplishments

- Created `auth-routes.spec.ts` with 3 tests: logout clears session and returns ok; csrf-token generates new token when none exists; csrf-token returns existing token without calling setUserSession
- Created `mod-routes.spec.ts` with 26 tests covering all 12 mod route handlers (401+403 per route, happy-path 200 for GET /api/mod/users and GET /api/mod/community-roles)
- Fixed pre-existing breakage: vitest 2.1.9 + vite 8 incompatibility (`__vite_ssr_exportName__ is not defined`) had caused 34 of 37 test files to fail; upgrading to vitest 3.2.4 restored all tests (320 total now passing)
- Correctly identified that community-roles POST/PUT/DELETE require `requireAdminSession`, not `requireModeratorSession`, and tags GET/POST use `requireModeratorRight` — mocked accordingly

## Task Commits

1. **Prereq: vitest 3.x upgrade** - `81c4bb1` (fix)
2. **Task 1: auth-routes.spec.ts** - `047de20` (test)
3. **Task 2: mod-routes.spec.ts + vitest.config.ts cleanup** - `ae3e3a6` (test)

## Files Created/Modified

- `apps/hub/server/api/__tests__/auth-routes.spec.ts` — 3 tests for logout and csrf-token handlers
- `apps/hub/server/api/__tests__/mod-routes.spec.ts` — 26 tests for all 12 mod route handlers
- `apps/hub/package.json` — vitest version bumped to ^3.1.0
- `apps/hub/vitest.config.ts` — removed deprecated `esbuild` option (oxc is now default in vite 8)
- `pnpm-lock.yaml` — lockfile updated for vitest 3.2.4

## Decisions Made

- **Upgrade vitest vs. patch vite-node:** The `__vite_ssr_exportName__` incompatibility could have been fixed by patching vite-node's client context object in node_modules, but that would not survive `pnpm install`. Upgrading vitest to 3.x (which uses vite-node 3.x with full vite 8 support) is the correct permanent fix.
- **Mock requireAdminSession for community-roles CUD routes:** The plan template suggested mocking only `requireModeratorSession`, but community-roles POST/PUT/DELETE use `requireAdminSession`. The tests correctly test the actual auth guard that each route uses.
- **Mock requireModeratorRight for tags routes:** Tags GET/POST use `requireModeratorRight` from `utils/moderation-rights`, which internally calls `requireSession`. The tests mock `requireModeratorRight` directly as the authoritative guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vite-8 / vite-node-2.1.9 incompatibility breaking all 34 existing test files**
- **Found during:** Task 1 initial test run
- **Issue:** vitest 2.1.9 paired with vite 8 (introduced via pnpm-lock.yaml update in plan 04-02) caused `ReferenceError: __vite_ssr_exportName__ is not defined` at module load time. 34 of 37 hub test files failed.
- **Root cause:** vite 8's SSR transform generates `__vite_ssr_exportName__(name, getter)` calls for named exports, but vite-node 2.1.9 does not inject this function into the module execution context (only available in vite-node 3.x).
- **Fix:** Updated `apps/hub/package.json` vitest from `^2.1.0` to `^3.1.0`. Also removed deprecated `esbuild: { tsconfigRaw: '{}' }` from vitest.config.ts since oxc (vite 8's default) handles TypeScript transforms natively and doesn't need the tsconfig bypass.
- **Files modified:** apps/hub/package.json, apps/hub/vitest.config.ts, pnpm-lock.yaml
- **Verification:** `pnpm --filter @guildora/hub test` passes 320 tests across 38 test files (up from 6 tests passing in 3 files)
- **Committed in:** 81c4bb1

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking pre-existing issue)
**Impact on plan:** Essential fix. Without it, no new tests could be verified. No scope creep — the fix is scoped to the hub package's vitest version.

## Issues Encountered

- The `.nuxt` directory was not present in the worktree initially, causing an oxc tsconfig resolution error. Resolved by copying `.nuxt` from the main workspace. The primary fix (vitest upgrade) made this moot since vitest 3.x + vite 8 oxc loads tsconfig correctly from the existing hub tsconfig.json.

## Known Stubs

None — all test assertions verify actual behavioral outcomes from handler imports.

## Threat Flags

None — this plan only adds test files and updates a test dependency version.

## Next Phase Readiness

- 320 tests pass across 38 spec files in @guildora/hub
- Community-settings and apps API route tests (also on D-04 priority list) are the next gap to fill
- CI `pnpm --filter @guildora/hub test` gate should now be green once the worktree is merged

---
*Phase: 05-ci-vertrauen-api-test-abdeckung*
*Completed: 2026-04-18*

## Self-Check: PASSED

Files verified:
- `apps/hub/server/api/__tests__/auth-routes.spec.ts` — FOUND
- `apps/hub/server/api/__tests__/mod-routes.spec.ts` — FOUND
- `apps/hub/package.json` — FOUND (vitest ^3.1.0)
- `apps/hub/vitest.config.ts` — FOUND (no esbuild option)
- Commits 81c4bb1, 047de20, ae3e3a6 — all present in git log
