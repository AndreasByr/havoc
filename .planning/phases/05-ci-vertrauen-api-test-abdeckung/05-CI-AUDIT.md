# CI Audit — Phase 5 Baseline

**Audited:** 2026-04-18
**Purpose:** Ist-Zustand der CI vor Phase-5-Fixes. Dient als Baseline für CI-01.
**Scope:** `platform/` — alle GitHub Actions Workflows unter `.github/workflows/`

---

## Workflow Inventory

| Workflow | Datei | Trigger | Zweck |
|----------|-------|---------|-------|
| CI | `ci.yml` | push/PR auf main, dev | Basis-Gates: Lint, Typecheck, Build |
| Test | `test.yml` | push/PR auf main, dev | Hub Unit-Tests |
| Release | `release.yml` | push auf `v*`-Tags | Validate + GitHub Release + Docker-Publish |
| Security | `security.yml` | Täglich 04:00 UTC + workflow_dispatch | Scheduled Security Scan (unabhängig) |

---

## `.github/workflows/ci.yml` — Push/PR auf main, dev

| Job | Step | Aktueller Status | Gate? | Anmerkung |
|-----|------|-----------------|-------|-----------|
| `ci` | `pnpm install --frozen-lockfile` | STABLE | Ja — blocking | |
| `ci` | Lint (`pnpm lint`) | FAILING — 257 hub-Errors | **NEIN** — `continue-on-error: true` | Ziel von Phase 5: fixing und blocking machen |
| `ci` | Typecheck (`pnpm typecheck`) | FAILING — `@guildora/matrix-bot` TS2322 | Ja — blocking | Einziger Fehler: `src/index.ts:44` |
| `ci` | Build (`pnpm build`) | UNBEKANNT | Ja — blocking | Nicht auswertbar, da Typecheck davor abbricht |

**Bekannte Fehler:**

1. **Lint** (257 Errors, 75 Warnings in `@guildora/hub`):
   - 149× `@typescript-eslint/no-explicit-any` — Test-Mocks und Prod-Code
   - 51× `@typescript-eslint/no-unused-vars` — Ungenutzte Imports/Variablen
   - 24× `@typescript-eslint/unified-signatures` — Emit-Overloads in Flow-Builder-Komponenten
   - 16× `import/no-duplicates` — Doppelte Import-Statements aus gleichem Modul
   - 5× `@typescript-eslint/no-dynamic-delete` — `delete obj[key]`-Ausdrücke
   - 1× `vue/no-mutating-props` — `SimpleFormField.vue:108`
   - 1× `vue/no-v-text-v-html-on-component` — `LandingPreview.vue:74`
   - `@guildora/web`: 0 Errors, 12 Warnings (exit 0 — schon grün)

2. **Typecheck** (1 Error in `@guildora/matrix-bot`):
   - Datei: `apps/matrix-bot/src/index.ts:44`
   - Fehler: `TS2322 — Type 'string | undefined' is not assignable to type 'string'`
   - Ursache: `BOT_INTERNAL_TOKEN` (Typ `string | undefined` aus `process.env`) wird an `startInternalSyncServer({ token: string })` übergeben. Guard auf Zeilen 21–26 beendet den Prozess bei falsy-Token, aber TypeScript's Narrowing greift nicht über die Funktionsgrenze.
   - Fix: `token: BOT_INTERNAL_TOKEN!` (Non-Null-Assertion nach dem Guard) — 1 Zeile.

---

## `.github/workflows/test.yml` — Push/PR auf main, dev

| Job | Step | Aktueller Status | Gate? | Anmerkung |
|-----|------|-----------------|-------|-----------|
| `hub-unit-tests` | `pnpm --filter @guildora/hub test` | STABLE — 36 Dateien, 291 Tests, ~2s | Ja — blocking | Kein Flaky-Test gefunden |

**Details:**
- Test-Run dauert ~2 Sekunden (deterministisch)
- Kein `it.skip`, kein `xit`, kein `// TODO: flaky` in der gesamten Testsuite
- 36 Spec-Dateien unter `apps/hub/`
- Alle 291 Tests grün (verifiziert 2026-04-18)

---

## `.github/workflows/release.yml` — Push auf `v*`-Tags

| Job | Step | Aktueller Status | Gate? | Anmerkung |
|-----|------|-----------------|-------|-----------|
| `validate` | `pnpm install --frozen-lockfile` | STABLE | Ja | |
| `validate` | Lint (`pnpm lint`) | FAILING | **NEIN** — `continue-on-error: true` | Gleicher Grund wie ci.yml |
| `validate` | Typecheck (`pnpm typecheck`) | FAILING | Ja — blocking | Gleicher matrix-bot TS2322-Fehler |
| `validate` | Build (`pnpm build`) | UNBEKANNT | Ja — blocking | Nicht auswertbar |
| `validate` | Hub-Tests (`pnpm --filter @guildora/hub test`) | STABLE | Ja — blocking | |
| `validate` | Security audit (`pnpm audit --audit-level=high`) | UNBEKANNT | **NEIN** — `continue-on-error: true` | Absichtlich non-blocking (Phase 4 OK) |
| `create-release` | GitHub Release erstellen | — | Braucht `validate` | |
| `docker-publish` | Docker Build + Push (hub, web, bot) | — | Braucht `create-release` | |

---

## `.github/workflows/security.yml` — Täglich 04:00 UTC + manuell

| Job | Step | Aktueller Status | Gate? | Anmerkung |
|-----|------|-----------------|-------|-----------|
| `security-scan` | Claude Code Security Scan (`anthropics/claude-code-base-action@beta`) | INDEPENDENT | Nein | Läuft unabhängig vom Push-CI |
| `security-scan` | `pnpm audit` | Informational | Nein | Teil des Scans |
| Notification | Linear Issue + Discord Alert bei Findings | Conditional | Nein | |

**Benötigte Secrets:** `CLAUDE_CODE_OAUTH_TOKEN`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `DISCORD_SECURITY_WEBHOOK`

---

## Zusammenfassung: Gate-Status

| Gate | Blocking? | Aktuell grün? |
|------|-----------|--------------|
| Lint (ci.yml) | NEIN (`continue-on-error`) | NEIN — 257 Errors |
| Lint (release.yml) | NEIN (`continue-on-error`) | NEIN — 257 Errors |
| Typecheck | JA | NEIN — TS2322 in matrix-bot |
| Build | JA | UNBEKANNT (Typecheck-Fehler vorher) |
| Hub Unit-Tests | JA | JA — 291/291 grün |
| Security Audit | NEIN (`continue-on-error`) | (Phase 4 OK) |
| Scheduled Security Scan | NEIN (unabhängig) | Informational |

---

## Phase-5-Ziele (was sich ändern soll)

1. **Typecheck blocking & grün**: matrix-bot TS2322 fixen → `pnpm typecheck` exit 0
2. **Lint grün**: 257 Hub-Errors fixen → `pnpm --filter @guildora/hub lint` exit 0
3. **ESLint-Security-Plugins**: `eslint-plugin-security` + `eslint-plugin-no-unsanitized` in hub integrieren (D-02)
4. **Lint wieder blocking**: `continue-on-error: true` aus `ci.yml` + `release.yml` entfernen — erst nach Punkt 2+3
5. **API-Test-Abdeckung**: 4 neue Spec-Files für Auth, Mod, Admin-Settings, Community-Settings (QA-01, D-04)

---

*Audit erstellt: 2026-04-18*
*Nächstes Review: nach Phase-5-Abschluss*
