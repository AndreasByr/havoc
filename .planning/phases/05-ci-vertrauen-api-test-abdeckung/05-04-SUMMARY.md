---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: "04"
subsystem: infra
tags: [eslint, security, eslint-plugin-security, eslint-plugin-no-unsanitized, hub]

# Dependency graph
requires:
  - phase: 05-03
    provides: Hub ESLint at zero-error baseline

provides:
  - eslint-plugin-security and eslint-plugin-no-unsanitized active in @guildora/hub ESLint config
  - Security-aware lint rules covering object injection, unsafe regex, non-literal fs paths, and innerHTML

affects:
  - 05-05
  - 05-06
  - 05-07

# Tech tracking
tech-stack:
  added:
    - eslint-plugin-security@^4.0.0
    - eslint-plugin-no-unsanitized@^4.1.5
  patterns:
    - Both security plugins added via withNuxt() to eslint.config.mjs using pluginSecurity.configs.recommended and nounsanitized.configs.recommended
    - All plugin rules operate at warning severity (recommended defaults); lint still exits 0 enabling CI blocking

key-files:
  created: []
  modified:
    - apps/hub/eslint.config.mjs
    - apps/hub/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Security plugins set rules as 'warn' not 'error' via recommended configs — lint exits 0, findings are visible but not blocking in current baseline; future work can upgrade specific rules to error severity"
  - "No line-level suppressions were needed: app-loader dynamic require does not trigger detect-non-literal-require in the installed plugin version; all 96 findings are warnings from recommended rules"
  - "Pre-existing test suite failures (33+ files, __vite_ssr_exportName__ error) are unrelated to this plan — confirmed by identical failures before and after changes"

patterns-established:
  - "Security ESLint plugins: import as named default, register via withNuxt() alongside other config objects"

requirements-completed:
  - CI-02

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 05 Plan 04: Security ESLint Plugin Integration Summary

**eslint-plugin-security and eslint-plugin-no-unsanitized installed and active in @guildora/hub, detecting 96 security-category warnings with lint exiting 0**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-18T11:48:48Z
- **Completed:** 2026-04-18T11:51:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Installed `eslint-plugin-security@^4.0.0` and `eslint-plugin-no-unsanitized@^4.1.5` as devDependencies in `@guildora/hub`
- Updated `apps/hub/eslint.config.mjs` to import both plugins and register them via `withNuxt(pluginSecurity.configs.recommended, nounsanitized.configs.recommended)`
- Confirmed `pnpm --filter @guildora/hub lint` exits 0 — 96 security findings visible as warnings, none as blocking errors
- Confirmed hub typecheck exits 0; pre-existing test failures unchanged

## Task Commits

1. **Task 1: Install security plugins and integrate into eslint.config.mjs** - `82de4dc` (feat)
2. **Task 2: Verify hub tests still pass** - (verification only, no new commit needed)

**Plan metadata:** See final docs commit below.

## Files Created/Modified

- `apps/hub/eslint.config.mjs` - Added imports and withNuxt registration for both security plugins
- `apps/hub/package.json` - Added eslint-plugin-security and eslint-plugin-no-unsanitized as devDependencies
- `pnpm-lock.yaml` - Updated lockfile with new plugin dependencies

## Decisions Made

- Security plugins use recommended configs which set all rules to `warn` severity. This means lint exits 0 while surfacing 96 findings across object injection, unsafe regex, non-literal fs paths, and RegExp constructor patterns. Future hardening can selectively escalate specific rules to `error`.
- No line-level suppressions were added. The anticipated `security/detect-non-literal-require` in `app-loader.ts` did not trigger — the plugin's recommended config does not flag the pattern in that file's context.
- File-level `/* eslint-disable */` in `.nuxt/` auto-generated files are pre-existing and not a concern.

## Deviations from Plan

None - plan executed exactly as written. The anticipated `security/detect-non-literal-require` finding in app-loader did not appear (not triggered by the plugin for that pattern), so no suppressions were required.

## Issues Encountered

- The `pnpm typecheck` workspace-wide command fails for `@guildora/motion` (missing node_modules/vue-tsc in worktree) — pre-existing issue unrelated to this plan. Hub-specific typecheck (`pnpm --filter @guildora/hub typecheck`) exits 0.
- Hub test suite shows 33 failing test files — pre-existing `__vite_ssr_exportName__` infrastructure error confirmed identical before and after changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Security ESLint rules are now active and visible. Wave 5 plans (05-05 through 05-07) can proceed.
- Future work can selectively escalate specific security warnings to errors (e.g., `security/detect-unsafe-regex`, `no-unsanitized/property`) once the baseline has been reviewed.
- The 96 security warnings provide a prioritized list of patterns to address in subsequent hardening work.

## Self-Check

- [x] `apps/hub/eslint.config.mjs` updated — FOUND
- [x] `apps/hub/package.json` contains both plugins — FOUND
- [x] Task commit `82de4dc` exists — FOUND
- [x] `pnpm --filter @guildora/hub lint` exits 0 — VERIFIED
- [x] No file-level eslint-disable in source files — VERIFIED (only in .nuxt/ auto-generated)

## Self-Check: PASSED

---
*Phase: 05-ci-vertrauen-api-test-abdeckung*
*Completed: 2026-04-18*
