---
phase: 3
slug: auth-session-h-rtung
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `platform/apps/hub/vitest.config.ts`, `platform/apps/matrix-bot/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @guildora/hub test run` |
| **Full suite command** | `pnpm --filter @guildora/hub test run && pnpm --filter @guildora/matrix-bot test run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @guildora/hub test run`
- **After every plan wave:** Run `pnpm --filter @guildora/hub test run && pnpm --filter @guildora/matrix-bot test run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | SEC-03 | F-03 | `timingSafeEqualString` used in `internal-auth.ts` | unit | `pnpm --filter @guildora/hub test run internal-auth` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | SEC-03 | F-04 | `timingSafeEqualString` used in matrix-bot `internal-sync-server.ts` | unit | `pnpm --filter @guildora/matrix-bot test run` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | SEC-04 | F-02 | Unauthenticated `/api/` request returns 401 | integration | `pnpm --filter @guildora/hub test run session` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | SEC-04 | F-02 | `locale-context.get.ts` returns 401 without session | unit | `pnpm --filter @guildora/hub test run locale-context` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | SEC-05 | F-07 | Dev endpoint returns 404 in non-dev build | doc-test | `pnpm --filter @guildora/hub test run dev` | ✅ | ⬜ pending |
| 3-03-02 | 03 | 2 | SEC-05 | F-10 | Cookie-Secure uses `NODE_ENV !== "development"` | doc-test | `pnpm --filter @guildora/hub test run cookie` | ✅ | ⬜ pending |
| 3-03-03 | 03 | 2 | SEC-05 | F-09 | Session-Rotation documented + verification test | unit | `pnpm --filter @guildora/hub test run session-rotation` | ❌ W0 | ⬜ pending |
| 3-03-04 | 03 | 2 | SEC-05 | F-17 | CSRF-skip comment present in `02-csrf-check.ts` | manual | grep check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `platform/apps/hub/server/middleware/__tests__/session.spec.ts` — integration test: unauthenticated `/api/` request returns 401
- [ ] `platform/apps/hub/server/api/internal/__tests__/locale-context.spec.ts` — unit test: requireSession() on locale-context
- [x] `platform/apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts` — documentation test (grep-based; import.meta.dev is not unit-testable)
- [x] `platform/apps/hub/server/__tests__/cookie-secure.spec.ts` — documentation test (grep-based; config read at startup)
- [ ] `platform/apps/hub/server/__tests__/session-rotation.spec.ts` — session rotation verification test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSRF-Skip comment quality | SEC-05 / F-17 | Comment review is subjective — no automated check needed | Read `platform/apps/hub/server/middleware/02-csrf-check.ts:15` — verify comment explains SSR-internal-request rationale |
| Cookie SameSite + HttpOnly in prod | SEC-05 | Requires running prod build and browser inspection | Build hub, open browser devtools, verify Set-Cookie header attributes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — Wave 0 complete for plan 03 items (dev-endpoints + cookie-secure); nyquist_compliant set to true
