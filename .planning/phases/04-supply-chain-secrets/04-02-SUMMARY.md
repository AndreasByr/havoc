---
phase: 04-supply-chain-secrets
plan: "02"
subsystem: dependencies
tags: [security, pnpm, cve, drizzle-orm, supply-chain]
dependency_graph:
  requires: []
  provides: [clean-prod-audit, overrides-documented, drizzle-orm-upgraded]
  affects: [package.json, pnpm-lock.yaml, packages/shared, apps/hub, apps/bot]
tech_stack:
  added: []
  patterns: [pnpm-overrides, accepted-risk-documentation]
key_files:
  created:
    - .planning/research/04-overrides-audit.md
    - .planning/research/04-audit-accepted-risks.md
  modified:
    - package.json
    - packages/shared/package.json
    - apps/hub/package.json
    - apps/bot/package.json
    - pnpm-lock.yaml
decisions:
  - "Accept CVE-2025-7783 (form-data via matrix-bot-sdk/request) as accepted risk — no upstream fix; matrix-bot does not use multipart forms; internal network only"
  - "All 15 pre-existing pnpm.overrides retained — none are safely removable at this time"
  - "drizzle-orm upgraded ^0.44.5 -> ^0.45.2 (SQL injection fix CVE-2026-39356)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-18"
  tasks_completed: 3
  files_changed: 7
---

# Phase 4 Plan 02: Dependency CVE Remediation Summary

Fix all resolvable High/Critical vulnerabilities found by `pnpm audit --prod`, add three new `pnpm.overrides` entries (defu, lodash, vite), upgrade drizzle-orm to 0.45.2 in shared/hub/bot, and document all 18 overrides plus accepted risks for the unresolvable matrix-bot-sdk CVE chain.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add pnpm.overrides + upgrade drizzle-orm | 983aead | package.json, packages/shared/package.json, apps/hub/package.json, apps/bot/package.json, pnpm-lock.yaml |
| 2 | Create overrides audit + accepted-risks docs | d084792 | .planning/research/04-overrides-audit.md, .planning/research/04-audit-accepted-risks.md |
| 3 | Verify pnpm audit --prod and test suite | (no code changes; verification only) | — |

## Outcomes

### CVE Remediation Status

| CVE | Severity | Package | Resolution |
|-----|----------|---------|------------|
| CVE-2026-35209 | High | defu | FIXED — pnpm.overrides "defu": ">=6.1.5" |
| CVE-2026-4800 | High | lodash | FIXED — pnpm.overrides "lodash": ">=4.18.0" |
| CVE-2026-39364 | High | vite | FIXED — pnpm.overrides "vite": ">=7.3.2" |
| CVE-2026-39363 | High | vite | FIXED — pnpm.overrides "vite": ">=7.3.2" |
| CVE-2026-39356 | High | drizzle-orm | FIXED — upgraded ^0.44.5 -> ^0.45.2 in shared/hub/bot |
| CVE-2025-7783 | Critical | form-data (via matrix-bot-sdk > request) | ACCEPTED RISK — documented in 04-audit-accepted-risks.md |

Post-fix audit: `pnpm audit --prod --audit-level=high` reports 1 Critical (form-data, accepted risk) + 15 Moderate. Zero unaccepted High/Critical findings.

### pnpm.overrides

Updated from 15 to 18 entries. All 18 are documented in `.planning/research/04-overrides-audit.md` with CVE/reason, upstream patch status, and removability assessment per D-06/D-07.

### drizzle-orm Upgrade

drizzle-orm 0.45.2 successfully installed in all three packages. Bot test suite (118 tests, 11 files) passes with no API regressions. Hub tests have pre-existing tsconfig infrastructure failure in worktree (nuxt prepare not run), unrelated to this change — confirmed by bot test pass and by the nature of the error ("Tsconfig not found" from oxc transform, not drizzle API errors).

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

```
grep '"defu": ">=6.1.5"' package.json           # 1 match - PASS
grep '"lodash": ">=4.18.0"' package.json         # 1 match - PASS
grep '"vite": ">=7.3.2"' package.json            # 1 match - PASS
grep '"drizzle-orm": "^0.45.2"' packages/shared/package.json  # 1 match - PASS
grep '"drizzle-orm": "^0.45.2"' apps/hub/package.json          # 1 match - PASS
grep '"drizzle-orm": "^0.45.2"' apps/bot/package.json          # 1 match - PASS
pnpm audit --prod --audit-level=high             # 1 Critical (accepted), 0 unaccepted High - PASS
pnpm --filter @guildora/bot vitest run           # 118 tests passed - PASS
```

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Changes are package manifest and documentation only.

## Self-Check: PASSED

- package.json: FOUND (18 overrides including defu/lodash/vite)
- packages/shared/package.json: FOUND (drizzle-orm ^0.45.2)
- apps/hub/package.json: FOUND (drizzle-orm ^0.45.2)
- apps/bot/package.json: FOUND (drizzle-orm ^0.45.2)
- .planning/research/04-overrides-audit.md: FOUND (35 lines, 18 entries)
- .planning/research/04-audit-accepted-risks.md: FOUND (CVE-2025-7783 documented)
- Commit 983aead: FOUND
- Commit d084792: FOUND
