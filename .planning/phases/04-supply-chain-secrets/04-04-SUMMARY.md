---
phase: 04-supply-chain-secrets
plan: "04"
subsystem: hub-server
tags: [security, startup-validation, token-check, nitro-plugin, tdd]
dependency_graph:
  requires: []
  provides: [hub-startup-token-validation]
  affects: [hub-nitro-startup, bot-internal-token-auth, mcp-internal-token-auth]
tech_stack:
  added: []
  patterns: [nitro-plugin-startup-check, fail-loud-never-fake]
key_files:
  created:
    - apps/hub/server/plugins/00-b-token-check.ts
    - apps/hub/server/plugins/__tests__/token-check.spec.ts
  modified:
    - apps/hub/server/utils/__tests__/test-helpers.ts
decisions:
  - defineNitroPlugin stub added to stubNuxtAutoImports so plugin tests can invoke handler logic directly without Nitro runtime
  - Placeholder detection via prefix list (replace_with_, changeme, your_token_here, dev-) to cover common developer mistakes
  - MCP token absence is not an error (feature-disabled is valid); only placeholder values trigger exit
metrics:
  duration: ~8 minutes
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 04: Startup Token Validation Summary

**One-liner:** Nitro startup plugin validates BOT_INTERNAL_TOKEN (required) and MCP_INTERNAL_TOKEN (optional placeholder check) with process.exit(1) on invalid values; 5 unit tests via TDD RED/GREEN.

## What Was Built

Created `00-b-token-check.ts`, a Nitro server plugin that runs at Hub startup (after `00-a-load-env.ts`, before `00-db-migrate.ts`). The plugin enforces "Fail Loud, Never Fake" (SEC-06/F-11) by aborting the Hub process before any traffic is served if:

- `BOT_INTERNAL_TOKEN` is empty or starts with a placeholder prefix (`replace_with_`, `changeme`, `your_token_here`, `dev-`)
- `MCP_INTERNAL_TOKEN` is non-empty but starts with a placeholder prefix

An absent `MCP_INTERNAL_TOKEN` is treated as feature-disabled (valid config), not an error.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write token-check plugin tests (RED) | f54e41f | test-helpers.ts (defineNitroPlugin stub), plugins/__tests__/token-check.spec.ts |
| 2 | Create 00-b-token-check.ts plugin (GREEN) | 8257021 | plugins/00-b-token-check.ts |

## Test Coverage

All 5 required scenarios covered and passing:

1. Empty `botInternalToken` → `process.exit(1)` called
2. Placeholder `botInternalToken` (`replace_with_internal_sync_token`) → `process.exit(1)` called
3. Valid `botInternalToken` + absent `mcpInternalToken` → no exit (MCP optional)
4. Valid `botInternalToken` + placeholder `mcpInternalToken` (`changeme`) → `process.exit(1)` called
5. Both tokens valid → no exit, no error

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

RED gate commit (test): f54e41f
GREEN gate commit (feat): 8257021

Both gates present in correct order.

## Known Stubs

None - implementation is complete and functional.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The plugin only reads existing `runtimeConfig` values and calls `process.exit(1)` - no new trust boundaries created.

## Self-Check: PASSED

- apps/hub/server/plugins/00-b-token-check.ts: FOUND
- apps/hub/server/plugins/__tests__/token-check.spec.ts: FOUND
- apps/hub/server/utils/__tests__/test-helpers.ts: FOUND
- Commit f54e41f (RED): FOUND
- Commit 8257021 (GREEN): FOUND
