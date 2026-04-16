# Phase 1: Security Audit & Priorisierung - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 liefert **ein einziges, konsolidiertes, schriftliches Security-Audit** des `platform/`-Stacks. Das Audit ist Severity-sortiert und so strukturiert, dass Phase 2 (Apps-Sandbox), Phase 3 (Auth-/Session-Härtung) und Phase 4 (Supply-Chain & Secrets) gegen priorisierte Findings arbeiten — nicht gegen Bauchgefühl.

**Das Ergebnis ist Dokumentation, kein Code-Fix.** Jeder Code-Fix landet in Phase 2+ oder v2.

Nicht-Ziele:
- Keine Fixes in dieser Phase
- Kein neues Tooling einführen (ESLint-Security-Plugins, CVSS-Scoring-Tools)
- Keine Bewertung von Code ausserhalb `platform/` oder der Runtime/Infrastruktur

</domain>

<decisions>
## Implementation Decisions

### Audit-Output-Form & -Ort

- **D-01:** Das primäre Audit-Dokument lebt in `.planning/research/01-security-audit.md` (neu angelegt). `CONCERNS.md` wird NICHT als Haupt-Doc erweitert — es bleibt die reine Codebase-Snapshot-Analyse vom 2026-04-15.
- **D-02:** Format: Markdown mit **strukturierter Heading-Konvention pro Finding** (nicht Tabelle, nicht JSON+MD-Split). Jedes Finding ist eine eigene `###`-Section, damit Phase-2/3/4-Researcher einzelne Findings linkbar referenzieren können und Claude sie atomar lesen kann.
- **D-03:** Gruppierung: **Severity zuerst (Critical → High → Medium → Low), innerhalb jedes Severity-Blocks nach Bereich** (Apps-Plugin, Auth/Session, Supply-Chain, etc.). Das matcht die Phasen-Priorität.
- **D-04:** Primäre Zielgruppe: **Claude-Builder in Phase 2/3/4 + Andi im Planning-Modus**. NICHT für externe Reviewer formatieren — keine CVSS-Vektoren, kein CWE-Mapping.

### Severity-Schema & Finding-Metadaten

- **D-05:** Severity-System: **Qualitativ C/H/M/L mit Kriterien-Definition** am Anfang des Dokuments. Beispiel-Kriterien:
  - **Critical:** Unauthenticated Remote-Code-Execution, Zugriff auf alle User-Daten oder Secrets durch externen Angreifer ohne Nutzerbeteiligung.
  - **High:** Privilege-Escalation für authenticated User, Data-Leak einzelner User, Timing-/Info-Leaks mit direktem Angriffsweg.
  - **Medium:** Schwächen, die zusätzliche Voraussetzungen brauchen (innerer Netzzugriff, kompromittierte Apps), oder Härtungs-Lücken ohne direkten Exploit.
  - **Low:** Defense-in-Depth, Best-Practice-Abweichungen ohne bekannten Exploit-Pfad.
- **D-06:** Pflicht-Metadaten pro Finding (zusätzlich zu Titel + Severity):
  - `Datei-Pfad(e)` mit optionaler Zeilen-Referenz
  - `Fix-Ansatz` — knapper Lösungspfad, nicht implementiert
  - `Current Mitigation` — was das Risiko HEUTE kleinhält (z.B. "nur im internal Docker-Netz erreichbar", "require() ist geblockt"). Dieses Feld ist Pflicht, nicht optional, auch wenn "keine" dasteht.
  - `Target Phase` — `Phase 2` / `Phase 3` / `Phase 4` / `v2` / `out-of-scope`. Jedes Critical/High MUSS auf eine Phase 2–4 zeigen (Success Criteria #3).
- **D-07:** Optional / nicht Pflicht: `Discovered-By` (CONCERNS.md / Kopf-Review / grep-Scan / pnpm audit) nur dort einfügen, wo es Verständnis hilft. CWE/CVE-Referenzen weglassen.
- **D-08:** "Accepted Risks / Deferred"-Findings werden in einem **eigenen Abschnitt am Ende** des Dokuments gesammelt (nicht inline mit Status-Tag, nicht in separater Datei). Jedes deferred Finding braucht eine Begründung (Warum nicht jetzt? Warum ist das Risiko akzeptabel?) — erfüllt Roadmap-Success-Criteria #4.
- **D-09:** Teilweise mitigierte Findings: **Severity bewertet das Restrisiko**, nicht das theoretische Maximum. Das bestehende Mitigation-Niveau steht im `Current Mitigation`-Feld. Kein Raw/Residual-Zwei-Achsen-Schema.

### Discovery-Tiefe

- **D-10:** Scan-Breite: **`CONCERNS.md` + Andis bisher nur im-Kopf existierende Reviews konsolidieren + gezielte grep/ripgrep-Scans für bekannte Pattern-Klassen.** KEIN frisches, vollständiges Re-Audit vom Null-Punkt.
- **D-11:** Pattern-Liste für grep-Scans (der Planner legt die finale Liste fest — Beispiele):
  - Token-Vergleiche: `token\s*!==|token\s*===` mit `Secret|Token|Password` im Umfeld
  - Code-Execution: `new Function\(|eval\(|vm\.`
  - Hardcoded Secrets: `password:\s*["']|secret:\s*["']|postgres:postgres`
  - Auth-Guards: Routen unter `server/api/` ohne `requireSession`/`requireAdmin`/`requirePublic`-Marker
  - Unsafe-HTML: `v-html` ohne `dompurify` / `sanitize` im Umfeld
- **D-12:** Automation im Scope: **Nur manuelle grep/ripgrep-Scans**. KEIN neues Tooling (keine `eslint-plugin-security`-Integration in dieser Phase — das ist CI-Arbeit und gehört in Phase 5). `pnpm audit` ist out-of-scope für diese Phase; sein Ergebnis wird in Phase 4 gezogen und dort aufgelöst.
- **D-13:** **Kopf-Review-Extraktion:** Der Planner definiert eine strukturierte Abfrage-Runde für Andi (z.B. Checkliste-Prompt: "Welche Stellen im Auth-Code machen dir Bauchweh?"), damit die undokumentierten Reviews nicht nur als freie Assoziation landen.

### Boundaries

- **D-14:** Out-of-Scope für das Audit — explizit im Dokument markieren:
  - Code ausserhalb `platform/` (marketplace, guildai, voice-rooms, app-template, Workspace-Root)
  - Runtime-/Infrastruktur-Risiken (Docker-Daemon-Config, Cloudflare-Tunnel-Setup, Host-Härtung)
- **D-15:** In-Scope, aber separat klassifizieren: Performance-/DoS-/operational Risiken (thundering herd im app-loader, in-memory rate limit) bleiben im Audit, werden aber als **"Operational"** markiert statt als Security-Severity, damit Phase 2/3/4-Planning sie nicht fälschlich als Security-Blocker priorisiert.
- **D-16:** Audit-Volumen-Ziel: **~15-25 Findings, jeweils ~10-20 Zeilen.** Harte Obergrenze: nicht mehr als was in einer Session reviewbar ist. Wenn mehr gefunden wird, werden die schwächsten Lows nach v2 geschoben.

### Claude's Discretion

- Die genaue grep-Pattern-Liste (exakter Regex, welche Directories gescannt werden) → Planner/Researcher entscheidet mit Kontext.
- Die genaue Formulierung von Andis Kopf-Review-Abfrage-Prompt → Planner gestaltet.
- Die Reihenfolge der Findings innerhalb eines Severity+Bereich-Blocks → nach Claude-Judgement (z.B. nach Fix-Aufwand oder Phasen-Reihenfolge).
- Executive-Summary am Doc-Anfang: ja, kurz (3-5 Zeilen), damit schnell klar ist, wie viele Findings pro Severity/Phase anliegen.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projekt-Grundlagen (Pflicht)
- `.planning/PROJECT.md` — Stabilisierungs-Scope, "Fail Loud, Never Fake", Apps-Freigabe-Ausnahme, Multi-Repo-Grenze
- `.planning/REQUIREMENTS.md` — `SEC-01` (diese Phase) und `SEC-02…SEC-07` (Folge-Phasen 2-4, dienen als Ziel-Taxonomie)
- `.planning/ROADMAP.md` §"Phase 1: Security Audit & Priorisierung" — Goal + 4 Success Criteria (v.a. Severity-Sort + Phase-Zuordnung + explizite Deferred-Liste)

### Audit-Rohmaterial (Pflicht als Input)
- `.planning/codebase/CONCERNS.md` §"Security Considerations" — 4 konkrete Findings (Plugin-Sandbox, Timing-Token, Docker-Secrets, Session-Middleware)
- `.planning/codebase/CONCERNS.md` §"Performance Bottlenecks" + §"Tech Debt" — Kandidaten für "Operational"-Klassifizierung
- `.planning/codebase/CONCERNS.md` §"Dependencies at Risk" — `pnpm.overrides`-Liste als Input für Phase 4 (nur als Referenz eintragen, nicht auflösen)

### Codebase-Kontext (für Finding-Lokalisation)
- `.planning/codebase/STRUCTURE.md` — Orientierung, welche Directories unter `platform/apps/*` und `platform/packages/*` relevant sind
- `.planning/codebase/INTEGRATIONS.md` — Hub↔Bot-Sync-Contract (für Findings zu Internal-Auth)
- `.planning/codebase/ARCHITECTURE.md` — Apps-Plugin-Pipeline (Sideload → Registry → Execute), relevant für Plugin-Sandbox-Finding

### Konkrete Code-Stellen (aus CONCERNS.md bereits identifiziert)
- `platform/apps/bot/src/utils/app-hooks.ts` + `platform/apps/hub/server/api/apps/[...path].ts` — Plugin-Execution via `new Function()`
- `platform/apps/hub/server/utils/internal-auth.ts` vs. `platform/apps/bot/src/utils/internal-sync-server.ts` — inkonsistente Token-Vergleiche
- `platform/apps/hub/server/middleware/03-session.ts` — Session-Middleware (deny-by-default-Kandidat)
- `platform/apps/hub/server/middleware/02-csrf-check.ts` — CSRF-Review
- `platform/docker-compose.yml` — hartcodierte DB-Credentials
- `platform/package.json` — `pnpm.overrides` (12 Einträge)

### Workspace-Konventionen
- `CLAUDE.md` (Workspace-Root) + `platform/CLAUDE.md` — Runtime-Einschränkungen, Port-Schema, "keine Docker-Aufrufe"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.planning/codebase/CONCERNS.md`** ist kein abgeschlossenes Audit, aber eine gute Ausgangs-Inventur. ~7 konkrete Security-Findings + Performance-/Tech-Debt-Kandidaten für "Operational"-Klassifizierung können direkt übernommen werden — nach Severity-Neuzuordnung und Ergänzung der Pflicht-Felder (Current Mitigation, Target Phase).
- **REQUIREMENTS.md SEC-01…SEC-07** sind bereits eine Phase-Ziel-Taxonomie: jedes Critical/High-Finding im Audit sollte sich auf genau eine SEC-Requirement abbilden lassen. Das ist die natürliche Gegenprobe für "alle Findings einer Folge-Phase zugeordnet".

### Established Patterns
- **Markdown-First Planning:** `.planning/codebase/*.md` nutzen durchgängig `##` für Kategorien und `###` für einzelne Items mit Fliesstext-Feldern (`Files:`, `Impact:`, `Fix approach:`). Die neue Audit-Heading-Konvention sollte daran anschliessen, damit Style konsistent bleibt.
- **Sprache:** PROJECT.md ist auf Deutsch, CONCERNS.md auf Englisch. Audit-Dokument folgt der PROJECT-Sprache (Deutsch), technische Feldnamen/Code-Schnipsel bleiben Englisch.
- **"Fail Loud, Never Fake"** aus PROJECT.md — im Audit wird kein Finding weichgespült; wenn eine Mitigation löchrig ist, wird das explizit benannt, nicht umformuliert.

### Integration Points
- Das Audit-Doc ist **Input für Phase 2/3/4-Research**. Die Target-Phase-Tags im Audit sind der Join-Key: Phase 2 holt alle `Target Phase: Phase 2`-Findings und macht ihren Research darüber. Heading-Konvention muss das grep-bar lassen.
- REQUIREMENTS.md Traceability-Tabelle (`SEC-01 | Phase 1 | Pending`) wird am Phase-Ende auf `Done` gesetzt; das Audit ist der Lieferantwortbeweis.
- STATE.md wird nach Phase-Abschluss aktualisiert (Velocity-Metrik + "Last activity").

</code_context>

<specifics>
## Specific Ideas

- **Severity-Kriterien-Block am Dokument-Anfang** ist nicht verhandelbar — ohne Kriterien wird C/H/M/L sonst Bauchgefühl, was genau das ist, was diese Phase ersetzen soll.
- **Executive-Summary** (3-5 Zeilen): "X Critical, Y High, Z Medium, W Low. Phase-Aufteilung: Phase 2 = N Findings, Phase 3 = N Findings, …" — damit der Planner sofort sieht, wo die Masse liegt.
- **Deferred-Findings bekommen einen Begründungs-Satz**, der so stark ist, dass Future-Andi in 6 Monaten ihn noch nachvollziehen kann — nicht nur "not now".
- **Operational-vs-Security-Unterscheidung** ist bewusst: Performance/DoS-Findings aus CONCERNS.md stehen im selben Dokument, aber mit klarem Klassen-Tag, damit sie die Security-Priorisierung nicht verwässern.

</specifics>

<deferred>
## Deferred Ideas

Folgende Ideen sind diskutiert worden, gehören aber nicht in Phase 1 (werden zum passenden Zeitpunkt wieder aufgegriffen):

- **ESLint-Security-Plugins** (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`) als ergänzende Discovery-Quelle — verschoben, weil das Lint-Integration ist und CI erst in Phase 5 stabilisiert wird. Dort entscheiden, ob es reinkommt.
- **`pnpm audit`-Lauf + Auflösung** — wird in Phase 4 (Supply-Chain & Secrets) als eigenständige Arbeit geplant. Audit in Phase 1 erwähnt nur, dass "es noch nicht durchgezogen wurde" als Finding.
- **CVSS-Scoring oder externes Review-Format** — nicht für Solo-Projekt nötig; wenn später ein externer Reviewer reinkommt, lässt sich die qualitative Severity nachträglich auf CVSS hochziehen.
- **Runtime-/Infrastruktur-Audit** (Docker-Daemon-Config, Cloudflare-Tunnel-Härtung, Host-OS-Patches) — out-of-scope dieser Milestone; könnte eine eigene "Ops-Hardening"-Milestone später werden.
- **Audit von marketplace/guildai/voice-rooms/app-template** — jeweils eigene Projekte/Repos; wenn dort Audits nötig werden, bekommen sie ihre eigene Milestone.
- **Re-Audit-Kadenz** (z.B. quartalsweise) — nicht in diesem Stabilisierungs-Projekt festzulegen; Diskussion nach Milestone-Abschluss.
- **Sign-off-Prozess** (wer "approved" das Audit) — Solo-Andi-Setup, Sign-off-Prozess macht hier keinen Sinn.

</deferred>

---

*Phase: 01-security-audit-priorisierung*
*Context gathered: 2026-04-16*
