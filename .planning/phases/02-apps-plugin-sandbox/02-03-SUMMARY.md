---
phase: 02-apps-plugin-sandbox
plan: "03"
subsystem: hub-admin-apps
tags: [audit-log, app-lifecycle, tdd, security]
dependency_graph:
  requires: []
  provides: [app.installed-audit-log, app.uninstalled-audit-log]
  affects: [hub-admin-routes, docker-log-trail]
tech_stack:
  added: []
  patterns: [console.log-JSON-structured-audit, vi.spyOn-console-log-assertion]
key_files:
  created:
    - apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts
  modified:
    - apps/hub/server/api/admin/apps/sideload.post.ts
    - apps/hub/server/api/admin/apps/local-sideload.post.ts
    - apps/hub/server/api/admin/apps/[id].delete.ts
decisions:
  - "Used console.log(JSON.stringify(...)) matching Hub's existing stdout audit pattern (not consola)"
  - "deleted.appId (text column) used in uninstall log — not deleted.id (numeric) — per D-09 requirement"
  - "status.put.ts left untouched — activate/deactivate events explicitly out of D-09 scope"
metrics:
  duration: "~5 min"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 03: App Lifecycle Audit Log Summary

**One-liner:** Structured `console.log(JSON.stringify(...))` audit events for app install/uninstall wired into three Hub admin routes with three passing TDD specs.

## What Was Built

Added structured audit log calls to the three Hub admin routes covering App install and uninstall lifecycle events per D-09:

- `sideload.post.ts`: emits `{ appId, event: "app.installed" }` after `installAppFromUrl()` resolves
- `local-sideload.post.ts`: emits `{ appId: result.appId, event: "app.installed" }` after `installAppFromLocalPath()` resolves
- `[id].delete.ts`: emits `{ appId: deleted.appId, event: "app.uninstalled" }` after `refreshAppRegistry()` completes

A new spec file `audit-log.spec.ts` covers all three events with three passing test cases.

Admins can now trace the full install/uninstall lifecycle via: `docker logs hub | grep '"event"'`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create audit-log.spec.ts (RED phase) | 36b4edc | apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts |
| 2 | Add audit log lines to three routes (GREEN phase) | 73fe987 | sideload.post.ts, local-sideload.post.ts, [id].delete.ts |

## Verification Results

- `pnpm --filter @guildora/hub test` — 30 test files, 266 tests, all pass
- `grep "app.installed" sideload.post.ts` — match found
- `grep "app.installed" local-sideload.post.ts` — match found
- `grep "app.uninstalled" [id].delete.ts` — match found (uses `deleted.appId`, not `deleted.id`)
- `grep "app.installed\|app.uninstalled" status.put.ts` — no match (intentionally untouched)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test commit) | 36b4edc | PASS — 3 tests failed as expected before implementation |
| GREEN (feat commit) | 73fe987 | PASS — all 3 tests pass after adding log lines |

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy operational detail: tests were run from the main `platform/` directory (with files temporarily copied there) because the worktree lacks a `node_modules` installation. This is standard worktree behavior and does not affect the committed output.

## Known Stubs

None — all audit log lines emit real data from the route's success path.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Audit log writes only to stdout (docker logs), which is an admin-only surface already in scope per T-02-07/T-02-08 in the plan's threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| audit-log.spec.ts exists | FOUND |
| sideload.post.ts exists | FOUND |
| local-sideload.post.ts exists | FOUND |
| [id].delete.ts exists | FOUND |
| 02-03-SUMMARY.md exists | FOUND |
| Commit 36b4edc (RED test) | FOUND |
| Commit 73fe987 (GREEN feat) | FOUND |
