---
phase: 04-supply-chain-secrets
plan: "01"
subsystem: platform/infrastructure
tags: [security, docker-compose, credentials, secrets, postgres]
dependency_graph:
  requires: []
  provides: [SEC-06-mitigation, compose-env-var-credentials]
  affects: [platform/docker-compose.yml, platform/.env.example]
tech_stack:
  added: []
  patterns: [docker-compose-env-substitution]
key_files:
  created: []
  modified:
    - platform/docker-compose.yml
    - platform/.env.example
decisions:
  - "D-01: POSTGRES_USER and POSTGRES_DB left as literal values — not secrets, changing would break existing installations"
  - "D-02: Healthcheck uses inline defaults (${POSTGRES_USER:-postgres}) to avoid breaking if vars absent"
  - "D-03: POSTGRES_PASSWORD has no default in compose — missing value causes visible startup failure (Fail Loud, Never Fake)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-18T08:05:14Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
requirements:
  - SEC-06
---

# Phase 4 Plan 01: Remove Hardcoded DB Credentials from Docker Compose Summary

Replaced all five hardcoded `postgres:postgres` credential strings in `platform/docker-compose.yml` with `${VAR}` env-variable substitution, and updated `platform/.env.example` to document the new required variables with a clear production-required warning.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace hardcoded DB credentials in docker-compose.yml | c396b45 | docker-compose.yml |
| 2 | Update .env.example with POSTGRES_PASSWORD block and production warning | 691e346 | .env.example |
| 3 | Verify compose startup (checkpoint:human-verify) | PENDING | — |

## Task 3 Status

**PENDING HUMAN VERIFICATION:** Operator must verify compose startup on host after this plan merges. See plan Task 3 for full instructions. Approved by orchestrator to unblock parallel execution.

The verification requires running on the HOST machine (outside the alice-bot container):
```bash
cd /path/to/guildora/platform
docker compose up db --wait
docker compose up hub bot -d
docker compose logs hub --tail=50 | grep -E "ready|error|database|connect"
docker compose logs bot --tail=50 | grep -E "ready|error|database|connect"
```

Expected: both hub and bot connect successfully with no "password authentication failed" errors.

## Compose Startup Validation

PENDING HUMAN VERIFICATION: Operator must verify compose startup on host after this plan merges. See plan Task 3 for instructions. Approved by orchestrator to unblock parallel execution.

Prerequisites for the operator before running docker compose:
1. In `platform/.env` or `platform/.env.local`, add:
   - `POSTGRES_PASSWORD=<chosen-password>`
   - `DATABASE_URL=postgresql://postgres:<chosen-password>@db:5432/guildora`
2. Run `docker compose up db --wait` to initialize the DB with the new password
3. Run `docker compose up hub bot -d` and verify no auth errors in logs

## Changes Made

### docker-compose.yml — five credential replacements

| Location | Before | After |
|----------|--------|-------|
| Line 8 — db service | `POSTGRES_PASSWORD: postgres` | `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` |
| Line 15 — db healthcheck | `pg_isready -U postgres -d guildora` | `pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}` |
| Line 60 — hub DATABASE_URL | `postgresql://postgres:postgres@db:5432/guildora` | `${DATABASE_URL}` |
| Line 69 — hub NUXT_DATABASE_URL | `postgresql://postgres:postgres@db:5432/guildora` | `${DATABASE_URL}` |
| Line 114 — bot DATABASE_URL | `postgresql://postgres:postgres@db:5432/guildora` | `${DATABASE_URL}` |

**Unchanged** (D-01 decision): `POSTGRES_USER: postgres`, `POSTGRES_DB: guildora` — not secrets.

### .env.example — Database section replacement

**Added:** `POSTGRES_PASSWORD=replace_with_strong_db_password` (was missing entirely)

**Updated:** `DATABASE_URL` placeholder now uses `replace_with_strong_db_password` instead of literal `postgres`

**Added:** Production warning: "⚠ MUST change before production — default is insecure"

**Added:** `Production Docker: use db:5432 (internal Docker hostname). Local dev: use localhost:5433.` — addresses RESEARCH.md Pitfall 2

**Removed:** Stale comment claiming `DATABASE_URL` is "ignored by containers" — no longer true after this change

## Verification Results

All acceptance criteria pass:

```
grep "postgres:postgres" docker-compose.yml       → 0 matches  PASS
grep "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"    → 1 match    PASS
grep "DATABASE_URL: ${DATABASE_URL}"              → 2 matches  PASS (hub + bot)
grep "NUXT_DATABASE_URL: ${DATABASE_URL}"         → 1 match    PASS
grep "POSTGRES_USER:-postgres"                    → 1 match    PASS (healthcheck)
grep "POSTGRES_USER: postgres"                    → 1 match    PASS (unchanged)
grep "POSTGRES_DB: guildora"                      → 1 match    PASS (unchanged)
grep "POSTGRES_PASSWORD" .env.example             → 2 matches  PASS
grep "MUST change before production" .env.example → 1 match    PASS
grep "db:5432" .env.example                       → 1 match    PASS
grep "postgres:postgres" .env.example             → 0 matches  PASS
grep "ignored by containers" .env.example         → 0 matches  PASS
```

## Threat Model Coverage

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-04-01-01 | mitigate | DONE — all five `postgres:postgres` occurrences replaced with `${POSTGRES_PASSWORD}` / `${DATABASE_URL}` |
| T-04-01-02 | mitigate | DONE — `.env.example` placeholder updated, production warning added |
| T-04-01-03 | accept | By design — empty POSTGRES_PASSWORD causes visible startup failure (Fail Loud, Never Fake) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `docker-compose.yml` modified: confirmed (commit c396b45)
- `.env.example` modified: confirmed (commit 691e346)
- No `postgres:postgres` in docker-compose.yml: confirmed (0 grep matches)
- `POSTGRES_PASSWORD=replace_with_strong_db_password` in .env.example: confirmed
- `MUST change before production` in .env.example: confirmed
- Both commits exist in git log: confirmed (`git log --oneline -2` shows c396b45 and 691e346)
