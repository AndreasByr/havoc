---
phase: 5
slug: ci-vertrauen-api-test-abdeckung
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.0 (hub) |
| **Config file** | `apps/hub/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @guildora/hub test` |
| **Full suite command** | `pnpm --filter @guildora/hub test` (same — all hub tests run in ~2s) |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @guildora/hub test`
- **After every plan wave:** Run `pnpm --filter @guildora/hub test && pnpm --filter @guildora/hub lint`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm typecheck` green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-CI-AUDIT | 01 | 1 | CI-01 | — | N/A | manual | — (document artifact) | ❌ Wave 0 | ⬜ pending |
| 5-TYPECHECK | 02 | 2 | CI-02 | — | N/A | integration | `pnpm typecheck` | N/A | ⬜ pending |
| 5-LINT-FIX | 03 | 3 | CI-02 | — | N/A | integration | `pnpm --filter @guildora/hub lint` | N/A | ⬜ pending |
| 5-ESLINT-PLUGINS | 04 | 3 | CI-02 | — | N/A | integration | `pnpm --filter @guildora/hub lint` | N/A | ⬜ pending |
| 5-AUTH-ROUTES | 05 | 4 | QA-01 | — | 401 without session, 403 wrong role, 200 correct | unit | `pnpm --filter @guildora/hub test server/api/__tests__/auth-routes.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 5-MOD-ROUTES | 06 | 4 | QA-01 | — | 401 without session, 403 wrong role, 200 correct | unit | `pnpm --filter @guildora/hub test server/api/__tests__/mod-routes.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 5-ADMIN-SETTINGS | 07 | 4 | QA-01 | — | 401 without session, 403 wrong role, 200 correct | unit | `pnpm --filter @guildora/hub test server/api/__tests__/admin-settings.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 5-COMMUNITY-SETTINGS | 08 | 4 | QA-01 | — | 401 without session, 200 correct | unit | `pnpm --filter @guildora/hub test server/api/__tests__/community-settings.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/research/05-ci-audit.md` — CI-01 artifact: job-by-job status document
- [ ] `apps/hub/server/api/__tests__/auth-routes.spec.ts` — stubs for QA-01 auth coverage
- [ ] `apps/hub/server/api/__tests__/mod-routes.spec.ts` — stubs for QA-01 mod coverage
- [ ] `apps/hub/server/api/__tests__/admin-settings.spec.ts` — stubs for QA-01 admin settings
- [ ] `apps/hub/server/api/__tests__/community-settings.spec.ts` — stubs for QA-01 community-settings

*Existing Vitest infrastructure is adequate — no framework changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI Audit document accurately describes each workflow job's status | CI-01 | Document artifact — requires reading CI run history and comparing to file content | Read `.planning/research/05-ci-audit.md`, verify each job listed matches current `.github/workflows/` files |
| "3 aufeinanderfolgende Commits" typecheck stability | CI-02 (D-10) | Requires observing 3 actual CI runs on main | Check CI run history after merge; record in audit doc |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
