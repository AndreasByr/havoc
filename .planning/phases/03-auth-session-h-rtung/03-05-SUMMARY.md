---
phase: 03-auth-session-h-rtung
plan: "05"
subsystem: matrix-bot
tags: [security, auth, fail-loud, CR-01, SEC-03]
dependency_graph:
  requires: ["03-01", "03-02", "03-03", "03-04"]
  provides: ["matrix-bot-auth-hardened", "CR-01-closed"]
  affects: ["apps/matrix-bot/src/utils/internal-sync-server.ts"]
tech_stack:
  added: []
  patterns: ["fail-loud 503 before routing when token unconfigured", "unconditional timingSafeEqualString auth check"]
key_files:
  modified:
    - apps/matrix-bot/src/utils/internal-sync-server.ts
    - apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts
decisions:
  - "Mirror Hub's requireInternalToken pattern exactly: 503 MISCONFIGURED when token empty, then unconditional 401 check"
  - "Add fetchPort() helper to spec to support multi-server tests without changing existing fetch() wrapper"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 03 Plan 05: Matrix-Bot Auth Bypass Gap Closure Summary

**One-liner:** Replaced conditional auth bypass (`if (token && token.length > 0)`) with fail-loud 503 MISCONFIGURED guard in matrix-bot's internal HTTP server, closing CR-01.

## What Was Changed and Why

**CR-01 (from 03-VERIFICATION.md):** The Matrix-Bot's internal HTTP server wrapped its entire auth check in `if (token && token.length > 0)`, meaning an empty `BOT_INTERNAL_TOKEN` caused the auth block to be skipped entirely — every request was accepted without any authentication.

This violated the project's core security constraint: **"Fail Loud, Never Fake"** (SEC-03).

The Hub's equivalent (`requireInternalToken` in `internal-auth.ts`) correctly throws 503 when the token is unconfigured. The Matrix-Bot now mirrors this behavior.

## Pattern Replaced

**Before (broken — auth skipped when token is empty):**

```typescript
if (token && token.length > 0) {
  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ") ||
    !timingSafeEqualString(authHeader.slice("Bearer ".length), token)
  ) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
    return;
  }
}
```

**After (fixed — fail-loud before any routing):**

```typescript
if (!token || token.length === 0) {
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Server misconfigured: internal token not set",
      errorCode: "MISCONFIGURED"
    })
  );
  return;
}
const authHeader = req.headers.authorization;
if (
  !authHeader ||
  !authHeader.startsWith("Bearer ") ||
  !timingSafeEqualString(authHeader.slice("Bearer ".length), token)
) {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
  return;
}
```

The `timingSafeEqualString` helper was not modified (still 2 references: definition + call site).

## Test Count

- **Before:** 10 tests in `internal-sync-server.spec.ts`
- **After:** 12 tests in `internal-sync-server.spec.ts` (+2 new MISCONFIGURED tests)

New tests added in `describe("internal sync server — misconfigured (empty token)")`:
1. `returns 503 MISCONFIGURED when server token is not configured` — sends bearer token to empty-token server, expects 503
2. `returns 503 MISCONFIGURED even with no authorization header` — sends empty token, expects 503 (not 401)

Also added `fetchPort()` helper to support testing multiple server instances at different ports within a single spec file.

## Test Results

All 12 tests pass:

```
✓ src/__tests__/internal-sync-server.spec.ts (12 tests) 47ms
Test Files  1 passed (1)
     Tests  12 passed (12)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `4f1eab0` | `fix(03-05): replace silent auth bypass with fail-loud 503 guard` |
| Task 2 | `438c35e` | `test(03-05): add 503 MISCONFIGURED tests for matrix-bot empty-token guard` |

## Gap Closure

- **CR-01 from 03-VERIFICATION.md:** CLOSED
- **SEC-03 requirement:** SATISFIED
- **Phase 3 Truth #4 (session/cookie/auth hardening):** Fully verified, no remaining gaps

## Deviations from Plan

The spec file in the worktree had already been partially updated (the extra `POST /internal/sync-user` power-level failure test was present, giving 10 tests not 9). The plan expected 9 existing tests; the actual count was 10. The final count of 12 (not 11) reflects this pre-existing addition. No plan logic was affected — all new tests were added as specified.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The change is purely a guard replacement within an existing HTTP server handler — it reduces the attack surface by closing the unconfigured-token bypass path.

## Self-Check

- [x] `apps/matrix-bot/src/utils/internal-sync-server.ts` modified — fail-loud guard present
- [x] `apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts` modified — 2 new 503 tests present
- [x] Commit `4f1eab0` exists (Task 1)
- [x] Commit `438c35e` exists (Task 2)
- [x] All 12 matrix-bot tests pass

## Self-Check: PASSED
