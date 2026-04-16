# Requirements: Guildora Platform — Stabilisierung

**Defined:** 2026-04-16
**Core Value:** Die Platform läuft sicher und stabil genug, dass Andi sie ohne Bauchschmerzen weiterbauen, zeigen und produktiv betreiben kann.

## v1 Requirements

Requirements für diese Stabilisierungs-Milestone. Jedes mappt später auf genau eine Roadmap-Phase. Reihenfolge innerhalb der Kategorien spiegelt grobe Priorität.

### Security

- [ ] **SEC-01**: Ein konsolidiertes Security-Audit des `platform/`-Stacks existiert und ist nach Severity priorisiert; die „im-Kopf"-Reviews von Andi sind in `.planning/research/` oder ergänzend in `CONCERNS.md` schriftlich verfügbar (Grundlage für alle weiteren SEC-*-Requirements)
- [ ] **SEC-02**: Apps-Plugin-Code (sideloaded + marketplace) läuft in echter Sandbox mit CPU-Limit, Memory-Limit und Execution-Timeout; Zugriff auf Prozess/FS/DB nur über explizit gewhitelistete APIs (`platform/apps/bot/src/utils/app-hooks.ts`, `platform/apps/hub/server/api/apps/[...path].ts`)
- [ ] **SEC-03**: Alle internen Token-Vergleiche im Hub und in Bots verwenden `crypto.timingSafeEqual` (heute inkonsistent: `platform/apps/hub/server/utils/internal-auth.ts` vs. `platform/apps/bot/src/utils/internal-sync-server.ts`)
- [ ] **SEC-04**: Session-Middleware `platform/apps/hub/server/middleware/03-session.ts` blockt unauthentifizierte Requests deny-by-default; öffentliche Routen sind explizit markiert, nicht per Default offen
- [ ] **SEC-05**: Auth/OAuth-Flow-Härtung ist reviewt: Cookie-Flags (HttpOnly, Secure, SameSite), CSRF-Schutz, Session-Rotation nach Login, `nuxt-auth-utils`-Config entsprechen Best-Practice und sind dokumentiert
- [ ] **SEC-06**: `platform/docker-compose.yml` verwendet keine hartcodierten DB-Credentials mehr; DB-Passwort kommt aus env-Variablen wie die übrigen Secrets
- [ ] **SEC-07**: `pnpm audit` gegen `platform/` ist sauber (keine offenen High/Critical); die 12 `pnpm.overrides` in `platform/package.json` sind reviewt und nur noch dort, wo upstream nicht nachgezogen hat

### CI / Qualität

- [ ] **CI-01**: Ist-Zustand der CI ist dokumentiert: welche Workflows laufen, welche Jobs sind stabil/flaky/slow/kaputt, welche Gates sind wirklich durchgesetzt vs. non-blocking
- [ ] **CI-02**: CI ist vertrauenswürdig: Typecheck (`vue-tsc`) grün und stabil, Lint wieder blocking (Lint-Debt aufgelöst), Tests deterministisch, keine bekannten Flaky-Specs ohne `// TODO`-Verweis
- [ ] **QA-01**: Kritische API-Endpoints unter `platform/apps/hub/server/api/` (Admin, Moderation, Auth, Apps) haben Unit/Integration-Tests — Messgröße: Liste der priorisierten Routen ist abgearbeitet, nicht prozentuale Coverage

### Bots

- [ ] **BOT-01**: Matrix-Bot emittiert App-Hooks für `roomMessage` und `roomMember` analog zum Discord-Bot-Pattern (`platform/apps/bot/src/events/messageCreate.ts`) — heute stehen dort nur TODOs
- [ ] **BOT-02**: Matrix-Bot-State wird sauber behandelt: keine untrackten `matrix-bot-state.json`-Drift-Dateien im Arbeitsverzeichnis; State-Ort, -Format und -Gitignore-Regel sind definiert und dokumentiert

### Preview / Deploy

- [ ] **PREV-01**: Preview-Start-Flow (`nuxt build` → `NITRO_PORT=4000/4003/4004 node .output/server/index.mjs`) ist hinter einem einzigen Script/Skill mit Start/Stop/Restart-Lifecycle konsolidiert; Alice/Andi muss nicht mehr zweistufig orchestrieren
- [ ] **PREV-02**: Cloudflare-Tunnel zu Preview-Ports (4000/4003/4004/3050) überlebt Container- und Preview-Restarts ohne manuellen Eingriff; Tunnel-Health ist beobachtbar

### Dokumentation

- [ ] **DOC-01**: Dokumentations-Drift für die von diesem Projekt berührten Bereiche ist geschlossen: `docs/`, projektlokale `AGENTS.md`, `DESIGN_SYSTEM.md` und Haupt-READMEs sind mit dem Codestand konsistent

## v2 Requirements

Anerkannt und später wertvoll, aber nicht in dieser Milestone.

### Skalierung & Infrastruktur

- **INFRA-01**: Redis-backed Rate-Limiting ersetzt In-Memory-Maps in Hub und Marketplace (`platform/apps/hub/server/utils/rate-limit.ts`, `marketplace/server/middleware/rate-limit.ts`) für horizontale Skalierung
- **INFRA-02**: App-Registry im Hub mit Mutex/Lock-Refresh, um Thundering-Herd beim Cache-Invalidate zu vermeiden (`platform/apps/hub/server/plugins/app-loader.ts`)

### Tech-Debt

- **DEBT-01**: `platform/packages/shared/src/db/run-migrations.ts` (447 Zeilen Fixups) in eine Drizzle-Baseline-Migration überführen; Inline-Fixups entfernen
- **DEBT-02**: Bot Internal-Sync-Server auf Hono/Fastify heben (`platform/apps/bot/src/utils/internal-sync-server.ts`, 1228 Zeilen raw `node:http`)
- **DEBT-03**: Große Hub-Vue-Pages in Composables + Sub-Components aufteilen (`settings/permissions.vue` 1257, `settings/community.vue` 1194, `landing/editor.vue` 839, `applications/flows/[flowId]/settings.vue` 660)

### Qualität

- **QA-02**: Vue-Component-Unit-Tests für komplexe Hub-Komponenten (FlowNodeSidebar, MemberDetailsModal, Landing-Blocks)
- **QA-03**: Integration-Tests API↔Utility-Handler (ergänzend zu den bestehenden Utility-Unit-Tests)

## Out of Scope

Ausdrücklich nicht Teil dieser Milestone.

| Feature | Reason |
|---------|--------|
| `marketplace/` Änderungen | Separates Repo und separates GSD-Projekt; eigener Release-Zyklus |
| `guildai/`, `voice-rooms/`, `app-template/` | Externe Beispiel-Apps; SOUL.md: Apps nur auf explizite Freigabe — hier nicht freigegeben |
| Neue Feature-Launches (Apps-Plattform v2, neue Community-Features) | Dieses Projekt ist reine Stabilisierung; Feature-Arbeit wartet auf nächste Milestone |
| GuildAI `hooks.ts` (1588 Zeilen) modularisieren | Gehört zu `guildai/`, nicht `platform/` |
| Hub-Feature-Bugs / Frontend-Regressions (Landing-Editor, Flow-Builder-UI) | Bewusst in der Eingangsrunde deselektiert; separate Feature-Milestone |
| Wechsel auf neue Frameworks (Nuxt-Major-Upgrade, anderer ORM, Bot-SDK-Austausch) | Würde Stabilisierungs-Ziel selbst destabilisieren |
| Isolated-vm- oder Worker-Thread-Wahl vorab festlegen | Technologie-Entscheidung gehört in die Phase-Research, nicht in Requirements |

## Traceability

Mapping von Requirements auf Phasen. Wird vom Roadmapper gefüllt.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 3 | Pending |
| SEC-04 | Phase 3 | Pending |
| SEC-05 | Phase 3 | Pending |
| SEC-06 | Phase 4 | Pending |
| SEC-07 | Phase 4 | Pending |
| CI-01 | Phase 5 | Pending |
| CI-02 | Phase 5 | Pending |
| QA-01 | Phase 5 | Pending |
| BOT-01 | Phase 6 | Pending |
| BOT-02 | Phase 6 | Pending |
| PREV-01 | Phase 7 | Pending |
| PREV-02 | Phase 7 | Pending |
| DOC-01 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap mapping*
