---
phase: 02-apps-plugin-sandbox
plan: "04"
subsystem: ops-config
tags: [memory-cap, v8, dos-mitigation, env-config]
dependency_graph:
  requires: []
  provides: [memory-capped-bot-start, memory-capped-hub-start, memory-capped-hub-docker, app-hook-timeout-env-doc]
  affects: [apps/bot/package.json, apps/hub/package.json, apps/hub/Dockerfile, .env.example]
tech_stack:
  added: []
  patterns: [NODE_OPTIONS env var for V8 flags, inline --max-old-space-size flag in node invocation]
key_files:
  created: []
  modified:
    - apps/bot/package.json
    - apps/hub/package.json
    - apps/hub/Dockerfile
    - .env.example
decisions:
  - "Bot uses NODE_OPTIONS=--max-old-space-size=512 (env var form) for consistency with tsx-based dev; hub uses inline flag since it runs a single node process"
  - "Dev scripts intentionally left unchanged — memory caps during development would affect tsx/nuxt-dev process trees unnecessarily"
  - "512 MB for bot (discord.js + drizzle overhead), 1024 MB for hub (Nuxt/Nitro + full app stack)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 02 Plan 04: Process Memory Caps and APP_HOOK_TIMEOUT_MS Documentation Summary

V8 heap caps added to all three Node.js production startup locations (bot start, hub start, hub Dockerfile CMD) and APP_HOOK_TIMEOUT_MS documented in .env.example under a new Apps / Plugin System section.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add --max-old-space-size flags to bot and hub startup scripts | eff6a79 | apps/bot/package.json, apps/hub/package.json, apps/hub/Dockerfile |
| 2 | Document APP_HOOK_TIMEOUT_MS in .env.example | 4555aae | .env.example |

## Changes Made

### Task 1: Memory Caps

**apps/bot/package.json** — `start` script changed to:
```json
"start": "NODE_OPTIONS=--max-old-space-size=512 node dist/apps/bot/src/index.js"
```

**apps/hub/package.json** — `start` script changed to:
```json
"start": "node --max-old-space-size=1024 --env-file=../../.env .output/server/index.mjs"
```

**apps/hub/Dockerfile** — CMD changed to:
```dockerfile
CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]
```

Dev scripts in both packages are unchanged.

### Task 2: .env.example Documentation

New section appended at end of `.env.example`:
```bash
# ─── Apps / Plugin System ────────────────────────────────────────────────────

# Timeout in milliseconds for app hook and route handler execution.
# Applies to both bot hooks (BotAppHookRegistry.emit) and Hub API route handlers.
# NOTE: Only interrupts async operations (I/O, external API calls).
#       Tight synchronous loops in app code are not affected — see Phase 2 docs.
# APP_HOOK_TIMEOUT_MS=5000
```

## Security Threat Coverage

| Threat ID | Category | Disposition | Implementation |
|-----------|----------|-------------|----------------|
| T-02-10 | DoS — process memory | mitigate | --max-old-space-size=512/1024 caps V8 heap; OOM crash → error log + Docker restart policy rather than host starvation |
| T-02-11 | DoS — cap affects whole process | accept | Values account for full runtime overhead (discord.js, drizzle, Nuxt/Nitro); per-app limits not feasible without isolated-vm |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are configuration-only with no data flow to UI.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Changes are startup-script and env-doc only.

## Self-Check: PASSED

- apps/bot/package.json — FOUND, contains `max-old-space-size=512`
- apps/hub/package.json — FOUND, contains `max-old-space-size=1024`
- apps/hub/Dockerfile — FOUND, contains `max-old-space-size=1024`
- .env.example — FOUND, contains `APP_HOOK_TIMEOUT_MS=5000`
- Commits eff6a79 and 4555aae — FOUND in git log
