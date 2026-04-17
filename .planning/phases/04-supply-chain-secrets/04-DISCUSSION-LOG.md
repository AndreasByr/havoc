# Phase 4: Supply-Chain & Secrets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 04-supply-chain-secrets
**Areas discussed:** Docker-Compose-Scope, pnpm-Audit-Policy, Overrides-Dokumentation, F-11 Startup-Fail-Scope

---

## Docker-Compose-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nur Secrets | POSTGRES_PASSWORD + DATABASE_URL env-basiert; POSTGRES_USER/DB/SSL bleiben | ✓ |
| Alles parametrisieren | Alle Vars inkl. POSTGRES_USER, DB, SSL | |
| Nur POSTGRES_PASSWORD + URL | Minimaler Ansatz | |

**Healthcheck:**

| Option | Selected |
|--------|----------|
| Mitfixen: pg_isready -U ${POSTGRES_USER:-postgres} | ✓ |
| Stehenlassen | |

**env.example:**

| Option | Selected |
|--------|----------|
| Pflicht-Block mit "MUST change before production"-Warnung | ✓ |
| Kommentar ohne Warnung | |
| Separates SECURITY.md | |

**Notes:** User wählte konsistent den scope-minimalen Ansatz für Credentials (nur echte Secrets) aber vollständige Konsistenz beim Healthcheck.

---

## pnpm-Audit-Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix-or-document | Fix-Versuch, dann dokumentieren wenn Upstream nicht gepatcht | ✓ |
| Fix-only | Keine Akzeptanz, kann Phase blockieren | |
| Document-first | Erstmal alles dokumentieren, nur Criticals müssen gefixt sein | |

**Scope:**

| Option | Selected |
|--------|----------|
| --prod (nur Produktions-Dependencies) | ✓ |
| Ohne Flag (alle inkl. devDependencies) | |

---

## Overrides-Dokumentation

| Option | Description | Selected |
|--------|-------------|----------|
| .planning/research/ | 04-overrides-audit.md bei Phase-4-Artifacts | ✓ |
| docs/security/ im Repo | Sichtbarer für externe Contributor | |
| Kommentar-JSON-Wrapper | overrides-comments.json | |

**Inhalt:**

| Option | Selected |
|--------|----------|
| CVE + Upstream-Status (Name, CVE, ob Upstream gepatcht, ob entfernbar) | ✓ |
| Nur Entscheidung (beibehalten/entfernen) | |
| Vollständige Auswertung (CVSS, Angriffspfad etc.) | |

---

## F-11 Startup-Fail-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| In Phase 4 drin | Logischer Abschluss der Secrets-Härtung | ✓ |
| Defer auf Phase 5 oder v2 | Weniger Scope, F-11 ist Low-Severity | |

**Token-Check:**

| Option | Selected |
|--------|----------|
| Leer + Placeholder-Strings (replace_with_, changeme, your_token_here, dev-) | ✓ |
| Nur leer | |
| Leer + Mindestlänge (32 Zeichen) | |

---

## Claude's Discretion

- Exakte Fehlermeldungs-Texte beim Startup-Fail
- Commit-Reihenfolge der Änderungen
- Format von 04-overrides-audit.md (innerhalb der definierten Felder)

## Deferred Ideas

- F-16 (Audit-Logs für Security-Events) — defer auf v2/Phase 5
- DATABASE_SSL parametrisieren — bleibt als Default im File
- pnpm audit ohne --prod — Dev-CVEs nicht in dieser Phase
- Mindestlängen-Check für Tokens — nur leer + Placeholder, keine Längen-Validation
