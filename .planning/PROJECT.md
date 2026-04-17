# Guildora Platform — Stabilisierung

## What This Is

Die Guildora Platform ist ein self-hostable Community-Management-Stack (Hub-Dashboard, öffentliche Landing Page, Discord- und Matrix-Bot) mit einem Apps-/Plugin-System, über das Community-Hoster eigene oder aus dem Marketplace bezogene Erweiterungen installieren können. Dieses GSD-Projekt ist **keine Feature-Initiative**, sondern eine fokussierte Stabilisierungsrunde für den `platform/`-Teil des Guildora-Workspaces — die übrigen Repos (marketplace, guildai, voice-rooms, app-template, docs) stehen daneben und laufen nicht in diesem Projekt.

## Core Value

**Die Platform läuft sicher und stabil genug, dass Andi sie ohne Bauchschmerzen weiterbauen, zeigen und produktiv betreiben kann.** Heißt konkret: kein unsandboxed Fremd-Code, Auth gehärtet, CI vertrauenswürdig, Preview-Lifecycle zuverlässig, Matrix-Bot nicht mehr nur halb da. Alles andere ist sekundär.

## Requirements

### Validated

<!-- Aus .planning/codebase/ abgeleitet — das, was heute existiert und worauf wir aufbauen. -->

- ✓ **Hub** (Nuxt-Full-Stack) mit Auth, Rollen, Mod/Admin-UI, Landing-Editor, Flow-Builder — existing
- ✓ **Web-Landing** (Nuxt, public) — existing
- ✓ **Discord-Bot** (`discord.js`): Slash-Commands, Voice-Tracking, App-Hook-Executor — existing
- ✓ **Matrix-Bot** (Basis): Client, Event-Empfang für roomMessage/roomMember — existing, aber Hook-Emission fehlt (siehe Active)
- ✓ **Shared Package**: Drizzle-ORM-Schema, Migrations, DB-Client, Seeds — existing
- ✓ **App-SDK + Apps-Plugin-System**: sideloaded und marketplace-Apps werden per `new Function()` mit whitelisted h3-Helpers ausgeführt (siehe Active: Sandbox-Härtung) — existing
- ✓ **Motion-Package**: Animation-Composables + Design-Tokens — existing
- ✓ **MCP-Server**: AI-Agent-Access zu Landing-Config — existing
- ✓ **i18n** (en, de) im Hub und Bot — existing
- ✓ **Test-Infrastruktur**: Vitest (Utils/Bots gut abgedeckt), Playwright E2E (Hub partial) — existing
- ✓ **CI** (nach Commits `fd3e1c5`, `dd3c438`, `337f1d6`, `730ae2c`): vue-tsc-Typecheck, Lint (non-blocking), Test- und Release-Workflows — existing
- ✓ **Cloudflare-Tunnel-Setup** für Preview-Ports via Host — existing
- ✓ **Docker-Compose-Stack** für Platform + Postgres im `guildora_internal`-Netz — existing

### Active

<!-- Hypothesen bis ausgeliefert und validiert. Ziehen ihre Motivation aus .planning/codebase/CONCERNS.md + Andis expliziter Priorisierung. -->

**Security (prio 1 — ASAP)**

- [ ] **SEC-AUDIT**: Vollständiges Security-Audit der platform zusammengetragen und priorisiert (CONCERNS.md erweitern/aktualisieren, Findings nach Severity sortiert) — Grundlage, weil Andis Security-Reviews bisher nur "im Kopf" existieren
- [ ] **SEC-SANDBOX**: Apps-Plugin-Code läuft in echter Sandbox (z.B. `isolated-vm` oder Worker-Thread) mit CPU-/Memory-Limits und Execution-Timeout — kritischste Lücke, SOUL.md-Regel zu "Apps" ausdrücklich gelockert für dieses Projekt
- [ ] **SEC-TIMINGSAFE**: Alle internen Token-Vergleiche verwenden `crypto.timingSafeEqual` (heute inkonsistent zwischen `internal-auth.ts` und `internal-sync-server.ts`)
- [ ] **SEC-SESSION**: Session-Middleware ist deny-by-default — unbekannte Routen sind auth-required, nicht auth-optional
- [ ] **SEC-OAUTH**: Auth-/Session-/OAuth-Härtung: Cookie-Flags, CSRF-Schutz, Session-Rotation, nuxt-auth-utils-Config-Review
- [ ] **SEC-DOCKER-SECRETS**: `docker-compose.yml` verwendet keine hartcodierten DB-Credentials mehr — env-basiert
- [ ] **SEC-DEPS**: `pnpm audit` sauber; bestehende `pnpm.overrides` (12 Einträge) reviewt und wo möglich entfernt

**CI / Qualität**

- [ ] **CI-DIAGNOSE**: Ist-Stand der CI dokumentiert — was läuft, was ist flaky, was ist slow, was ist kaputt (Andi kennt die Lage selbst nicht vollständig)
- [ ] **CI-STABIL**: CI ist vertrauenswürdig — Lint-Debt aufgelöst und Lint wieder blocking, Typecheck stabil, E2E-Lücken geschlossen
- [ ] **QA-API-TESTS**: API-Endpoint-Test-Coverage ausgebaut (heute 7 Spec-Files für 162 API-Routen — Admin- und Mod-Endpoints priorisiert)

**Bot**

- [ ] **BOT-MATRIX-HOOKS**: Matrix-Bot emittiert App-Hooks für roomMessage/roomMember (heute nur TODO) — Pattern wie in Discord-Bot `messageCreate.ts`
- [ ] **BOT-MATRIX-STATE**: Matrix-Bot-State-Handling sauber (heute liegt `matrix-bot-state.json` untracked im Arbeitsverzeichnis — Indikator für State-Drift)

**Preview / Deploy**

- [ ] **PREV-LIFECYCLE**: Preview-Start-Flow (`nuxt build` → `NITRO_PORT=... node .output/server/index.mjs`) zu einem sauberen Script/Skill konsolidiert, mit klarem Start/Stop/Restart-Lifecycle
- [ ] **PREV-TUNNEL**: Cloudflare-Tunnel zu Preview-Ports überlebt Container-/Preview-Restarts ohne manuellen Eingriff

**Doku**

- [ ] **DOC-DRIFT**: Dokumentations-Drift geschlossen: Code und Doku (`docs/`, projektlokale AGENTS.md, DESIGN_SYSTEM.md, README) wieder konsistent; von diesem Stabilisierungs-Projekt berührte Bereiche aktualisiert

### Out of Scope

<!-- Explizite Grenzen mit Begründung, damit sie nicht unbemerkt reinrutschen. -->

- **marketplace/** — separates Repo und separates GSD-Projekt; kommt nicht in dieses Planning
- **guildai/**, **voice-rooms/**, **app-template/** — Beispiel-Apps / Extensions, außerhalb des platform-Scopes. SOUL.md: Apps werden nur auf expliziten Auftrag bearbeitet; hier nicht freigegeben.
- **Neue Feature-Launches** (z.B. Apps-Plattform v2, neue Community-Features) — dieses Projekt ist reine Stabilisierung; Feature-Arbeit wartet auf nächste Milestone
- **Redis-backed Rate-Limiting für horizontale Skalierung** — wichtig, aber kein akuter Stabilitäts-/Security-Blocker; eigene Initiative
- **Run-Migrations-Consolidation** (447-Zeiler `run-migrations.ts` in Drizzle-Baseline überführen) — Tech-Debt ohne direkten Security-Impact; später
- **Große Vue-Page-Refactors** (`permissions.vue` 1257 Zeilen, `community.vue` 1194 Zeilen, `editor.vue` 839 Zeilen) — ausschließlich wenn eine Security-/CI-Anforderung es erzwingt
- **Discord-Bot Sync-Server-Rewrite** nach Hono/Fastify — isoliertes Refactor, kein Stabilitätsproblem
- **GuildAI Hooks-Modularisierung** (1588-Zeiler `hooks.ts`) — gehört zum guildai-Repo, nicht platform
- **Hub-Feature-Bugs / Frontend-Regressions** — bewusst deselektiert in der Eingangsrunde; kommt in einer späteren Milestone

## Context

**Technisches Umfeld**

- Zwei-Ebenen-Monorepo-Workspace `/home/andreas/workspace/guildora/`: Root orchestriert `platform/` (Turborepo + pnpm) und `marketplace/` (standalone) via `concurrently`. **`platform/` hat ein eigenes Git-Repo** (dieses GSD-Projekt lebt darin); der Workspace-Root ist separat versioniert.
- Laufzeit: Der Code läuft innerhalb des `alice-bot` Docker-Containers auf dem Homeserver "Arctic". Keine Docker-Aufrufe aus Agents nötig (siehe Workspace-`CLAUDE.md`). Cloudflare-Tunnel ersetzt SSH-Port-Forwarding; Preview-Ports (4000/4003/4004) sind via `guildora-web.myweby.org`, `guildora-hub.myweby.org`, `guildora-marketplace.myweby.org`, `guildora-bot.myweby.org` erreichbar.
- Stack: Nuxt ^4.1.3, Vue ^3.5, TypeScript ^5.8, discord.js ^14.25, matrix-bot-sdk ^0.7, drizzle-orm + `postgres`, Vitest, Playwright, Turborepo, pnpm 10.6.

**Ausgangslage Security/Qualität**

- `.planning/codebase/CONCERNS.md` (Audit vom 2026-04-15) nennt u.a.: **"No Sandboxing for Plugin Code Execution"** (kritisch), nicht-timingsichere Token-Vergleiche, Default-DB-Credentials, deny-by-default Session-Lücke, thundering-herd in App-Loader, Matrix-Bot-Hooks unvollständig, API-Test-Gap (7/162), Lint-Debt. Das Projekt startet mit diesen Findings als Rohmaterial, erweitert sie um Andis bisher undokumentierte "im-Kopf"-Reviews und priorisiert sie.
- Recent CI-Commits (`fd3e1c5`, `dd3c438`, `337f1d6`, `730ae2c`, `e6cf6e5`) zeigen: CI wurde gerade neu aufgezogen. Lint ist explizit als non-blocking gesetzt, weil bestehende Fehler nicht sofort wegbebbar waren. Das ist ein bekanntes Schuldkonto.
- Matrix-Bot-Arbeit läuft gerade (`apps/matrix-bot/src/utils/internal-sync-server.ts` + Spec geändert, `matrix-bot-state.json` untracked).

**Arbeitsmodus**

- Solo Andi + Claude-Agents (SOUL.md: Alice orchestriert, Agents setzen um). Kommunikation in Deutsch; Code/Agent-Prompts/Commits englisch.
- Grundsätze: "Fail Loud, Never Fake" — sichtbare Fehler statt stille Fallbacks. Delivery-Standard: implementiert + getestet + committed + Preview geprüft wenn relevant + Restprobleme dokumentiert.
- Docs-Pflicht: bei Entscheidungen `guildora/docs`, `https://guildora.github.io/docs/`, lokale `AGENTS.md`, `DESIGN_SYSTEM.md` konsultieren.

## Constraints

- **Tech-Stack**: Bestehender Stack bleibt (Nuxt 4, Vue 3, discord.js, matrix-bot-sdk, drizzle-orm, Postgres) — keine Migrations zu neuen Frameworks in diesem Projekt
- **Timeline**: ASAP für den Security-Kern (Sandbox + Auth + Deps); der Rest läuft in normalem Arbeitsrhythmus nach
- **Budget**: Solo Andi; keine externen Reviewer/Dienste bezahlt in Anspruch nehmen
- **Compatibility**: Hub ↔ Bot Internal-HTTP-Sync-Contract darf nicht brechen (auch Matrix-Bot muss den Vertrag einhalten); Drizzle-Schema-Änderungen immer als richtige Migration, keine neuen Fixups in `run-migrations.ts`
- **Security**: "Fail Loud, Never Fake" — keine stillen Sec-Fallbacks; jede Mitigation muss sichtbar, testbar und dokumentiert sein
- **Apps-Freigabe**: Apps/Plugin-System wird in diesem Projekt angefasst — ausdrücklich entgegen der SOUL.md-Default-Regel, weil der User die Freigabe explizit erteilt hat
- **Runtime**: Dev-/Build-Befehle laufen bereits im alice-bot-Container; Agents starten keine Docker-Container und ändern keine festen Ports
- **Multi-Repo**: Änderungen außerhalb `platform/` sind nicht Teil dieses Projekts — gilt für alle Agents

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope = `platform/` only | Fokus ermöglicht schnelles Closing; marketplace/guildai/voice-rooms haben eigene Entwicklungsachsen | — Pending |
| `.planning/` in `platform/.planning/` (verschoben von workspace-Root) | GSD-Projekt lebt im selben Git-Repo wie der Code; Multi-Repo-Workspace macht den Workspace-Root als GSD-Root ambivalent | — Pending |
| Apps-Sandbox explizit in Scope trotz SOUL.md-Apps-Vorsicht | User hat in Questioning-Runde ausdrücklich freigegeben; "No Sandboxing" ist kritischste bekannte Lücke | — Pending |
| Security-First vor Feature-Arbeit | Unsandboxed Code + undokumentierte Sec-Findings + instabile CI = zu hohes Risiko für Feature-Launch | — Pending |
| Security-Audit als erste Phase (nicht später) | Andis Reviews existieren nur "im Kopf"; ohne konsolidiertes Audit fehlt Grundlage für Priorisierung | — Pending |
| Out of Scope: Redis rate-limit, run-migrations-Consolidation, große Vue-Refactors, GuildAI-Hooks | Wichtig aber nicht stabilitäts-/security-kritisch; verhindern Scope-Creep | — Pending |
| Sprache: PROJECT-/Roadmap-Docs auf Deutsch, Code/Commits/Agent-Prompts englisch | SOUL.md-Vorgabe; mischt sich sauber, weil strikte Trennung | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 — Phase 02 complete (apps-plugin-sandbox: timeout wrappers, audit logs, memory caps)*
