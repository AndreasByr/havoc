---
phase: 4
slug: supply-chain-secrets
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.0 |
| **Config file** | `platform/apps/hub/vitest.config.ts`, `platform/apps/bot/vitest.config.ts` |
| **Quick run command** | `cd platform && pnpm --filter @guildora/hub test run` |
| **Full suite command** | `cd platform && pnpm --filter @guildora/hub test run && pnpm --filter @guildora/bot test run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd platform && pnpm --filter @guildora/hub test run`
- **After every plan wave:** Run full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SEC-06 | F-05 | docker-compose.yml has no hardcoded POSTGRES_PASSWORD | manual | `grep -c "POSTGRES_PASSWORD: postgres" platform/docker-compose.yml` returns 0 | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | SEC-06 | F-05 | .env.example documents new required vars | manual | `grep -c "POSTGRES_PASSWORD" platform/.env.example` returns ≥1 | ✅ | ⬜ pending |
| 4-01-03 | 01 | 1 | SEC-06 | F-05 | Compose startup with env-based credentials verified; log snippet in SUMMARY | manual | operator checkpoint: startup log captured in 04-01-SUMMARY.md | ✅ | ⬜ pending |
| 4-02-01 | 02 | 1 | SEC-07 | F-12 | pnpm audit --prod has no unresolved High/Critical | manual | `cd platform && pnpm audit --prod --audit-level=high` exits 0 or findings are documented | ✅ | ⬜ pending |
| 4-02-02 | 02 | 1 | SEC-07 | F-12 | 04-overrides-audit.md exists with all entries documented | manual | `test -f .planning/research/04-overrides-audit.md` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | SEC-06 | F-11 | Hub startup fails with clear error when token is placeholder | unit | `cd platform && pnpm --filter @guildora/hub test run -- token-check` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 2 | SEC-06 | F-11 | Bot startup fails with clear error when token is placeholder | unit | `cd platform && pnpm --filter @guildora/bot test run -- token-check` | ❌ W0 | ⬜ pending |
| 4-03-03 | 03 | 2 | SEC-06 | F-11 | Matrix-bot startup fails with clear error when token is placeholder | unit | `cd platform && pnpm --filter @guildora/matrix-bot test run -- token-check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `platform/apps/hub/server/plugins/__tests__/token-check.spec.ts` — stubs for startup token validation (SEC-06, F-11) — created in 04-03-PLAN.md Wave 0 task
- [x] `platform/apps/bot/src/__tests__/token-check.spec.ts` — stubs for startup token validation — created in 04-03-PLAN.md Wave 0 task
- [x] `platform/apps/matrix-bot/src/__tests__/token-check.spec.ts` — stubs for startup token validation — created in 04-03-PLAN.md Wave 0 task

*Wave 0 test stubs are created within the TDD plans (04-03-PLAN.md) as the first task before any implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| docker-compose starts correctly with new env-var credentials | SEC-06 | Requires running Docker stack on the host (not inside alice-bot container) | Set POSTGRES_PASSWORD in .env, run `docker compose up db`, verify hub/bot connect successfully — captured as log snippet in 04-01-SUMMARY.md (Task 3 checkpoint) |
| pnpm audit --prod clean or accepted risks documented | SEC-07 | Requires live network access to npm registry | Run `cd platform && pnpm audit --prod`, compare output to 04-audit-accepted-risks.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test stubs created in 04-03-PLAN.md)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
