# Phase 1: Security Audit & Priorisierung — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 5 (3 new, 2 modify)
**Analogs found:** 5 / 5 (all exact or role-match)

## Summary

Phase 1 ist eine **reine Doku-Phase** — es gibt keine TypeScript-/Vue-/DB-Patterns zu übertragen. Die Patterns, die hier dokumentiert werden, sind **Markdown-Stil-Regeln** (Heading-Hierarchie, Bullet-Meta-Feld-Konventionen, Deutsch/Englisch-Mischung) und ein **Bash-Skript-Template** für die Struktur-Validierung des Audit-Dokuments.

Wichtigste Pattern-Beobachtung über alle `.planning/`-Docs:

- **Frontmatter:** nur `.planning/STATE.md` nutzt YAML-Frontmatter. Alle anderen Docs beginnen mit `# Title` + `**Label:**`-Zeilen als Kopf-Metadaten. → **Audit-Doc nutzt KEIN Frontmatter**, sondern `**Audit-Datum:** …`-Zeilen wie in CONCERNS.md und PROJECT.md.
- **Finding-Block-Stil:** CONCERNS.md hat bereits einen `###`-Heading + `**Files:** / **Impact:** / **Fix approach:**`-Bullet-Stil etabliert. Der Audit-Doc **erweitert** diesen Stil um `**Severity:**`, `**Current Mitigation:**`, `**Target Phase:**` — keine Neuerfindung.
- **Sprache:** PROJECT.md + REQUIREMENTS.md + 01-CONTEXT.md + 01-RESEARCH.md sind **Deutsch**; CONCERNS.md + STRUCTURE.md + CONVENTIONS.md sind **Englisch**. Regel aus 01-CONTEXT.md `<code_context>`: „Audit-Dokument folgt der PROJECT-Sprache (Deutsch), technische Feldnamen/Code-Schnipsel bleiben Englisch." → Audit-Doc und `kopf-review.md` sind **Deutsch**; Code-Snippets in Findings bleiben Englisch.
- **Meta-Felder:** Bullet-Liste mit fettgedrucktem Label + Doppelpunkt (`- **Severity:** High`). NICHT YAML-Frontmatter, NICHT inline-Tabelle — pro D-02 explizit abgelehnt.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/research/01-security-audit.md` | audit-document (Markdown, structured findings) | transform (rohdaten → konsolidiertes Doc) | `.planning/codebase/CONCERNS.md` + `.planning/PROJECT.md` (Heading-Struktur + Deutsch-Stil) | exact (Heading+Bullet-Stil), rolen-match (Sprache) |
| `.planning/phases/01-security-audit-priorisierung/kopf-review.md` | working-protocol (Markdown Q&A) | event-driven (Fragen → Antworten) | `.planning/phases/01-security-audit-priorisierung/01-DISCUSSION-LOG.md` (existiert) + `.planning/codebase/CONCERNS.md` §-Gliederung | role-match |
| `.planning/phases/01-security-audit-priorisierung/validation.sh` | validation-script (Bash + ripgrep) | batch (grep-Checks → PASS/FAIL-Report) | `platform/scripts/switch-env.sh` + `platform/scripts/dev-server-watch.sh` (Shebang, Dir-Resolve, echo-Pattern) | role-match |
| `.planning/REQUIREMENTS.md` (edit) | traceability-table row update | request-response (Status `Pending` → `Done`) | `.planning/REQUIREMENTS.md` selbst (Tabellen-Zeile SEC-01, eine-Zelle-Edit) | exact (self-reference) |
| `.planning/STATE.md` (edit) | state-file update (YAML frontmatter + text metrics) | CRUD (Felder `last_activity`, `last_updated`, `progress.completed_phases`) | `.planning/STATE.md` selbst (existierende Struktur) | exact (self-reference) |

## Pattern Assignments

### `.planning/research/01-security-audit.md` (audit-document, transform)

**Primary analog:** `.planning/codebase/CONCERNS.md` (für Finding-Block-Stil)
**Secondary analog:** `.planning/PROJECT.md` (für Deutsch-Sprach-Register + `**Label:**`-Metadaten)
**Template source:** `01-RESEARCH.md` §"Audit Document Skeleton" (Zeilen 513-653) — Planner kopiert dieses Skelett 1:1 in den Wave-5-Write-Task.

---

**Pattern A — Doc-Header (aus PROJECT.md + CONCERNS.md):**

```markdown
# Security Audit — Guildora Platform

**Audit-Datum:** 2026-04-16 (ursprüngliche Erstellung); letzte Aktualisierung: YYYY-MM-DD
**Codebase-Stand:** git-rev `<SHA>` (aus `git rev-parse HEAD` zur Audit-Schlusszeit)
**Scope:** `platform/`-Stack (ohne marketplace/, guildai/, voice-rooms/, app-template/)
**Methode:** Konsolidierung aus `.planning/codebase/CONCERNS.md` (2026-04-15) +
strukturierte Kopf-Review-Session mit Andi + gezielte ripgrep-Scans.
**Zielgruppe:** Phase-2/3/4-Builder (Claude-Agents) + Andi im Planning-Modus.
```

**Vorbild aus CONCERNS.md (Zeilen 1-3):**
```markdown
# Codebase Concerns

**Analysis Date:** 2026-04-15
```

**Vorbild aus PROJECT.md (Zeilen 1-10, Deutsch-Stil-Referenz):**
```markdown
# Guildora Platform — Stabilisierung

## What This Is

Die Guildora Platform ist ein self-hostable Community-Management-Stack ...
```

**Regel:** Header-Zeilen nutzen `**Label:**` (fett, Doppelpunkt, Space, Wert). KEIN YAML-Frontmatter (Unterschied zu STATE.md; D-02 bestätigt).

---

**Pattern B — Abschnitts-Hierarchie (aus CONCERNS.md §-Struktur + D-03):**

```markdown
## 1. Executive Summary
## 2. Severity-Kriterien
## 3. Scope & Methodik
## 4. Findings — Critical
## 5. Findings — High
## 6. Findings — Medium
## 7. Findings — Low
## 8. Operational Findings (nicht Security-Severity)
## 9. Deferred / Accepted Risks
## 10. SEC-Requirement Traceability
```

**Rationale:** D-03 verlangt Severity zuerst, CONCERNS.md nutzt `## Tech Debt` / `## Security Considerations` / `## Performance Bottlenecks` als Top-Level-`##`-Abschnitte. Audit folgt derselben `##`-Ebene, nummeriert durch (1.–10.), damit Inhaltsverzeichnis grep-bar bleibt (siehe Validation SEC-01.SC3a).

---

**Pattern C — Finding-Block (Pflicht-Shape, aus 01-RESEARCH.md §Pattern 1 + CONCERNS.md-Bullets):**

**Vorbild aus CONCERNS.md (Zeilen 51-55), dokumentiert den bestehenden Stil:**
```markdown
**No Sandboxing for Plugin Code Execution:**
- Risk: Installed apps ... execute via `new Function()` in the same Node.js process ...
- Files: `platform/apps/bot/src/utils/app-hooks.ts` (line 128), ...
- Current mitigation: `require()` is blocked. Only whitelisted h3 helpers are injected ...
- Recommendations: Consider `isolated-vm` or worker threads ...
```

**Erweiterte Zielform für das Audit-Doc (aus 01-RESEARCH.md Pattern 1 Zeilen 204-218):**

```markdown
### [F-03] Non-Timing-Safe Token Comparison im Hub-Internal-Auth

- **Severity:** High
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/utils/internal-auth.ts:16`
- **Current Mitigation:** MCP-Token-Endpoint nur vom internen Docker-Netz aus erreichbar
  (kein öffentliches Routing). Bot-Seite (`internal-sync-server.ts:70-86`) nutzt bereits
  `crypto.timingSafeEqual` — Inkonsistenz nur in der Hub-Seite.
- **Fix-Ansatz:** `token !== expectedToken` durch `timingSafeEqual`-Wrapper mit
  Längen-Pre-Check ersetzen (Pattern aus `internal-sync-server.ts` wiederverwenden).
- **Target Phase:** Phase 3 (SEC-03)
- **Discovered-By:** CONCERNS.md §"Non-Timing-Safe Token Comparison" + grep-Scan
  `token\s*!==` bestätigt eine Hub-Fundstelle.
```

**Unterschiede zum CONCERNS.md-Stil (wichtig beim Copy):**

| CONCERNS.md (Ist) | Audit-Doc (Soll) |
|-------------------|------------------|
| Heading ist `**Fett-Titel:**` als Bullet-Überschrift | Heading ist `### [F-XX] Titel` (echtes Markdown-`###`, grep-bar) |
| Felder: `Risk:`, `Files:`, `Current mitigation:`, `Recommendations:` | Felder: `Severity:`, `Area:`, `Datei-Pfad(e):`, `Current Mitigation:`, `Fix-Ansatz:`, `Target Phase:`, `Discovered-By:` (opt.) |
| Englisch | Deutsch (Feldnamen mischen Englisch: `Severity`, `Target Phase` — bleibt englisch, weil Join-Key) |
| Kein Ordnungsschlüssel | `[F-XX]`, `[OP-XX]`, `[D-XX]`-Prefix — sequentielle IDs (01-RESEARCH.md §"Don't Hand-Roll") |

**Regeln:**
1. Alle 5 Pflicht-Meta-Felder (Severity, Datei-Pfad(e), Current Mitigation, Fix-Ansatz, Target Phase) sind **bei jedem Finding** vorhanden — sonst scheitert validation.sh (siehe SEC-01.SC2a…e).
2. `Fix-Ansatz` ist **≤ 2 Sätze, keine Code-Snippets, keine Library-Namen** (01-RESEARCH.md §Common Pitfalls §Pitfall 2).
3. `Current Mitigation: keine` ist nur zulässig mit angehängter Begründung: `keine — <ein Satz warum>` (01-RESEARCH.md §Common Pitfalls §Pitfall 5).

---

**Pattern D — Operational-Block (D-15, aus 01-RESEARCH.md §Pattern 2 Zeilen 228-239):**

```markdown
### [OP-01] In-Memory Rate-Limit (nicht horizontal skalierbar)

- **Class:** Operational (nicht Security-Severity)
- **Area:** Rate-Limiting
- **Datei-Pfad(e):** `platform/apps/hub/server/utils/rate-limit.ts:13` (`Map`-Store),
  `platform/apps/hub/server/middleware/01-rate-limit.ts:7`
- **Current Mitigation:** Solo-Deployment (ein Hub-Prozess) → Rate-Limit ist effektiv,
  weil es pro Prozess korrekt zählt.
- **Fix-Ansatz:** Redis-backed Store (bereits als v2 `INFRA-01` geplant).
- **Target Phase:** v2 (INFRA-01)
```

**Kritischer Unterschied:** `Class: Operational` statt `Severity: …`. validation.sh prüft das explizit (`rg -A1 '^### \[OP-' | rg -q '^- \*\*Class:\*\* Operational'`).

---

**Pattern E — Deferred-Block (D-08, aus 01-RESEARCH.md §Pattern 3 Zeilen 249-261):**

```markdown
### [D-02] Fehlender `pnpm audit`-Lauf

- **Severity:** Low (Defense-in-Depth)
- **Area:** Supply-Chain
- **Datei-Pfad(e):** — (Prozess-Lücke, nicht Code)
- **Current Mitigation:** 12 `pnpm.overrides` in `platform/package.json` decken
  bekannte CVE-Patches ab ...
- **Warum nicht jetzt:** `pnpm audit`-Durchlauf + Finding-Auflösung ist als eigener
  Phase-4-Arbeitsblock (SEC-07) geplant. Ein Audit-Lauf HIER würde Arbeit
  duplizieren und Phase 1 aus dem Volumen-Budget (15-25 Findings) schieben.
- **Target Phase:** Phase 4 (SEC-07)
```

**Pflicht:** `Warum nicht jetzt:`-Feld ist Required für alle Einträge in `## 9. Deferred / Accepted Risks`. validation.sh prüft mit `rg -A5 '^### \[D-' | rg -q '^- \*\*Warum nicht jetzt:\*\*'`.

---

**Pattern F — Traceability-Tabelle (aus REQUIREMENTS.md §Traceability Zeilen 78-94):**

**Vorbild-Syntax aus REQUIREMENTS.md:**
```markdown
| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 2 | Pending |
```

**Zielform für Audit-Doc §10:**
```markdown
| SEC-Req | Beschreibung | Abgedeckt durch Finding(s) |
|---------|--------------|----------------------------|
| SEC-02  | Apps-Plugin Sandbox | F-01, F-09, F-10, F-11 |
| SEC-03  | timingSafeEqual für interne Tokens | F-02, (ggf. F-12) |
| SEC-04  | Session-Middleware deny-by-default | F-04 |
| SEC-05  | OAuth/Cookie/CSRF-Review | F-06, F-07, F-17 |
| SEC-06  | Docker-Compose env-basiert | F-03 |
| SEC-07  | pnpm.overrides-Review + pnpm audit | D-01, D-02 (Phase 4) |
```

**Regel:** Jede SEC-02…SEC-07-Zeile muss **mindestens ein Finding** referenzieren (SEC-01-Self-Reference weglassen, per 01-RESEARCH.md §Open Questions #2). validation.sh prüft dies (`for req in SEC-02 ... SEC-07; do rg -q "^\| $req "...`).

---

### `.planning/phases/01-security-audit-priorisierung/kopf-review.md` (working-protocol, event-driven)

**Primary analog:** `.planning/codebase/CONCERNS.md` §-Gliederung (für thematische Bereichs-Einteilung)
**Secondary analog:** 01-RESEARCH.md §"Kopf-Review Questionnaire" (Zeilen 448-511) — liefert den fertigen Fragenkatalog als Content.

**Pattern G — Kopf-Review-Struktur:**

```markdown
# Kopf-Review Protokoll — Phase 1 Security Audit

**Session-Datum:** YYYY-MM-DD
**Teilnehmende:** Andi + Claude (via Alice)
**Bezug:** `.planning/phases/01-security-audit-priorisierung/01-RESEARCH.md` §"Kopf-Review Questionnaire"

---

## Bereich A — Apps-Plugin-System

### A.1 — Welche konkrete Sandbox-Mechanik schwebt dir vor ...?

> **Andis Antwort (stichpunktartig, wörtlich protokolliert):**
>
> - …
> - …

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (→ Kandidat-ID: CF-…)
- [ ] Wird Deferred mit Begründung
- [ ] Wird gelöscht mit Begründung: …

### A.2 — Gibt es Apps-Code, der im Hub anders aufgerufen wird als im Bot ...?

> **Andis Antwort:**
> - …

**Claude-Bucket-Zuordnung:** ...
```

**Regeln aus 01-RESEARCH.md §Kopf-Review + §Common Pitfalls:**
1. 8 Bereiche (A-H): Apps-Plugin, Internal-Auth, Session/CSRF, Supply-Chain/Secrets, Upload/Media, Apps-Pipeline, Audit/Logging, Catch-All.
2. Jede Frage bekommt eine `Claude-Bucket-Zuordnung` mit 3 Optionen: **wird Finding / wird Deferred / wird gelöscht** — Pitfall-1-Mitigation gegen Fatigue.
3. Andis Antworten werden **wörtlich** protokolliert (Blockquote), NICHT paraphrasiert → "Fail Loud, Never Fake" aus PROJECT.md.
4. Sprache: Deutsch.

**Vorbild aus existierendem `01-DISCUSSION-LOG.md` (liegt als 7.5 KB im Phase-Dir):** Ähnliche Deutsch-sprachige Q&A-Transkript-Form; `kopf-review.md` schließt stilistisch daran an, behält aber feste `### X.N — Frage?`-Heading-Struktur für grep-barkeit.

---

### `.planning/phases/01-security-audit-priorisierung/validation.sh` (validation-script, batch)

**Primary analog:** `platform/scripts/switch-env.sh` (Zeilen 1-25) — Shebang, Dir-Resolve, Usage-String, Exit-Code-Pattern
**Secondary analog:** `platform/scripts/dev-server-watch.sh` — `#!/bin/bash` + Comment-Header-Stil
**Content source:** 01-RESEARCH.md §"Validation Architecture" (Zeilen 822-868) — liefert die 11 konkreten Check-Commands.

**Pattern H — Skript-Skelett (aus `switch-env.sh` Zeilen 1-7):**

```bash
#!/bin/bash
# Validate .planning/research/01-security-audit.md structural integrity
# Usage: bash .planning/phases/01-security-audit-priorisierung/validation.sh
#
# Exit 0 = all checks pass; Exit 1 = at least one check failed.
# Referenced specs:
#   - .planning/ROADMAP.md §"Phase 1" Success Criteria
#   - .planning/phases/01-security-audit-priorisierung/01-CONTEXT.md §D-06, D-08, D-15

DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$DIR"

AUDIT=".planning/research/01-security-audit.md"
KOPF=".planning/phases/01-security-audit-priorisierung/kopf-review.md"

FAIL=0

check() {
  local label="$1"
  local status="$2"
  if [ "$status" = "PASS" ]; then
    echo "✅ $label"
  else
    echo "❌ $label"
    FAIL=1
  fi
}

# --- SC1: Header metadata present ---
if rg -q '^\*\*Audit-Datum:\*\*' "$AUDIT" 2>/dev/null; then
  check "SC1 Audit-Datum header" PASS
else
  check "SC1 Audit-Datum header" FAIL
fi

# --- SC2: Each finding has all 5 mandatory meta-fields ---
FINDING_COUNT=$(rg -c '^### \[F-' "$AUDIT" 2>/dev/null || echo 0)
for FIELD in "Severity" "Datei-Pfad\(e\)" "Current Mitigation" "Fix-Ansatz" "Target Phase"; do
  FIELD_COUNT=$(rg -c "^- \*\*${FIELD}:\*\*" "$AUDIT" 2>/dev/null || echo 0)
  if [ "$FIELD_COUNT" -ge "$FINDING_COUNT" ]; then
    check "SC2 All findings have ${FIELD}" PASS
  else
    check "SC2 All findings have ${FIELD} (found $FIELD_COUNT / expected ≥ $FINDING_COUNT)" FAIL
  fi
done

# --- SC3: No Critical/High targets v2 or out-of-scope ---
# (invert logic: if any Critical/High block ends with v2/out-of-scope → FAIL)
# ... (weitere Checks folgen demselben Muster)

# --- Exit ---
if [ "$FAIL" = "0" ]; then
  echo ""
  echo "✅ All structural checks passed."
  exit 0
else
  echo ""
  echo "❌ At least one structural check failed."
  exit 1
fi
```

**Vorbild-Pattern aus `switch-env.sh` Zeilen 1-21:**
```bash
#!/bin/bash
# Switch between local and tunnel .env
# Usage: bash scripts/switch-env.sh local|tunnel

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

MODE="${1:-local}"

if [ "$MODE" = "local" ]; then
  cp .env.local .env
  echo "✅ Switched to LOCAL mode (localhost:3000/3003)"
  ...
else
  echo "Usage: $0 local|tunnel"
  exit 1
fi
```

**Regeln / Übernommene Patterns:**
1. **Shebang** `#!/bin/bash` (nicht `#!/usr/bin/env bash` — konsistent mit existierenden `scripts/*.sh`).
2. **Header-Kommentar** mit Zweck + Usage-Zeile (2-3 Zeilen) — identisch zu `switch-env.sh`.
3. **Dir-Resolve** `DIR="$(cd "$(dirname "$0")/../../.." && pwd)"` — 3-Ebenen-Hop, weil das Script in `.planning/phases/01-…/` liegt, `cd`-Ziel ist der Platform-Repo-Root (wo `apps/` und `packages/` stehen); NICHT der Workspace-Root.
4. **Emoji im Output** `✅` / `❌` — aus `switch-env.sh` übernommen.
5. **Exit-Code** 0 = all pass, 1 = at least one fail — Standard-Bash-Pattern, von switch-env.sh Exit 1 bei Usage-Fehler abgeleitet.
6. **Kein `set -e`** — wir wollen ALLE Checks sehen, nicht beim ersten Fehler abbrechen. `FAIL=1`-Accumulator-Pattern stattdessen.

**Content-Mapping (die 11 konkreten Checks aus 01-RESEARCH.md §"Phase Requirements → Test Map", Zeilen 841-854):**

| Validation-Bereich | Source in Research | Shell-Umsetzung |
|--------------------|-------------------|-----------------|
| SC1 (Header + Datum) | Zeile 843 | `rg -q '^\*\*Audit-Datum:\*\*' "$AUDIT"` |
| SC2a-e (5 Pflicht-Meta-Felder pro Finding) | Zeilen 844-848 | Zählcheck `rg -c '^### \[F-' == rg -c '^- \*\*Severity:\*\*'` (pro Feld) |
| SC3a (Severity-Sortierung) | Zeile 849 | Header-Reihenfolge `## 4` Critical vor `## 5` High etc. |
| SC3b (Kein C/H auf v2) | Zeile 850 | Invert-Check: `rg -A10 '\*\*Severity:\*\* (Critical\|High)' \| rg '^\*\*Target Phase:\*\* (v2\|out-of-scope)'` muss leer sein |
| SC4 (Deferred-Section + Begründung) | Zeile 851 | `rg -q '^## 9\.' && rg -A5 '^### \[D-' \| rg -q 'Warum nicht jetzt'` |
| D-13 (Kopf-Review protokolliert) | Zeile 852 | `test -f "$KOPF"` |
| D-15 (OP-Findings mit Class-Tag) | Zeile 853 | `rg -A1 '^### \[OP-' \| rg -q '^- \*\*Class:\*\* Operational'` |
| TRACE (SEC-02..07 alle gedeckt) | Zeile 854 | `for req in SEC-02 SEC-03 SEC-04 SEC-05 SEC-06 SEC-07; do rg -q "^\\\| $req " "$AUDIT" \|\| FAIL=1; done` |

**Fallback:** Falls `rg` im Container fehlt (Assumption A1 aus Research), auf `grep -E` zurückfallen. Planner kann am Skript-Anfang `command -v rg >/dev/null || { echo "ripgrep missing"; exit 2; }` einbauen.

---

### `.planning/REQUIREMENTS.md` (edit, request-response)

**Primary analog:** `.planning/REQUIREMENTS.md` selbst, §Traceability Zeilen 78-94.

**Pattern I — Zeilen-Edit:**

**Vorher (Zeile 80):**
```markdown
| SEC-01 | Phase 1 | Pending |
```

**Nachher (nach Audit-Abschluss in Wave 5):**
```markdown
| SEC-01 | Phase 1 | Done |
```

**Regel:** NUR die SEC-01-Zeile anfassen. Andere Zeilen bleiben `Pending`. Keine weitere Änderung (kein Datum, keine Notes-Spalte) — Tabellen-Struktur ist auf 3 Spalten festgelegt.

**Coverage-Notiz aktualisieren:** Falls der Abschnitt `**Coverage:**` Zeilen (96-99) Zahlen enthält, die sich durch Status-Wechsel ändern — hier bleibt die Coverage-Zählung stabil (SEC-01 bleibt gemappt; nur Status wechselt), also KEINE Änderung an den Coverage-Zeilen.

**Footer-Zeile (Zeilen 102-103) aktualisieren:**
```markdown
*Requirements defined: 2026-04-16*
*Last updated: YYYY-MM-DD after Phase 1 audit completion*
```

---

### `.planning/STATE.md` (edit, CRUD)

**Primary analog:** `.planning/STATE.md` selbst.

**Pattern J — YAML-Frontmatter-Update (Zeilen 1-15):**

**Geänderte Felder:**

```yaml
---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning                        # bleibt „planning" wenn Phase 2 als nächstes startet
stopped_at: Phase 1 audit completed     # NEU (war: "Phase 1 context gathered")
last_updated: "YYYY-MM-DDTHH:MM:SSZ"    # NEU (ISO-8601 UTC)
last_activity: YYYY-MM-DD — Phase 1 abgeschlossen: Security-Audit veröffentlicht (.planning/research/01-security-audit.md)   # NEU
progress:
  total_phases: 8
  completed_phases: 1                   # NEU (war: 0)
  total_plans: <N>                      # NEU: Anzahl Plans, die Phase 1 hatte
  completed_plans: <N>                  # NEU: gleich total_plans, wenn alle durchgelaufen
  percent: 12                           # NEU (1/8 = 12.5 %, gerundet; bei abgeschlossenen Plans entsprechend)
---
```

**Pattern K — Body-Section-Updates:**

1. **§Current Position (Zeilen 26-33):**
   - `Phase: 1 of 8` → `Phase: 2 of 8 (<Name Phase 2>)` falls Phase 2 als nächstes startet; sonst `Phase: 1 of 8 — complete`.
   - `Status: Ready to plan` → `Status: Audit delivered; ready for Phase 2 planning`
   - `Last activity:` → gleiche Zeile wie im Frontmatter
   - Progress-Bar: `[█░░░░░░░░░] 12%`

2. **§Performance Metrics (Zeilen 35-54):**
   - Total plans completed: `<N>` (aus den Phase-1-Plans)
   - Average duration: `<h:m>` (wenn Timer-Daten vorliegen; sonst `—`)
   - Tabelle "By Phase" bekommt eine Zeile `| 1 | <N> | <total> | <avg> |`

3. **§Accumulated Context › Decisions (Zeilen 58-65):**
   - Einen neuen Bullet für Phase-1-Schlussentscheidung anhängen (z.B. "2026-04-XX: Audit publiziert, 6 Critical/High mapping an Phase 2/3/4 bestätigt").

4. **§Session Continuity (Zeilen 83-87):**
   - `Stopped at: Phase 1 audit completed`
   - `Resume file: .planning/phases/02-.../02-CONTEXT.md` (oder leer lassen bis Phase 2 startet)

**Regel:** STATE.md ist die **einzige** Datei in `.planning/` mit YAML-Frontmatter. Frontmatter ist `---`-delimited + canonical YAML-Syntax (no tabs, double-quoted ISO-timestamps). Änderungen müssen beide Orte (Frontmatter + Body) konsistent halten — `last_activity` steht zweimal identisch (Zeile 8 + Zeile 32).

## Shared Patterns

### Sprach-Konvention (gilt für alle Markdown-Outputs von Phase 1)

**Source:** `.planning/PROJECT.md` Zeilen 1-97 (Deutsch); `.planning/codebase/CONCERNS.md` (Englisch, als Kontrast).
**Apply to:** `01-security-audit.md`, `kopf-review.md`.
**Regel:** Fliesstext Deutsch, technische Feldnamen + Code-Schnipsel + Regex + Datei-Pfade Englisch. Quotations aus CONCERNS.md (Englisch) werden nicht übersetzt, sondern als englisches Zitat in den deutschen Fliesstext eingebettet.

Beispiel-Mischung aus 01-RESEARCH.md selbst (Zeile 9):
```markdown
Phase 1 is not a build phase — it is a **structured synthesis** phase.
Die hier gelisteten "Tools" sind reine **Discovery-Instrumente** ...
```

Für Audit-Doc: Konsistent Deutsch. Englisch nur in Meta-Feldnamen (`Severity`, `Current Mitigation`, `Target Phase`) und in Code/Pfaden.

### Meta-Feld-Stil (Bullet mit Fett-Label)

**Source:** `.planning/codebase/CONCERNS.md` Zeilen 51-55; 01-RESEARCH.md Zeile 204-218.
**Apply to:** Jedes Finding, jedes Operational-Item, jedes Deferred-Item.
**Form:** `- **Label:** Value` — Bullet-Dash, Space, zwei Sterne, Label, Doppelpunkt, Leerzeichen, Wert.

**Anti-Pattern (verboten):**
```markdown
## Finding: Foo
Severity: High              ← kein Bullet, kein Fettdruck
Files - Foo                 ← Dash nach Label, kein Doppelpunkt
* **severity**: High        ← Asterisk-Bullet statt Dash, lowercase Label
```

**Korrekt:**
```markdown
### [F-01] Foo
- **Severity:** High
- **Datei-Pfad(e):** `path/to/foo.ts:12`
```

### ID-Schema (sequentielle Prefix-IDs)

**Source:** 01-RESEARCH.md §"Don't Hand-Roll" Zeilen 278-280.
**Apply to:** Alle Finding-Headings im Audit-Doc.
**Schema:**
- `F-01`, `F-02`, … für Security-Findings
- `OP-01`, `OP-02`, … für Operational-Findings
- `D-01`, `D-02`, … für Deferred/Accepted Risks

**Begründung:** Menschen-lesbar, grep-bar, link-bar (zukünftige Phase-2/3/4-Researcher referenzieren `F-03` im Phase-2-Research-Doc).

### "Fail Loud, Never Fake" — keine Weichspülung

**Source:** `.planning/PROJECT.md` Zeile 9 + 105; 01-CONTEXT.md Zeile 118.
**Apply to:** Jedes Finding im Audit. Jede Antwort im Kopf-Review.
**Konkret:**
- `Current Mitigation: keine` MUSS mit einem Satz begründet werden (Pitfall 5).
- Kein Finding wird aus politischen oder ästhetischen Gründen gestrichen — nur nach Severity/Volumen-Regel (D-16).
- Kein Silent-Default in Validation (Validation-Skript schreit laut bei jedem Fehler, setzt aber `FAIL=1` statt `exit 1` früh).

## No Analog Found

Alle 5 Files haben einen direkten Analog in der Codebase oder in den existierenden `.planning/`-Artefakten. Kein einziger Fall von "no analog".

**Spezialfall `validation.sh`:** Die Validation-Skript-Rolle (Bash + ripgrep gegen Markdown-Struktur) existiert in dieser Form **noch nicht** im Repo — aber die Bash-Grundstruktur (Shebang + Dir-Resolve + Usage-Kommentar + `✅/❌`-Output) wird vollständig von `scripts/switch-env.sh` und `scripts/dev-server-watch.sh` getragen. Die 11 Check-Commands selbst stammen aus 01-RESEARCH.md §"Validation Architecture" und müssen NICHT aus einem Analog extrahiert werden.

## Metadata

**Analog search scope:**
- `.planning/codebase/*.md` (7 Dateien — alle gelesen oder verifiziert)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`
- `.planning/phases/01-security-audit-priorisierung/01-*.md` (4 existierende Dateien)
- `platform/scripts/*.sh` (3 Dateien — alle gelesen)

**Files scanned:** 17 analoge Quellen + 4 Research/Context-Inputs = 21 Files
**Pattern extraction date:** 2026-04-16
**Downstream consumer:** `gsd-planner` für die 5 Wave-Plans (Skeleton/Criteria → Grep-Scans → Kopf-Review → Konsolidierung → Phase-Mapping+Traceability).
