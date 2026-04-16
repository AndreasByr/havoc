# Phase 1: Security Audit & Priorisierung - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 01-security-audit-priorisierung
**Areas discussed:** Audit-Output-Form & -Ort, Severity-Schema & Finding-Metadaten, Discovery-Tiefe

---

## Audit-Output-Form & -Ort

### Wo lebt das primäre Audit-Dokument?

| Option | Description | Selected |
|--------|-------------|----------|
| Neu: `.planning/research/01-security-audit.md` | Frisches Dokument im Research-Ordner, CONCERNS.md bleibt unangetastet | ✓ |
| CONCERNS.md erweitern + Severity-Tags inline | Bestehendes Doc ausbauen, alles an einem Ort | |
| Beides: Audit in research/ + CONCERNS.md-Update referenziert | Hybrid, zwei Dateien pflegen | |

**User's choice:** Neu: `.planning/research/01-security-audit.md`

### Welches Format für die einzelnen Findings?

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown mit strukturierter Heading-Konvention pro Finding | Jedes Finding eigene Section, grep-bar | ✓ |
| Markdown-Tabelle (alle Findings in einer Tabelle) | Kompakt, aber enge Spalten | |
| JSON/YAML Findings-Index + Markdown-Detailseiten | Strukturiert, aber zwei Formate | |

**User's choice:** Markdown mit strukturierter Heading-Konvention pro Finding

### Wie sollen Findings primär gruppiert werden?

| Option | Description | Selected |
|--------|-------------|----------|
| Nach Severity zuerst, innerhalb nach Bereich | C→H→M→L, dann Apps/Auth/Supply-Chain | ✓ |
| Nach Bereich zuerst, Severity als Tag | Bereichs-fokussiert | |
| Nach Folge-Phase (2/3/4/v2/out-of-scope) | Phase-zentrische Sicht | |

**User's choice:** Nach Severity zuerst, innerhalb nach Bereich

### Wer ist die primäre Zielgruppe des Audit-Dokuments?

| Option | Description | Selected |
|--------|-------------|----------|
| Du als Builder + Phase-2/3/4-Researcher | Intern, kein externer Reviewer | ✓ |
| Future-Andi (in 6 Monaten) + ggf. externer Reviewer | Langzeit- und Review-tauglich | |
| Beides — knapp pro Finding, plus ein Executive-Summary oben | Hybrid mit Executive-Summary | |

**User's choice:** Du als Builder + Phase-2/3/4-Researcher

**Notes:** Executive-Summary wird trotzdem aufgenommen (aus Option 3 übernommen), weil der Planner die Zahlen auf einen Blick braucht.

---

## Severity-Schema & Finding-Metadaten

### Welches Severity-Schema für die Findings?

| Option | Description | Selected |
|--------|-------------|----------|
| Qualitativ C/H/M/L mit Kriterien | Definitionen am Dokumentanfang | ✓ |
| CVSS 3.1 Base-Score | Numerisch, präzise, aber Overhead | |
| Severity + separate Exploitability-Achse | Zwei-Achsen-Priorisierung | |

**User's choice:** Qualitativ C/H/M/L mit Kriterien

### Welche Felder MUSS jedes Finding haben neben Titel + Severity?

| Option | Description | Selected |
|--------|-------------|----------|
| Datei-Pfad(e) + ggf. Zeilen | Pflicht laut Roadmap-Success-Criteria | ✓ |
| Fix-Ansatz + Current-Mitigation + Target-Phase | Erfüllt Success-Criteria #3+#4 | ✓ |
| Discovered-By / Source | Audit-Trail, nice-to-have | |
| CWE/CVE-Referenz | Für externe Reviewer, aber Zeit-Investment | |

**User's choice:** Datei-Pfade + Fix-Ansatz/Current-Mitigation/Target-Phase (Multi-Select)

### Wie werden Findings markiert, die bewusst NICHT in dieser Milestone gefixt werden?

| Option | Description | Selected |
|--------|-------------|----------|
| Eigener Abschnitt 'Accepted Risks' am Ende | Sauber getrennt | ✓ |
| Inline mit 'Deferred'-Tag pro Finding | Alle Findings auf einen Blick | |
| Separate Datei `.planning/research/01-security-accepted-risks.md` | Hartes Splitting | |

**User's choice:** Eigener Abschnitt 'Accepted Risks' am Ende

### Wie mit teilweise mitigierten Findings umgehen?

| Option | Description | Selected |
|--------|-------------|----------|
| Current-Mitigation-Feld + Severity nach Restrisiko | Ehrlich, realistisch | ✓ |
| Zwei Severities: Raw + Residual | Präziser, aber doppelter Aufwand | |
| Nur Rest-Severity, Mitigation als Fliesstext im Finding-Body | Schlanker, leichter zu übersehen | |

**User's choice:** Current-Mitigation-Feld + Severity nach Restrisiko

---

## Discovery-Tiefe

### Wie breit soll der Audit-Scan gehen?

| Option | Description | Selected |
|--------|-------------|----------|
| CONCERNS.md + Andis Kopf-Reviews konsolidieren | Schnellster Weg zur priorisierten Liste | ✓ |
| + frischer Code-Scan (grep-basiert) | Zusätzliche gezielte Greps | |
| + frischer Code-Scan + Dependency-Audit | Gründlich, überlappt mit Phase 4 | |

**User's choice:** CONCERNS.md + Andis Kopf-Reviews konsolidieren

**Notes:** Die gezielten grep/ripgrep-Scans werden über die nächste Frage (Automation) reingeholt — nicht als volles Re-Audit, aber als Ergänzung zu bekannten Pattern-Klassen.

### Welche automatisierten Tools werden in dieser Phase eingesetzt?

| Option | Description | Selected |
|--------|-------------|----------|
| Gezielte grep/ripgrep-Scans für bekannte Patterns | Manuell kuratierte Pattern-Liste | ✓ |
| `pnpm audit` — nur Ergebnis importieren, Fix in Phase 4 | Documentation-only | |
| ESLint Security-Plugins | Neue Tool-Integration, CI-relevant | |
| Nichts automatisiert, nur manueller Review | Reines Lesen + Brainstorm | |

**User's choice:** Gezielte grep/ripgrep-Scans für bekannte Patterns

### Was wird im Audit explizit NICHT mit-bewertet?

| Option | Description | Selected |
|--------|-------------|----------|
| Code ausserhalb `platform/` | marketplace/guildai/voice-rooms/app-template | ✓ |
| Runtime/Infrastruktur-Risiken (Host/Docker/CF-Tunnel) | Container-Escape, Daemon-Config | ✓ |
| UX-/Social-Engineering-Vektoren | Phishing, Permission-Dialog-Design | |
| Performance-/DoS-Risiken | Thundering Herd, N+1, Rate-Limit-Bypass | |

**User's choice:** Code ausserhalb platform/ + Runtime/Infrastruktur-Risiken (Multi-Select)

**Notes:** Performance-/DoS-Risiken bleiben im Audit, werden aber als "Operational" klassifiziert statt Security-Severity (siehe D-15 in CONTEXT.md).

### Welche Audit-Grösse ist realistisch?

| Option | Description | Selected |
|--------|-------------|----------|
| ~15-25 Findings, jeweils ~10-20 Zeilen | Kompakt für ein-Sitzungs-Review | ✓ |
| ~30-50 Findings, knapper gehalten | Mehr Vollständigkeit, Rausch-Risiko | |
| Keine Zielgrösse, so viele wie gefunden werden | Kann ausufern | |

**User's choice:** ~15-25 Findings, jeweils ~10-20 Zeilen

---

## Claude's Discretion

Folgende Detail-Entscheidungen wurden bewusst dem Planner/Researcher überlassen:

- Exakte grep/ripgrep-Pattern-Liste (welche Regexes, welche Directories)
- Formulierung des Kopf-Review-Abfrage-Prompts für Andi
- Reihenfolge der Findings innerhalb eines Severity+Bereich-Blocks
- Konkretes Layout des Executive-Summary-Blocks

## Deferred Ideas

- ESLint-Security-Plugins → Phase 5 (CI-Härtung)
- `pnpm audit`-Lauf + Override-Auflösung → Phase 4 (Supply-Chain & Secrets)
- CVSS-Scoring / externes Review-Format → bei Bedarf später
- Runtime-/Infrastruktur-Audit → eigene Ops-Hardening-Milestone
- Audit von marketplace/guildai/voice-rooms/app-template → eigene Milestones pro Repo
- Re-Audit-Kadenz → nach Milestone-Abschluss diskutieren
- Sign-off-Prozess → in Solo-Setup nicht nötig

