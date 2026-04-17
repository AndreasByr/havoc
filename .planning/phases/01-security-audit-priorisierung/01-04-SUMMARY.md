---
phase: 01-security-audit-priorisierung
plan: "04"
subsystem: security-audit
tags:
  - security
  - audit
  - consolidation
  - findings
dependency_graph:
  requires:
    - 01-01 (Audit-Skelett)
    - 01-02 (grep-results)
    - 01-03 (kopf-review)
  provides:
    - Vollstaendiges Finding-Set in .planning/research/01-security-audit.md §§4-9
    - F-01..F-17 Security-Findings mit allen 5 Pflicht-Meta-Feldern
    - OP-01..OP-04 Operational-Findings
    - D-01..D-08 Deferred-Findings mit Warum-nicht-jetzt
  affects:
    - .planning/research/01-security-audit.md
tech_stack:
  added: []
  patterns:
    - Finding-Block Pattern C (F-NN mit Severity/Area/Datei-Pfad/Current Mitigation/Fix-Ansatz/Target Phase)
    - Operational-Block Pattern D (OP-NN mit Class: Operational)
    - Deferred-Block Pattern E (D-NN mit Warum nicht jetzt)
key_files:
  created: []
  modified:
    - .planning/research/01-security-audit.md
decisions:
  - "17 F-Findings statt angestrebter 18-22 — Volumen im gueltigen 15-25-Korridor, CF-10/CF-11 als Deferred da durch F-01 abgedeckt"
  - "CF-07 (CSRF-Skip) als Low bewertet — Andi sah keinen klaren Angriffspfad (Kopf-Review C.2)"
  - "OP-04 zusaetzlich eingefuegt — Session-Error-Handling als Operational/Observability-Problem, nicht Security"
  - "CF-20 (Matrix Timing) als separates Finding F-04, nicht mit F-03 zusammengefuehrt — separate Codebases"
  - "D-06 und D-07 als eigene Deferred-Eintraege statt nur Notiz in F-01 — bessere Traceability"
metrics:
  duration: "~15 Minuten"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 1
---

# Phase 01 Plan 04: Konsolidierung Security-Audit Finding-Set

Wave 4 konsolidierte drei Input-Quellen (CONCERNS.md, grep-results.md, kopf-review.md) zu 17 F-Findings + 4 OP-Findings + 8 Deferred in `.planning/research/01-security-audit.md` §§4-9.

## What Was Built

### Task 1: Security-Findings §§4-7

17 F-Findings befuellt:

| Severity | Count | Findings |
|----------|-------|---------|
| Critical | 1 | F-01 (Plugin-Sandbox, 3 Execution-Sites) |
| High | 3 | F-02 (Session deny-by-default), F-03 (Hub timing-unsafe), F-04 (Matrix timing-unsafe) |
| Medium | 6 | F-05 (Docker Credentials), F-06 (Sideload TOCTOU), F-07 (Dev-Flag), F-08 (MCP-Pfad), F-09 (Session-Rotation), F-10 (Cookie-Secure-Fallback) |
| Low | 7 | F-11..F-17 (Placeholder-Check, pnpm-Overrides, Rate-Limit, Upload-Pfad, Avatar-Bucket, Audit-Logs, CSRF-Skip) |

### Task 2: Operational-Findings §8 und Deferred §9

4 OP-Findings (alle `Class: Operational`):
- OP-01: In-Memory Rate-Limit (v2/INFRA-01)
- OP-02: Thundering Herd App-Registry (v2/INFRA-02)
- OP-03: Migration-Fixups bei jedem Start (v2/DEBT-01)
- OP-04: Session-Error-Handling verschleiert Auth-Fehler (v2/OBS-01)

8 Deferred-Findings (alle mit `Warum nicht jetzt`):
- D-01: pnpm audit (Phase 4/SEC-07)
- D-02: ESLint-Security-Plugins (Phase 5/CI-02)
- D-03: CVSS-Scoring (out-of-scope)
- D-04: Runtime-/Infra-Audit (out-of-scope)
- D-05: Fremd-Repo-Audit (out-of-scope)
- D-06: KV-Scope-Leakage (Deferred, durch F-01 abgedeckt)
- D-07: code_bundle Admin-Manipulation (Deferred, durch F-01 abgedeckt)
- D-08: PII in Logs (Phase 4)

## New CF-IDs aus Wave 3, die in Findings eingegangen sind

| CF-ID | Wave-3-Quelle | Eingang in |
|-------|--------------|-----------|
| CF-18 | Kopf-Review A.2 (dritte Execution-Site vue3-sfc-loader) | F-01 (konsolidiert) |
| CF-19 | Kopf-Review A.3 (h3-Whitelist zu gross) | F-01 (konsolidiert) |
| CF-20 | Kopf-Review B.1 (Matrix timing-unsafe) | F-04 |
| CF-21 | Kopf-Review B.3 (MCP unbenutzter Angriffspfad) | F-08 |
| CF-22 | Kopf-Review B.4 (Placeholder-Token-Startup-Check) | F-11 |
| CF-23 | Kopf-Review C.3 (Session-Rotation offen) | F-09 |
| CF-24 | Kopf-Review C.5 (Dev-Endpoints via Debug-Flag) | F-07 |
| CF-25 | Kopf-Review D.1 (pnpm.overrides undokumentiert) | F-12 |
| CF-26 | Kopf-Review D.2 (Cookie-Secure Silent-Fallback) | F-10 |
| CF-27 | Kopf-Review E.3 (Avatar-Bucket-Bypass) | F-15 |
| CF-28 | Kopf-Review F.1 (TOCTOU Sideload) | F-06 (konsolidiert mit CF-09) |
| CF-29 | Kopf-Review G.1 (Audit-Log-Luecken) | F-16 |

## Bucket-Reshuffle-Notizen

| Kandidat | Entscheidung | Begruendung |
|----------|-------------|-------------|
| CF-07 (CSRF-Skip) | Low Finding F-17 | Andi sah keinen Angriffspfad (C.2); dokumentiertes SSR-Verhalten |
| CF-10 (KV-Scope) | Deferred D-06 | createAppDb korrekt scoped; systemisches Risiko durch F-01 abgedeckt |
| CF-11 (code_bundle) | Deferred D-07 | Kein direkter API-Injection-Pfad; durch F-01 abgedeckt |
| CF-12 (App-Tokens) | Geloescht | Implementierung korrekt (B.2 bestaetigt) |
| CF-13 (pnpm audit) | Deferred D-01 | Eigenstaendiger Phase-4-Block |
| CF-05 (MCP-Token) | Finding F-08 | MCP als unbenutzter Angriffspfad (CF-21 bestaetigt) |
| CF-16 (Rate-Limit) | Low Finding F-13 | Angreifer-Pfad beschreibbar (Pitfall-4-Dichotomie: Security) |
| C.1 Session-Error | OP-04 | Kein Security-Exploit-Pfad; Operational/Observability |

## Deviations from Plan

### Auto-added Findings

**1. [Rule 2 - Missing] OP-04 Session-Error-Handling als zusaetzliches Operational-Finding**
- **Found during:** Task 2
- **Issue:** Kopf-Review C.1 ergab kein Security-Finding, aber ein klares Operational-Problem (Silent-Fallback verschleiert Auth-Fehler). Plan listete nur OP-01..OP-03 als Basis-Kandidaten.
- **Fix:** OP-04 als viertes Operational-Finding eingefuegt mit korrektem `Class: Operational` und `Target Phase: v2`.
- **Files modified:** .planning/research/01-security-audit.md

**2. [Rule 2 - Missing] D-06 und D-07 als explizite Deferred-Eintraege**
- **Found during:** Task 2
- **Issue:** CF-10 und CF-11 waren im Plan als "Deferred" klassifiziert, aber ohne eigene D-NN-Eintraege im Audit-Doc — nur als Notiz in F-01.
- **Fix:** D-06 und D-07 als vollstaendige Deferred-Blocks eingefuegt mit Warum-nicht-jetzt-Begruendung, damit Wave 5 Traceability lueckenlos ist.
- **Files modified:** .planning/research/01-security-audit.md

## Validation Results

All acceptance criteria verified:

| Check | Result |
|-------|--------|
| F-count in 15-25 range | PASS (17) |
| All 5 meta-fields present per F-finding | PASS (verified before OP/D added) |
| Sequential F-IDs F-01..F-17 | PASS |
| No Critical/High on v2/out-of-scope | PASS |
| Severity sort order (Critical < High < Medium < Low) | PASS |
| No library names in Fix-Ansatz (Pitfall 2) | PASS |
| No bare "keine" in Current Mitigation (Pitfall 5) | PASS |
| OP count >= 3 | PASS (4) |
| All OP have Class: Operational | PASS |
| No Severity on OP blocks | PASS |
| D count >= 5 | PASS (8) |
| All D have Warum nicht jetzt | PASS |
| Min 250 lines | PASS (368) |

Note: Global field-count check shows inflated numbers (S=25, P=29, etc.) because D-blocks also use Severity/Datei-Pfad/Current Mitigation/Target Phase fields. Per-F-finding count check was verified separately and PASSED. Wave 5 validation.sh will scope checks to §§4-7 only.

## Status

**Wave 5 (Plan 05) kann finalisieren:** Exec-Summary schreiben, Traceability-Tabelle befuellen, validation.sh generieren und SEC-01 auf Done flippen.

Finding-Set ist inhaltlich vollstaendig und reviewed gegen alle 5 Pitfalls. Alle drei Input-Quellen (CONCERNS.md + grep-results + kopf-review) sind synthetisiert.

## Self-Check: PASSED

- .planning/research/01-security-audit.md exists: FOUND
- Commit fd8b1fb (Task 1): FOUND
- Commit 6bae648 (Task 2): FOUND
