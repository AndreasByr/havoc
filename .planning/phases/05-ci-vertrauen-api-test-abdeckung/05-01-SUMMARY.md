---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: "01"
subsystem: ci
tags: [ci, audit, baseline, documentation]
dependency_graph:
  requires: []
  provides: [CI-01]
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md
  modified: []
decisions:
  - "CI-01 baseline captures 2 failing gates (lint non-blocking, typecheck blocking) and 1 stable gate (hub unit tests)"
  - "TS2322 in matrix-bot is the only blocking failure before Phase 5 fixes begin"
metrics:
  duration: "58s"
  completed: "2026-04-18"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 05 Plan 01: CI Audit Baseline Summary

**One-liner:** CI-01 artifact created — per-job status matrix for all 4 GitHub Actions workflows documenting TS2322 blocking failure, 257 lint errors (non-blocking), and 291 stable hub unit tests.

## What Was Built

Created `.planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md` — the CI-01 requirement artifact. This document captures the pre-fix Ist-Zustand of all GitHub Actions workflows before any Phase 5 changes are applied.

**Key findings documented:**

- `ci.yml`: 2 jobs — Lint (non-blocking, 257 hub errors) and Typecheck (blocking, 1 TS2322 error in matrix-bot)
- `test.yml`: Hub unit tests STABLE (291/291, ~2s)
- `release.yml`: Same lint/typecheck failures, plus stable hub tests and intentionally non-blocking security audit
- `security.yml`: Independent daily scan with Linear + Discord notifications, no push-CI dependency

**Root causes captured:**
- TS2322: `BOT_INTERNAL_TOKEN` (type `string | undefined`) passed to `startInternalSyncServer({ token: string })` at `apps/matrix-bot/src/index.ts:44` — process guard on lines 21-26 doesn't narrow across function boundaries. Fix is a 1-line non-null assertion.
- 257 lint errors: dominated by `no-explicit-any` (149), `no-unused-vars` (51), `unified-signatures` (24), `import/no-duplicates` (16)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write CI audit document | fd63e2d | `.planning/phases/05-ci-vertrauen-api-test-abdeckung/05-CI-AUDIT.md` |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this plan creates only a planning document in `.planning/`. No network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `05-CI-AUDIT.md` exists: FOUND
- Task commit `fd63e2d` exists: FOUND (verified via `git log`)
- All 11 acceptance criteria met (ci.yml, test.yml, release.yml, security.yml, continue-on-error, TS2322, 257, 291, STABLE, NEIN all present)
