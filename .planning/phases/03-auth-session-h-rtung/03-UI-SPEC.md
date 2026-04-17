---
phase: 3
slug: auth-session-haertung
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-17
backend_only: true
---

# Phase 3 — UI Design Contract

> This phase contains NO frontend or UI changes. All work is confined to server-side
> security hardening. This document exists to satisfy the UI gate so planning can proceed.

---

## Determination: Backend-Only Phase

**Finding:** After reading `03-CONTEXT.md` in full, this phase has zero frontend scope.

**All 9 files being changed are server-side:**

| File | Change | Finding |
|------|--------|---------|
| `platform/apps/hub/server/middleware/03-session.ts` | deny-by-default + PUBLIC_PATHS constant | F-02 |
| `platform/apps/hub/server/utils/internal-auth.ts` | timing-safe token comparison | F-03 |
| `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` | timing-safe token comparison | F-04 |
| `platform/apps/hub/server/api/dev/switch-user.post.ts` | import.meta.dev guard | F-07 |
| `platform/apps/hub/server/api/dev/restore-user.post.ts` | import.meta.dev guard | F-07 |
| `platform/apps/hub/server/api/dev/users.get.ts` | import.meta.dev guard | F-07 |
| `platform/apps/hub/nuxt.config.ts` | Cookie Secure flag via NODE_ENV | F-10 |
| `platform/apps/hub/server/middleware/02-csrf-check.ts` | Explanatory comment only | F-17 |
| `platform/apps/hub/server/api/internal/locale-context.get.ts` | requireSession() added | F-02 delta |

**Why the UI gate triggered:** The orchestrator performs keyword-based phase detection.
Phase 3 contains terms like "middleware", "session", "auth", "cookie" — all of which are
also relevant to frontend UI work. This is a false-positive. None of these changes affect
any Vue component, page, layout, composable, or user-visible interaction.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | N/A — backend-only phase |
| Preset | not applicable |
| Component library | not applicable |
| Icon library | not applicable |
| Font | not applicable |

---

## Spacing Scale

N/A — backend-only phase. No layout or visual spacing changes in scope.

---

## Typography

N/A — backend-only phase. No text rendering changes in scope.

---

## Color

N/A — backend-only phase. No color changes in scope.

---

## Copywriting Contract

N/A — backend-only phase. No user-facing copy changes in scope.

The only "copy" changes are:

| Location | Change |
|----------|--------|
| `02-csrf-check.ts:15` | Code comment (not user-visible) explaining SSR-internal request CSRF skip |

---

## Registry Safety

N/A — no new npm dependencies, no shadcn components, no third-party registries.

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable |

---

## Checker Sign-Off

All 6 dimensions are not applicable for this backend-only phase. The UI gate is satisfied
by this documented determination.

- [x] Dimension 1 Copywriting: N/A — backend-only
- [x] Dimension 2 Visuals: N/A — backend-only
- [x] Dimension 3 Color: N/A — backend-only
- [x] Dimension 4 Typography: N/A — backend-only
- [x] Dimension 5 Spacing: N/A — backend-only
- [x] Dimension 6 Registry Safety: N/A — no new dependencies

**Approval:** approved 2026-04-17 (auto-approved, no UI surface to review)
