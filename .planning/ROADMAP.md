# Roadmap: Guildora Platform — Stabilisierung

## Overview

Brownfield-Stabilisierung des `platform/`-Repos. Security-first: Ein konsolidiertes Audit legt die Grundlage, bevor die kritischste Lücke (unsandboxed Plugin-Code) geschlossen wird. Danach Auth/Session-Härtung, Supply-Chain/Secrets, CI-Vertrauen, Matrix-Bot-Parity, Preview-Lifecycle, und zum Abschluss Doku-Drift. Jede Phase liefert ein beobachtbares, testbares Ergebnis — "Fail Loud, Never Fake" heißt, Erfolg ist nur gemessen, wenn er greifbar ist.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Audit & Priorisierung** - Konsolidiertes Security-Audit des Platform-Stacks, nach Severity priorisiert, als Grundlage für alle weiteren SEC-Phasen
- [ ] **Phase 2: Apps-Plugin-Sandbox** - Fremd-Code läuft in echter Sandbox mit CPU-/Memory-Limits und Timeouts; einzig kritischste Codepfad-Härtung
- [ ] **Phase 3: Auth- & Session-Härtung** - Timing-sichere Token-Vergleiche, deny-by-default Session-Middleware, OAuth/Cookie/CSRF-Review
- [ ] **Phase 4: Supply-Chain & Secrets** - `docker-compose.yml` env-basiert, `pnpm audit` sauber, `pnpm.overrides` reviewt
- [ ] **Phase 5: CI-Vertrauen & API-Test-Abdeckung** - CI-Ist-Zustand dokumentiert, Typecheck/Lint/Tests blocking und stabil, kritische API-Endpoints getestet
- [ ] **Phase 6: Matrix-Bot-Parity** - Matrix-Bot emittiert App-Hooks analog zum Discord-Bot; State sauber behandelt
- [ ] **Phase 7: Preview-Lifecycle & Tunnel-Resilienz** - Preview-Start/Stop/Restart als ein Skill; Cloudflare-Tunnel überlebt Restarts
- [ ] **Phase 8: Dokumentations-Konsolidierung** - Doku-Drift für von diesem Projekt berührte Bereiche geschlossen

## Phase Details

### Phase 1: Security Audit & Priorisierung
**Goal**: Vollständiges, schriftliches Security-Audit des `platform/`-Stacks existiert und ist nach Severity sortiert, sodass alle weiteren SEC-Phasen (2–4) gegen einen objektiven, priorisierten Befund arbeiten statt gegen Bauchgefühl.
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. `.planning/codebase/CONCERNS.md` (oder ein benanntes Nachfolge-Dokument in `.planning/research/`) enthält Andis bisher nur "im-Kopf" existierende Security-Reviews, schriftlich, mit Datumsstempel
  2. Jedes Finding ist mit Severity (Critical/High/Medium/Low), Datei-Pfad und Fix-Ansatz versehen
  3. Die Findings sind nach Severity sortiert und die Phasen 2–4 lassen sich eindeutig auf Gruppen von Findings abbilden (keine offenen Critical/High-Findings ohne zugeordnete Folge-Phase)
  4. Das Audit nennt explizit, welche bekannten Risiken bewusst NICHT in dieser Milestone gefixt werden (mit Begründung → v2)
**Plans**: 5 plans
- [x] 01-01-PLAN.md — Audit-Doc-Skelett + ripgrep-Sanity + scratch-Dir (Wave 1)
- [x] 01-02-PLAN.md — 5 ripgrep-Pattern-Scans (P-1..P-5) in scratch/grep-results.md (Wave 2, parallel zu Wave 3)
- [x] 01-03-PLAN.md — Kopf-Review mit Andi: 8 Bereiche, 27 Fragen, 3-Bucket-Zuordnung (Wave 3, human-in-loop)
- [x] 01-04-PLAN.md — Finding-Consolidation: 15-25 F-Findings + Operational + Deferred in §§4-9 (Wave 4)
- [x] 01-05-PLAN.md — Exec-Summary + Traceability + validation.sh + SEC-01 Done-Flip + git-Tag (Wave 5)

### Phase 2: Apps-Plugin-Sandbox
**Goal**: App-Plugin-Execution-Sites sind gegen reale Risiken (hängende async Handlers, unkontrolliertes Memory-Wachstum) gehärtet; alle Lifecycle-Events sind audit-logbar. Die kritischste bekannte Lücke (kein Execution-Timeout) ist geschlossen.
**Depends on**: Phase 1
**Requirements**: SEC-02
**Success Criteria** (what must be TRUE):
  1. Ein langsamer/hängender async App-Hook wird nach APP_HOOK_TIMEOUT_MS (default 5000 ms) abgebrochen — verifiziert durch dedizierte Spec-Tests in bot und hub
  2. CPU-/Execution-Timeout ist konfigurierbar via `APP_HOOK_TIMEOUT_MS` env var; Überschreitung führt zu einem sichtbaren Fehler (Fail Loud: hook.timeout / route.timeout geloggt, HTTP 504 zurückgegeben)
  3. Memory-Cap via `--max-old-space-size` ist in beiden App-Prozessen (bot: 512 MB, hub: 1024 MB) in Startup-Scripts dokumentiert und konfiguriert
  4. Beide Execution-Sites — `app-hooks.ts` und `[...path].ts` — verwenden denselben Promise.race()-Mechanismus mit identischem Log-Format (`{ appId, event, durationMs?, error? }`)
  5. App-Install/Uninstall-Lifecycle ist in strukturierten Audit-Logs (`app.installed`, `app.uninstalled`) sichtbar — verifiziert durch Hub-Spec-Tests
**Plans**: 4 plans
- [x] 02-01-PLAN.md — Bot execution site: Promise.race() timeout + structured logger in app-hooks.ts + 3 new spec tests (Wave 1)
- [x] 02-02-PLAN.md — Hub execution site: Promise.race() timeout + console.log(JSON) in [...path].ts + new path.spec.ts (Wave 1)
- [x] 02-03-PLAN.md — Audit-log: app.installed/uninstalled in 3 admin routes + new audit-log.spec.ts (Wave 1)
- [x] 02-04-PLAN.md — Memory-cap: --max-old-space-size flags in bot/hub startup scripts + .env.example docs (Wave 1)

### Phase 3: Auth- & Session-Härtung
**Goal**: Die Authentifizierungs- und Session-Schicht im Hub ist deny-by-default, timing-sicher und gegen gängige Angriffsklassen (CSRF, Session-Fixation, Timing-Attacks) gehärtet.
**Depends on**: Phase 1
**Requirements**: SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. `grep`-bar: Alle Token-Vergleiche in `platform/apps/hub/server/` und `platform/apps/bot/src/` verwenden `crypto.timingSafeEqual` — keine Treffer mehr für `token !== expectedToken` / `token === expectedToken` oder vergleichbare String-Equality auf Secrets (ein Unit-Test oder Lint-Regel verhindert Regression)
  2. Eine neue, in diesem Projekt hinzugefügte API-Route ohne expliziten Public-Marker wird von der Session-Middleware geblockt — verifiziert durch einen Integration-Test, der eine Dummy-Route unter `/api/` trifft und 401 erhält, ohne dass die Route selbst `requireSession()` aufruft
  3. Die Menge öffentlicher Routen (`/api/public/*`, `/api/auth/*`, `/api/theme.get`, `/api/setup/*`) ist explizit als Allow-List im Code deklariert und dokumentiert; alles andere ist auth-required by default
  4. Session-Cookies haben HttpOnly, Secure (in Production), und SameSite gesetzt; Session-ID rotiert nach erfolgreichem Login; CSRF-Schutz (`02-csrf-check.ts`) deckt alle zustandsändernden Routen ab — verifiziert durch einen Review-Abschnitt in `docs/` oder einer `.planning/research/`-Notiz mit Datei-Referenzen
**Plans**: 4 plans
- [x] 03-01-PLAN.md — Timing-safe token comparisons: internal-auth.ts (F-03) + matrix-bot (F-04) + tests (Wave 1)
- [ ] 03-02-PLAN.md — deny-by-default session middleware: 03-session.ts PUBLIC_PATHS + locale-context guard (F-02) + tests (Wave 1)
- [x] 03-03-PLAN.md — Dev endpoint guards (F-07) + Cookie Secure NODE_ENV fix (F-10) (Wave 2)
- [x] 03-04-PLAN.md — CSRF comment (F-17) + session-rotation verification test (F-09) (Wave 2)

### Phase 4: Supply-Chain & Secrets
**Goal**: Infrastruktur-Konfiguration und Dependencies haben keine bekannten, unbehandelten Risiken: keine hartkodierten Credentials im Compose-File, kein offener `pnpm audit`, Overrides sind absichtlich.
**Depends on**: Phase 1
**Requirements**: SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. `platform/docker-compose.yml` enthält weder `POSTGRES_PASSWORD: postgres` noch `postgres:postgres` in Connection-Strings — alle DB-Credentials kommen aus env-Variablen, konsistent mit dem Umgang anderer Secrets im File; `platform/.env.example` dokumentiert die neuen Variablen
  2. `cd platform && pnpm audit --prod` meldet keine offenen High/Critical-Findings (oder: jedes verbleibende Finding ist in `.planning/research/` mit Begründung als akzeptiert dokumentiert)
  3. Jeder der aktuell 12 Einträge in `platform/package.json` `pnpm.overrides` ist in einem Review-Dokument begründet; Overrides, deren Upstream inzwischen nachgezogen hat, sind entfernt
  4. Ein Bot/Hub-Start mit dem neuen env-basierten Compose-Setup funktioniert lokal — dokumentiert durch einen erfolgreichen Start-Log-Snippet im PR oder im Phase-Summary
**Plans**: TBD

### Phase 5: CI-Vertrauen & API-Test-Abdeckung
**Goal**: CI ist vertrauenswürdig genug, dass ein grüner Build etwas bedeutet: Typecheck grün, Lint blocking, Tests deterministisch — und die kritischsten API-Endpoints haben dedizierte Tests.
**Depends on**: Phase 3 (Auth-Änderungen müssen CI-grün sein, bevor wir CI härter machen)
**Requirements**: CI-01, CI-02, QA-01
**Success Criteria** (what must be TRUE):
  1. Ein `.planning/research/`- oder `docs/`-Dokument listet alle aktiven CI-Workflows mit Status pro Job: stable / flaky / slow / skipped — damit der Ist-Zustand objektiv sichtbar ist
  2. Lint ist in CI wieder blocking (nicht `continue-on-error: true`); alle vorher bestehenden Lint-Fehler im `platform/`-Tree sind entweder gefixt oder per gezielter Disable-Kommentar mit Begründung unterdrückt
  3. `vue-tsc`-Typecheck läuft in CI und ist grün über mindestens 3 aufeinanderfolgende Haupt-Branch-Commits; Flaky-Tests haben entweder einen Fix oder ein `// TODO: flaky` mit Ticket-/Todo-Referenz
  4. Eine benannte, priorisierte Liste von Admin-/Moderation-/Auth-/Apps-API-Routen unter `platform/apps/hub/server/api/` ist in Phase-Planning festgelegt, und jede Route auf der Liste hat einen Spec-File unter `__tests__/` — die Liste selbst wird als abgeschlossen markiert (nicht Coverage-Prozent)
**Plans**: TBD
**UI hint**: yes

### Phase 6: Matrix-Bot-Parity
**Goal**: Der Matrix-Bot ist kein "halb da" mehr — er emittiert App-Hooks analog zum Discord-Bot und sein State liegt ordentlich, nicht als untrackte Datei im Working-Tree.
**Depends on**: Phase 2 (Hook-Emission läuft durch die neue Sandbox)
**Requirements**: BOT-01, BOT-02
**Success Criteria** (what must be TRUE):
  1. `platform/apps/matrix-bot/src/events/roomMessage.ts` und `roomMember.ts` emittieren App-Hooks über denselben Pfad wie `platform/apps/bot/src/events/messageCreate.ts`; die bisherigen `TODO`-Kommentare sind entfernt (grep-check)
  2. Eine installierte Test-App, die auf `message`- und `member`-Events registriert, wird von einem Matrix-Event genauso aufgerufen wie von einem Discord-Event — verifiziert durch Unit/Integration-Test in `apps/matrix-bot/src/__tests__/`
  3. Matrix-Bot-State hat einen dokumentierten Ort und Format; `matrix-bot-state.json` ist entweder via `.gitignore` sauber exkludiert oder in einen klar benannten State-Pfad umgezogen — `git status` zeigt keine untrackte `matrix-bot-state.json` mehr im Working-Tree nach einem Bot-Start
  4. Der Hub↔Bot Internal-Sync-Contract ist ungebrochen: alle bestehenden internal-sync-server Tests (Discord + Matrix) bleiben grün
**Plans**: TBD

### Phase 7: Preview-Lifecycle & Tunnel-Resilienz
**Goal**: Preview-Server und Cloudflare-Tunnel verhalten sich deterministisch über Restarts hinweg, sodass Andi/Alice die Preview-URLs ohne manuellen Eingriff zeigen kann.
**Depends on**: Phase 5 (Preview-Builds laufen durch die stabilisierte CI)
**Requirements**: PREV-01, PREV-02
**Success Criteria** (what must be TRUE):
  1. Ein einziges Script/Skill (z.B. `platform/scripts/preview.sh` oder ein Alice-Skill) bietet `start`, `stop`, `restart` für Web/Hub/Marketplace-Preview; zweistufige Orchestrierung (`nuxt build` → `NITRO_PORT=... node .output/server/index.mjs`) ist darin gekapselt
  2. Ein absichtlicher Preview-Kill (`kill -9` auf Preview-Prozess) lässt sich via `restart` innerhalb < 30s wiederherstellen, ohne dass der Cloudflare-Tunnel manuell angefasst werden muss
  3. Die URLs `https://guildora-web.myweby.org`, `https://guildora-hub.myweby.org`, `https://guildora-bot.myweby.org` sind nach einem simulierten Container-/Preview-Restart in unter 60s wieder erreichbar — dokumentiert durch einen Before/After-Curl-Check im Phase-Summary
  4. Tunnel-Health ist beobachtbar: es existiert ein dokumentierter Health-Check-Pfad (Curl-Command oder Endpoint), der zeigt, ob der Tunnel-zu-Preview-Pfad lebt
**Plans**: TBD

### Phase 8: Dokumentations-Konsolidierung
**Goal**: Die Dokumentation spiegelt nach Abschluss der Stabilisierung wider, was der Code tatsächlich tut — keine Doku-Drift für die von diesem Projekt berührten Bereiche mehr.
**Depends on**: Phase 7 (alle Code-Änderungen stehen, bevor Doku gezogen wird)
**Requirements**: DOC-01
**Success Criteria** (what must be TRUE):
  1. `platform/docs/` (bzw. die zentrale Doku-Quelle), Haupt-`README.md` von `platform/` und den in diesem Projekt berührten Apps, und projektlokale `AGENTS.md`/`DESIGN_SYSTEM.md` sind reviewt und auf den Ist-Stand der Phasen 1–7 gebracht
  2. Sandbox-Mechanismus (Phase 2), Auth-/Session-Regeln (Phase 3), neues Compose-Env-Schema (Phase 4), CI-Gates (Phase 5), Matrix-Hook-Pattern (Phase 6) und Preview-Lifecycle (Phase 7) sind jeweils an genau einer auffindbaren Stelle dokumentiert — kein widersprüchlicher Zweit-Fundort
  3. Veraltete Aussagen zu Apps-Execution, Token-Vergleichen, DB-Credentials, Matrix-Bot-Stand, und Preview-Start sind aus der Doku entfernt oder korrigiert (grep-Pass auf die alten Begriffe + manueller Review)
  4. Ein Changelog-Eintrag oder Milestone-Notiz fasst zusammen, was in dieser Stabilisierungs-Milestone geändert wurde — damit Zukunfts-Andi in drei Monaten weiß, warum `docker-compose.yml` anders aussieht
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Audit & Priorisierung | 5/5 | Complete | 2026-04-17 |
| 2. Apps-Plugin-Sandbox | 0/4 | Not started | - |
| 3. Auth- & Session-Härtung | 0/4 | Not started | - |
| 4. Supply-Chain & Secrets | 0/TBD | Not started | - |
| 5. CI-Vertrauen & API-Test-Abdeckung | 0/TBD | Not started | - |
| 6. Matrix-Bot-Parity | 0/TBD | Not started | - |
| 7. Preview-Lifecycle & Tunnel-Resilienz | 0/TBD | Not started | - |
| 8. Dokumentations-Konsolidierung | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-16*
*Last updated: 2026-04-17 after Phase 3 planning*
