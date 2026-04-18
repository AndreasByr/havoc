---
phase: 05-ci-vertrauen-api-test-abdeckung
plan: "07"
subsystem: ci
tags: [ci, lint, github-actions, blocking-gate]
dependency_graph:
  requires: [05-04, 05-05, 05-06]
  provides: [blocking-lint-gate]
  affects: [.github/workflows/ci.yml, .github/workflows/release.yml]
tech_stack:
  added: []
  patterns: [lint-as-blocking-ci-gate]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
decisions:
  - "Security audit step in release.yml intentionally retains continue-on-error: true — audit findings are informational per threat model T-05-16"
metrics:
  duration: "5m"
  completed: "2026-04-18T12:08:32Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 05 Plan 07: Lint CI Gate Hardening Summary

Removed `continue-on-error: true` from the Lint step in both `ci.yml` and `release.yml`, making lint a real blocking gate that fails CI on any future lint regression.

## One-liner

Lint is now a hard CI gate — `continue-on-error` removed from both workflow files, security audit intentionally left non-blocking.

## What Was Done

Plans 03 and 04 made lint clean (0 errors). This plan closes the loop: removing `continue-on-error: true` from the Lint step so that future regressions cause CI to fail and block merges. The Security audit step in `release.yml` keeps its `continue-on-error: true` by design (audit is informational — all Critical/High vulnerabilities were cleaned in Phase 4).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove continue-on-error from Lint steps in both workflow files | beb1a02 | .github/workflows/ci.yml, .github/workflows/release.yml |

## Verification Results

- `grep -c "continue-on-error" ci.yml` → 0 (no occurrences — Lint step is now blocking)
- `grep -c "continue-on-error" release.yml` → 1 (Security audit step only — intentionally retained)
- `pnpm --filter @guildora/hub lint` → exits 0, 98 warnings, 0 errors (gate is safe to enforce)

## Decisions Made

- Security audit in release.yml keeps `continue-on-error: true` — per threat model T-05-16, audit findings are accepted as informational since Phase 4 cleared all Critical/High vulnerabilities. Blocking releases on informational audit findings would be disruptive without safety benefit.

## Deviations from Plan

None — plan executed exactly as written. Lint prerequisite confirmed clean before removing the gate bypass.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Workflow change only affects CI behavior.

## Self-Check: PASSED

- `.github/workflows/ci.yml` modified: confirmed (0 continue-on-error entries)
- `.github/workflows/release.yml` modified: confirmed (1 continue-on-error entry — Security audit only)
- Commit beb1a02 exists: confirmed (`git log --oneline -3`)
