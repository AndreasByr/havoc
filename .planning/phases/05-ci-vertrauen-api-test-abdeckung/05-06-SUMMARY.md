---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: "06"
subsystem: testing
tags: [vitest, api-tests, admin-settings, community-settings, vite8]

requires:
  - phase: 05-03
    provides: ESLint zero-error cleanup that spec files depend on (no-explicit-any fixes in test files)

provides:
  - admin-settings.spec.ts covering 5 admin route groups (GET/PUT community-settings, theme, membership-settings, moderation-rights, discord-roles)
  - community-settings.spec.ts covering display-name-template GET and apps index/navigation/activate/deactivate
  - vitest upgrade from 2.1.x to 3.2.4 fixing SSR transform compatibility with Vite 8
  - 35 previously blocked spec files now passing (317 -> 329 tests)

affects: [05-07, ci-test-step, future-spec-files]

tech-stack:
  added: [vitest@3.2.4 (upgrade from 2.1.x)]
  patterns: [mocks.requireUserSession for auth guard testing, vi.resetModules in afterEach, dynamic importHandler() per describe block]

key-files:
  created:
    - apps/hub/server/api/__tests__/admin-settings.spec.ts
    - apps/hub/server/api/__tests__/community-settings.spec.ts
  modified:
    - apps/hub/vitest.config.ts
    - apps/hub/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Use mocks.requireUserSession (via stubNuxtAutoImports) instead of vi.mock('../../utils/auth') — this matches the established pattern in all existing spec files since requireAdminSession/requireSession both call requireUserSession internally"
  - "Upgrade vitest from 2.1.x to 3.1.1+ (resolved to 3.2.4) — vitest 2.x with Vite 8 caused ReferenceError: __vite_ssr_exportName__ is not defined in all specs importing TypeScript helper files; vitest 3.x ships vite-node 3.x which defines this global"
  - "Change h3 alias to index.cjs instead of index.mjs — avoids ESM/SSR transform ambiguity"

patterns-established:
  - "Auth guard pattern: mocks.requireUserSession.mockResolvedValue(buildSession('user')) triggers 403 in admin routes; mockRejectedValue(new Error()) triggers 401 for all routes"
  - "DB chain mock: chain object with select/from/where/limit/orderBy/.then that resolves to returnValue array"
  - "vi.stubGlobal('eq', vi.fn()) and vi.stubGlobal('desc', vi.fn()) for drizzle-orm auto-imports in server routes"

requirements-completed:
  - QA-01

duration: 12min
completed: 2026-04-18
---

# Phase 5 Plan 06: Admin Settings and Community Settings Spec Files Summary

**35 previously blocked spec files unlocked by vitest 3.x upgrade (Vite 8 SSR compat fix); admin-settings.spec.ts (23 tests) and community-settings.spec.ts (12 tests) added, full suite 329/329 passing**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-18T11:49:02Z
- **Completed:** 2026-04-18T12:01:43Z
- **Tasks:** 2 (+ 1 blocking fix)
- **Files modified:** 5

## Accomplishments

- Created admin-settings.spec.ts with 9 describe blocks covering all 5 admin settings route groups (community-settings GET/PUT, theme GET/PUT, membership-settings GET/PUT, moderation-rights GET/PUT, discord-roles GET) — 23 tests total
- Created community-settings.spec.ts with 5 describe blocks covering display-name-template GET, apps index GET, navigation GET, activate POST, deactivate POST — 12 tests total
- Fixed pre-existing vitest 2.x + Vite 8 SSR transform incompatibility that was silently blocking 35 spec files (0 passing → 317 passing), then 329 with our 2 new files

## Task Commits

1. **Rule 3 Fix: vitest SSR transform incompatibility** - `6a6bb05` (fix)
2. **Task 1+2: admin-settings.spec.ts and community-settings.spec.ts** - `4729e63` (test)

## Files Created/Modified

- `apps/hub/server/api/__tests__/admin-settings.spec.ts` - 23 tests across 9 describe blocks for admin settings routes; requireAdminSession enforcement via mocks.requireUserSession pattern
- `apps/hub/server/api/__tests__/community-settings.spec.ts` - 12 tests across 5 describe blocks; requireSession for display-name-template/apps routes, requireAdminSession for activate/deactivate
- `apps/hub/vitest.config.ts` - upgraded h3 alias to .cjs, removed deprecated esbuild option
- `apps/hub/package.json` - vitest bumped from ^2.1.0 to ^3.1.1
- `pnpm-lock.yaml` - resolved to vitest@3.2.4

## Decisions Made

- Followed the `mocks.requireUserSession` pattern (not `vi.mock("../../utils/auth")`) because all existing spec files use this approach — `requireAdminSession` calls `requireUserSession` internally so mocking the auto-imported function is the correct interception point
- Upgraded vitest to 3.x as a Rule 3 blocking fix — without this, zero spec files that import TypeScript helpers would pass, making the plan's acceptance criteria impossible to meet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest 2.x + Vite 8 SSR transform incompatibility**
- **Found during:** Task 1 verification (attempting to run admin-settings.spec.ts)
- **Issue:** vitest 2.1.9 uses vite-node 2.x which resolves to vite@8 (hoisted by Nuxt 4). Vite 8 SSR transforms inject `__vite_ssr_exportName__` into TypeScript modules, but vite-node 2.x does not define this global in the execution context. All 35 spec files that import TypeScript helper modules failed with `ReferenceError: __vite_ssr_exportName__ is not defined`. This was a pre-existing issue on the branch baseline — 35 files failing, only 3 passing.
- **Fix:** Upgraded vitest from `^2.1.0` to `^3.1.1` (resolved to 3.2.4). vitest 3.x ships vite-node 3.x which defines `__vite_ssr_exportName__` in its client execution context.
- **Files modified:** apps/hub/package.json, pnpm-lock.yaml, apps/hub/vitest.config.ts
- **Verification:** Full suite went from 35 failing → 39 passing (317 → 329 tests)
- **Committed in:** 6a6bb05

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Essential fix — no spec files would have passed without it. The vitest upgrade is a minimal targeted change that only affects the hub test runner, not production code or other packages.

## Issues Encountered

The `__vite_ssr_exportName__` error was subtle — it manifested as "0 tests" in the failing spec files (collection-time failure), and the error pointed to the test-helper file rather than the spec file importing it. Root cause tracing required bisection through minimal test cases to identify that the SSR transform was the culprit and that it was a vitest/vite version mismatch.

## Known Stubs

None — all new spec files test real handler behavior with properly mocked dependencies.

## Threat Flags

None — test files only; no new network endpoints or auth paths introduced.

## Self-Check

### Files exist:

- [x] apps/hub/server/api/__tests__/admin-settings.spec.ts — FOUND
- [x] apps/hub/server/api/__tests__/community-settings.spec.ts — FOUND

### Commits exist:

- [x] 6a6bb05 — FOUND (vitest fix)
- [x] 4729e63 — FOUND (spec files)

### Test results:

- [x] 329/329 tests passing across 39 spec files

## Self-Check: PASSED

## Next Phase Readiness

- All D-04 priority route groups now have spec files (admin-settings, community-settings complete)
- Full test suite at 329 tests passing deterministically
- vitest upgrade is backward-compatible — all pre-existing tests still pass
- Plan 05-07 (remaining CI work) can proceed without test infrastructure concerns

---
*Phase: 05-ci-vertrauen-api-test-abdeckung*
*Completed: 2026-04-18*
