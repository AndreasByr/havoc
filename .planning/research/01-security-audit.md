# Security Audit — Guildora Platform

**Audit-Datum:** 2026-04-16 (ursprüngliche Erstellung); letzte Aktualisierung: YYYY-MM-DD
**Codebase-Stand:** git-rev `<fill-in-wave-5>` (aus `git rev-parse HEAD` zur Audit-Schlusszeit)
**Scope:** `platform/`-Stack (ohne marketplace/, guildai/, voice-rooms/, app-template/)
**Methode:** Konsolidierung aus `.planning/codebase/CONCERNS.md` (2026-04-15) + strukturierte Kopf-Review-Session mit Andi + gezielte ripgrep-Scans für 5 Pattern-Klassen. KEIN frisches Full-Audit.
**Zielgruppe:** Phase-2/3/4-Builder (Claude-Agents) + Andi im Planning-Modus.

---

## 1. Executive Summary

> Wird in Wave 5 (Plan 05) ausgefüllt, sobald Finding-Anzahl pro Severity/Phase feststeht.
>
> Erwartete Form (Platzhalter):
> - **Gesamt-Findings:** N (davon X Critical, Y High, Z Medium, W Low + V Operational + U Deferred)
> - **Phase-Aufteilung:** Phase 2 = N, Phase 3 = N, Phase 4 = N, v2 / Deferred = N
> - **Sofort-Handlungsempfehlung:** {1 Satz}
> - **Nicht abgedeckt (out-of-scope):** Infrastructure (Docker daemon, Cloudflare), Fremd-Repos.

## 2. Severity-Kriterien

**Critical:** Unauthenticated Remote-Code-Execution, Zugriff auf alle User-Daten oder Secrets durch externen Angreifer ohne Nutzerbeteiligung.
**High:** Privilege-Escalation für authenticated User, Data-Leak einzelner User, Timing-/Info-Leaks mit direktem Angriffsweg.
**Medium:** Schwächen, die zusätzliche Voraussetzungen brauchen (innerer Netzzugriff, kompromittierte Apps), oder Härtungs-Lücken ohne direkten Exploit.
**Low:** Defense-in-Depth, Best-Practice-Abweichungen ohne bekannten Exploit-Pfad.
**Operational (nicht Security):** Performance/DoS/Stabilität — wird getrennt geführt, damit Phase-Priorisierung nicht verzerrt wird (D-15).

Severity bewertet **Restrisiko** nach heutiger Mitigation (`Current Mitigation`-Feld), nicht das theoretische Maximum (D-09).

## 3. Scope & Methodik

**In-Scope:**
- Sämtlicher Code in `platform/apps/*` und `platform/packages/*`
- `platform/docker-compose.yml`, `platform/docker-compose.override.yml`, `platform/.env.example`
- `platform/package.json` (inkl. `pnpm.overrides`)

**Explizit Out-of-Scope** (D-14):
- Code in `marketplace/`, `guildai/`, `voice-rooms/`, `app-template/`, Workspace-Root
- Runtime/Infrastruktur: Docker-Daemon-Config, Cloudflare-Tunnel-Setup, Host-OS-Härtung, Caddy-Config, Netzwerk-Topologie
- `pnpm audit`-Finding-Auflösung (gehört zu Phase 4/SEC-07)
- Einführung neuer Tooling-Layer (ESLint-Security-Plugins etc.) — Phase 5

**Methodik:**
1. Bestehende Findings aus `.planning/codebase/CONCERNS.md` (2026-04-15) übernommen + Pflicht-Metadaten ergänzt.
2. Andis bisher-nur-im-Kopf-Reviews via strukturierter Fragenkatalog (Bereiche A–H) schriftlich protokolliert.
3. 5 ripgrep-Pattern-Scans (Token-Vergleiche, Code-Execution, Hardcoded Secrets, ungeschützte API-Routen, unsafe HTML) durchgeführt; Treffer einzeln bewertet.

---

## 4. Findings — Critical

> Wird in Wave 4 (Plan 04) mit Finding-Blocks gefüllt. Jedes Finding folgt dem Template:
> `### [F-NN] <Titel>` + Bullets: **Severity**, **Area**, **Datei-Pfad(e)**, **Current Mitigation**, **Fix-Ansatz**, **Target Phase**, **Discovered-By** (optional).

## 5. Findings — High

> Wird in Wave 4 gefüllt.

## 6. Findings — Medium

> Wird in Wave 4 gefüllt.

## 7. Findings — Low

> Wird in Wave 4 gefüllt.

## 8. Operational Findings (nicht Security-Severity)

> Diese Items sind Stabilitäts-/Performance-relevant, nicht Security-Exploit-relevant.
> Sie stehen hier, damit Phase-2/3/4-Planning sie nicht fälschlich als Security-Blocker priorisiert.
>
> Jedes Item: `### [OP-NN] <Titel>` + Bullets mit `- **Class:** Operational` (NICHT `Severity:`).

## 9. Deferred / Accepted Risks

> Findings, die bewusst NICHT in dieser Milestone adressiert werden — mit Begründung.
> Jedes Item: `### [D-NN] <Titel>` + Pflicht-Bullet `- **Warum nicht jetzt:** <Begründung>`.

---

## 10. SEC-Requirement Traceability

> Gegenprobe: jedes Critical/High-Finding zeigt auf SEC-02…SEC-07. SEC-01 ist das Meta-Requirement (Audit existiert) und wird in dieser Tabelle NICHT aufgeführt (per 01-RESEARCH.md §Open Questions #2).

| SEC-Req | Beschreibung | Abgedeckt durch Finding(s) |
|---------|--------------|----------------------------|
| SEC-02  | Apps-Plugin Sandbox (CPU/Memory/Timeout + Whitelisted APIs) | _Wave 5 füllt_ |
| SEC-03  | timingSafeEqual für interne Tokens | _Wave 5 füllt_ |
| SEC-04  | Session-Middleware deny-by-default | _Wave 5 füllt_ |
| SEC-05  | OAuth/Cookie/CSRF-Review | _Wave 5 füllt_ |
| SEC-06  | Docker-Compose env-basiert (keine hartcoded DB-Credentials) | _Wave 5 füllt_ |
| SEC-07  | pnpm.overrides-Review + pnpm audit | _Wave 5 füllt_ |

**Unabgedeckt / offen:** _Wave 5 füllt (Liste der SEC-Requirements ohne Finding ODER leer, wenn alle gedeckt)._

---

*Audit erstellt: 2026-04-16 (Phase 1 dieses Stabilisierungs-Projekts)*
