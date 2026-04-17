---
phase: 2
slug: apps-plugin-sandbox
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Bot)** | Vitest 3.1.1 |
| **Framework (Hub)** | Vitest 2.1.1 |
| **Bot config file** | `platform/apps/bot/vitest.config.ts` |
| **Hub config file** | `platform/apps/hub/vitest.config.ts` |
| **Quick run command (bot)** | `cd platform && pnpm --filter @guildora/bot test` |
| **Quick run command (hub)** | `cd platform && pnpm --filter @guildora/hub test` |
| **Full suite command** | `cd platform && pnpm test` |
| **Estimated runtime** | ~2s (bot quick), ~10s (hub quick), ~30s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd platform && pnpm --filter @guildora/bot test` (bot tasks) or `pnpm --filter @guildora/hub test` (hub tasks)
- **After every plan wave:** Run `cd platform && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-xx-01 | xx | 0 | SEC-02 | T-02-01 | Wave 0 spec stubs created | setup | — | ❌ W0 | ⬜ pending |
| 2-xx-02 | xx | 1 | SEC-02 | T-02-01 | Slow/hanging hook abandoned after TIMEOUT_MS; `hook.timeout` logged | unit | `pnpm --filter @guildora/bot test -- --reporter=verbose` | ✅ extend app-hooks.spec.ts | ⬜ pending |
| 2-xx-03 | xx | 1 | SEC-02 | T-02-02 | Throwing hook logs `hook.error` with structured format | unit | `pnpm --filter @guildora/bot test -- --reporter=verbose` | ✅ extend app-hooks.spec.ts | ⬜ pending |
| 2-xx-04 | xx | 1 | SEC-02 | T-02-03 | Slow hub handler returns 504 and logs `route.timeout` | unit | `pnpm --filter @guildora/hub test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 2-xx-05 | xx | 1 | SEC-02 | T-02-04 | `--max-old-space-size` flag present in bot/hub startup scripts | config check | `grep max-old-space-size platform/apps/bot/package.json` | ❌ W0 | ⬜ pending |
| 2-xx-06 | xx | 1 | SEC-02 | T-02-05 | app.installed / app.uninstalled logged with correct format | unit | `pnpm --filter @guildora/hub test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 2-xx-07 | xx | 2 | SEC-02 | — | voice-rooms app runs unmodified after sandbox changes | manual | Run hub dev + load voice-rooms | manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` — add test cases for `hook.timeout` and structured `hook.error` (file exists, extend it)
- [ ] `platform/apps/hub/server/api/apps/__tests__/path.spec.ts` — new file: covers `route.timeout` + `route.error` for `[...path].ts`
- [ ] `platform/apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts` — new file: covers `app.installed` + `app.uninstalled` log events

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| voice-rooms app runs unmodified after sandbox changes | SEC-02 (compat) | Requires live hub dev server + installed app loading | Start hub dev, install voice-rooms app-template, trigger a hook, verify no errors in logs |
| `while(true){}` sync loop blocks event loop (documented limitation) | SEC-02 | Promise.race() cannot interrupt synchronous code — tested and documented | Run REPL: `const p = new Promise(r => { while(true){} }); Promise.race([p, new Promise(r => setTimeout(r, 100))]).then(() => console.log('timeout fired'))` — timeout will NOT fire |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
