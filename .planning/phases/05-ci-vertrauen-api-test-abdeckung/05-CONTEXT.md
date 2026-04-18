# Phase 5: CI-Vertrauen & API-Test-Abdeckung - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

CI ist vertrauenswürdig genug, dass ein grüner Build etwas bedeutet: Lint ist wieder blocking (nicht `continue-on-error`), Typecheck läuft stabil, Tests sind deterministisch — und die kritischsten API-Endpoints haben dedizierte Spec-Tests.

Scope ist ausschließlich `platform/`. CI-Test-Scope bleibt auf `@guildora/hub` fokussiert.

</domain>

<decisions>
## Implementation Decisions

### Lint-Strategie

- **D-01:** Alle bestehenden Lint-Fehler im `platform/`-Tree werden **gefixed** (nicht per eslint-disable unterdrückt). Danach wird `continue-on-error: true` aus `ci.yml` und `release.yml` entfernt — Lint ist wieder blocking.
- **D-02:** ESLint-Security-Plugins **beide integrieren**: `eslint-plugin-security` + `eslint-plugin-no-unsanitized`. Diese wurden in Phase 1 explizit auf Phase 5 verschoben.
- **D-03:** Falls die Security-Plugins neue Findings produzieren, die kurzfristig nicht fixbar sind: **gezielte `// eslint-disable-next-line ... -- reason`-Kommentare** pro Zeile. Kein warn-only-Modus — Lint bleibt blocking auch für Security-Plugin-Regeln.

### API-Test-Priorisierung

- **D-04:** Folgende Route-Gruppen kommen auf die priorisierte Test-Liste (alle vier):
  - **Auth + CSRF**: Login/Logout, CSRF-Token, Session-Endpoints
  - **Admin**: admin/apps, admin/users, admin/platforms, admin/operations (bestehende Lücken schließen)
  - **Mod**: `/api/mod/*` — Moderations-Aktionen mit Rollen-Check (derzeit keine Spec-Files)
  - **Community-Settings + Apps-API**: community-settings (PUT/GET), Apps-Execution-Endpoint
- **D-05:** Test-Tiefe: **Auth-Check + Happy-Path** pro Route. Konkret: 401 ohne Session, 403 bei falscher Rolle, 200/201 mit korrekter Session. Kein vollständiger Error-Case-Sweep (zu aufwändig für diese Phase).
- **D-06:** Die Liste wird als benannte, priorisierte Aufzählung im Phase-Planning festgelegt. Success = jede Route auf der Liste hat einen Spec-File — kein Coverage-Prozent-Ziel.

### CI-Test-Scope

- **D-07:** CI-Test-Scope bleibt **nur `@guildora/hub`**. Bot-, Matrix-Bot- und Shared-Tests laufen weiterhin nur lokal. Engerer Scope = schnellere Builds, weniger Fläche für CI-Instabilität.

### Typecheck-Stabilität

- **D-08:** Typecheck-Status ist aktuell unklar. Das **CI-Audit-Dokument** (Success Criteria 1 der Phase) klärt den Ist-Stand als allererstes: stable / flaky / slow / skipped pro Job.
- **D-09:** Flaky Tests: **Fix oder `// TODO: flaky — <reason>`** mit Todo-Referenz. Kein stilles Ignorieren, kein `it.skip` ohne Kommentar.
- **D-10:** "3 aufeinanderfolgende Commits" aus den Success Criteria ist ein Verifikations-Hinweis für den Planner — kein aktiver Mechanismus, sondern eine Stabilitäts-Beobachtung die im CI-Dokument festgehalten wird.

### Claude's Discretion

- Reihenfolge der Plan-Waves (Audit-Dokument zuerst vs. Lint-Fix zuerst) — Planner entscheidet nach Abhängigkeiten.
- Genaue Zuordnung von Routen zu Spec-Files (ob bestehende erweitert oder neue angelegt werden) — Planner entscheidet nach Codestruktur.
- Ob F-13 Auth-Rate-Limit (deferred von Phase 3) in Phase 5 als separater Plan aufgenommen wird — Planner bewertet Aufwand.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CI-Workflows

- `.github/workflows/ci.yml` — Aktueller Stand: Lint `continue-on-error: true`, Typecheck + Build blocking
- `.github/workflows/test.yml` — Nur `@guildora/hub` Unit-Tests, kein Bot/Shared
- `.github/workflows/release.yml` — Lint + Typecheck + Build + Hub-Tests + Security-Audit (alle non-blocking für Lint/Security)
- `.github/workflows/security.yml` — Scheduled Daily-Scan (unabhängig vom Push-CI)

### Bestehende Test-Infrastruktur

- `apps/hub/server/api/__tests__/` — Vorhandene Spec-Files: admin-operations, admin-apps, application-flow, admin-users, admin-platforms, member-profile
- `apps/hub/server/api/dev/__tests__/dev-endpoints.spec.ts` — Dev-Endpoint-Tests
- `apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts` — Audit-Log-Tests
- `apps/hub/server/api/apps/__tests__/path.spec.ts` — Apps-Execution-Endpoint
- `apps/hub/server/utils/__tests__/test-helpers.ts` — Test-Utilities (Session-Mocking etc.)

### ESLint-Konfiguration

- `apps/web/eslint.config.mjs` — Web ESLint-Config
- `apps/hub/eslint.config.mjs` — Hub ESLint-Config (Haupt-Target für Security-Plugin-Integration)

### Deferred Findings (von früheren Phasen)

- Phase 1 Entscheidungs-Log: ESLint-Security-Plugins verschoben auf Phase 5 (`D-12` in Phase-1-CONTEXT.md)
- Phase 3 Entscheidungs-Log: F-13 Auth-Rate-Limit verschoben auf Phase 5

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/hub/server/utils/__tests__/test-helpers.ts` — Session-Mock-Helpers; können für alle neuen Auth-Check-Tests direkt wiederverwendet werden
- Bestehende Spec-Files unter `apps/hub/server/api/__tests__/` — Pattern für Auth-Check (401/403) ist bereits etabliert, neue Tests können es kopieren
- `turbo.json` — Turborepo-Pipeline; `test`-Script ist bereits konfiguriert

### Established Patterns

- Test-Pattern: `vi.stubGlobal()` für Nuxt-Auto-Imports; `requireSession` / `requireAdminSession` via Mocks
- API-Routes: `community-settings.get.ts` / `community-settings.put.ts` als Beispiel für Route-Dateistruktur
- Lint: `@nuxt/eslint` via `eslint.config.mjs` in hub und web

### Integration Points

- CI-Workflows in `.github/workflows/` — `ci.yml` und `release.yml` müssen beide angefasst werden (beide haben Lint non-blocking)
- `pnpm lint` in root `package.json` — steuert, welche Pakete gelinted werden
- ESLint-Plugin-Installation via `pnpm add -D` im jeweiligen App-Paket oder root

</code_context>

<specifics>
## Specific Ideas

- Das CI-Audit-Dokument (Success Criteria 1) landet in `.planning/research/` oder `docs/` — Planner entscheidet wo; es dient als objektiver Ist-Stand-Snapshot.
- Die priorisierte API-Test-Liste wird als Teil des Phase-Planning explizit benannt (nicht erst im Executor entschieden).

</specifics>

<deferred>
## Deferred Ideas

- Vollständiger Error-Case-Sweep für API-Tests (400, 404, 422) — zu aufwändig für Phase 5; Phase 8 oder eigene Initiative
- Bot-, Matrix-Bot- und Shared-Package-Tests in CI — bewusst aus Scope genommen; spätere Entscheidung
- ESLint-Regeln für weitere Pakete (marketplace, bot) — nur hub/web in Phase 5

</deferred>

---

*Phase: 05-ci-vertrauen-api-test-abdeckung*
*Context gathered: 2026-04-18*
