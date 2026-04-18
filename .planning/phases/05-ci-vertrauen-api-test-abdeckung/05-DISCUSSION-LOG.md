# Phase 5: CI-Vertrauen & API-Test-Abdeckung - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 05-ci-vertrauen-api-test-abdeckung
**Areas discussed:** Lint-Strategie, API-Test-Priorisierung, CI-Test-Scope, Typecheck-Stabilität

---

## Lint-Strategie

| Option | Description | Selected |
|--------|-------------|----------|
| Alle fixen | Alle bestehenden Lint-Fehler reparieren, dann `continue-on-error` entfernen | ✓ |
| Gezielte eslint-disable | Schwierige Fälle unterdrücken, Rest fixen | |
| Du entscheidest | Planner wählt je nach Fehlerzahl | |

**User's choice:** Alle fixen

---

## ESLint-Security-Plugins

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, beide rein | `eslint-plugin-security` + `eslint-plugin-no-unsanitized` | ✓ |
| Nur no-unsanitized | Nur XSS-relevantes Plugin | |
| Keine | Scope bleibt auf CI-Stabilität | |

**User's choice:** Beide integrieren (deferred von Phase 1)

---

## Fallback bei Security-Plugin-Findings

| Option | Description | Selected |
|--------|-------------|----------|
| Gezielte Disables mit Begründung | `eslint-disable-next-line` pro Zeile mit reason | ✓ |
| Plugin warn-only starten | Erst warn, später error | |
| Blocking nur für Core, Security warn | Getrennte Severity | |

**User's choice:** Gezielte Disables — Lint bleibt blocking

---

## API-Test-Priorisierung — Route-Gruppen

| Option | Description | Selected |
|--------|-------------|----------|
| Auth + CSRF | Login/Logout, CSRF-Token, Session | ✓ |
| Admin | admin/apps, admin/users, admin/platforms, admin/operations | ✓ |
| Mod-Endpoints | /api/mod/* | ✓ |
| Community-Settings + Apps-API | community-settings, apps-execution | ✓ |

**User's choice:** Alle vier Gruppen

---

## Test-Tiefe

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-Check + Happy-Path | 401/403/200 | ✓ |
| Auch Error-Cases | Zusätzlich 400/404 | |
| Nur Auth-Check | Nur 401/403 | |

**User's choice:** Auth-Check + Happy-Path

---

## CI-Test-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bot-Tests | @guildora/bot in CI | — (Vertipper, revidiert) |
| Matrix-Bot-Tests | matrix-bot in CI | — (Vertipper, revidiert) |
| Shared-Package-Tests | @guildora/shared in CI | — (Vertipper, revidiert) |
| Hub bleibt allein | Nur @guildora/hub | ✓ |

**Notes:** User wählte zunächst alle Optionen (inkl. das sich ausschließende "Hub bleibt allein"). Nachfrage ergab: nur Hub in CI. Bot/Shared/Matrix-Bot bleiben local-only.

---

## Typecheck-Status

| Option | Description | Selected |
|--------|-------------|----------|
| Grün, soweit ich weiß | Kein bekannter Fehler | |
| Es gibt Fehler | Typecheck-Fehler vorhanden | |
| Nicht sicher | CI-Audit klärt als erstes | ✓ |

**User's choice:** Nicht sicher — CI-Audit-Dokument klärt den Ist-Stand

---

## Flaky-Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Fix oder TODO-Kommentar | Fix oder `// TODO: flaky — reason` | ✓ |
| Skip mit Begründung | `it.skip` + Kommentar | |
| Vorerst ignorieren | Nur dokumentieren | |

**User's choice:** Fix oder TODO-Kommentar

---

## Claude's Discretion

- Wave-Reihenfolge im Plan (Audit-Dokument vs. Lint-Fix zuerst)
- Genaue Zuordnung Routen → Spec-Files
- F-13 Auth-Rate-Limit (deferred von Phase 3) — ob in Phase 5 aufgenommen wird

## Deferred Ideas

- Vollständiger Error-Case-Sweep für API-Tests
- Bot/Shared/Matrix-Bot in CI
- ESLint für marketplace/bot-Pakete
