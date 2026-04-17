# Phase 4: Supply-Chain & Secrets - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Infrastruktur-Konfiguration und Dependencies haben keine bekannten, unbehandelten Risiken: hardcodierte Credentials raus aus docker-compose.yml, pnpm audit --prod sauber oder Findings dokumentiert, alle 12 pnpm.overrides mit CVE-Zuordnung dokumentiert, Startup-Fail-Check für kritische Tokens.

Nicht in Scope: Neue Infrastruktur-Features, Redis, INFRA-01/02, F-16 (Audit-Logs), nicht-platform Repos.

</domain>

<decisions>
## Implementation Decisions

### Docker Compose — Credentials (F-05, SEC-06)

- **D-01:** Nur echte Secrets werden env-basiert: `POSTGRES_PASSWORD` und alle `DATABASE_URL`-Werte (Zeilen 60, 69, 114). `POSTGRES_USER`, `POSTGRES_DB` und `DATABASE_SSL` bleiben als Defaults im File — sie sind keine Secrets.
- **D-02:** Healthcheck mitfixen: `pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-guildora}` — konsistent, kein Widerspruch bei späterem Rename.
- **D-03:** `platform/.env.example` bekommt einen expliziten Pflicht-Block mit "MUST change before production"-Warnung für `POSTGRES_PASSWORD` und `DATABASE_URL`.

### pnpm Audit Policy (SEC-07)

- **D-04:** Scope: `pnpm audit --prod` — nur Produktions-Dependencies. Dev-CVEs sind kein Produktions-Risiko und dürfen die Phase nicht blockieren.
- **D-05:** Fix-or-document: Jedes High/Critical bekommt einen Fix-Versuch (Upgrade oder Override). Wenn Upstream nicht gepatcht hat und kein Override möglich → als akzeptiertes Risiko in `.planning/research/04-audit-accepted-risks.md` dokumentiert mit Begründung. Medium/Low werden dokumentiert aber nicht gefixt.

### pnpm.overrides Dokumentation (SEC-07)

- **D-06:** Dokumentationsort: `.planning/research/04-overrides-audit.md` — bei den anderen Phase-4-Research-Artifacts, verlinkbar aus SUMMARY.md.
- **D-07:** Pro Override-Eintrag: Paketname, CVE-Nummer (oder "kein CVE — Kompatibilitätspatch"), ob Upstream inzwischen gepatcht hat, ob Override entfernt werden kann. Overrides ohne aktuellen Bedarf werden aus `package.json` entfernt.

### Startup-Fail Token-Check (F-11, SEC-06)

- **D-08:** In Phase 4 enthalten (Audit tagged F-11 als SEC-06 / Phase 4; logischer Abschluss der Secrets-Härtung).
- **D-09:** Check bei Hub-, Bot- und Matrix-Bot-Start: Token ist leer (length 0) ODER enthält bekannte Placeholder-Strings (`replace_with_`, `changeme`, `your_token_here`, `dev-`) → hard-fail mit klarer Fehlermeldung. Betrifft: `BOT_INTERNAL_TOKEN`, `HUB_INTERNAL_TOKEN`, `MCP_TOKEN`.
- **D-10:** "Fail Loud, Never Fake" — kein Silent-Fallback, kein Default-Token. Startup schlägt fehl und erklärt welcher Token fehlt.

### Claude's Discretion
- Exakte Fehlermeldungs-Texte bei Startup-Fail
- Commit-Reihenfolge der Änderungen
- Format des 04-overrides-audit.md innerhalb der vorgegebenen Felder

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit Findings (Phase 4 Scope)
- `.planning/research/01-security-audit.md` §F-05 — Hardcodierte Credentials in docker-compose.yml (Medium, Zeilen 7-9, 60, 61, 69, 114-115)
- `.planning/research/01-security-audit.md` §F-11 — Kein Startup-Fail bei Placeholder-Tokens (Low, SEC-06)
- `.planning/research/01-security-audit.md` §F-12 — pnpm.overrides ohne CVE-Zuordnung (Low, SEC-07)

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 4 — Success Criteria (4 Punkte)
- `.planning/REQUIREMENTS.md` §SEC-06, §SEC-07

### Betroffene Dateien
- `platform/docker-compose.yml` — Zeilen 7-9, 15, 60-61, 69, 114-115
- `platform/.env.example` — DB-Sektion ergänzen
- `platform/package.json` — pnpm.overrides (12 Einträge)
- `platform/apps/hub/server/plugins/` — Token-Initialisierung
- `platform/apps/bot/src/index.ts` — Startup-Check
- `platform/apps/matrix-bot/src/index.ts` — Startup-Check

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/apps/hub/server/utils/internal-auth.ts` — `requireInternalToken()` wirft 503 wenn Token leer; Startup-Check folgt demselben "Fail Loud"-Muster, nur früher (Process-Start statt Request-Time)
- `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` — Phase-3-Fix: `if (!token || token.length === 0)` → 503; Startup-Check ist das Analogon auf Prozess-Ebene

### Established Patterns
- "Fail Loud, Never Fake" — durchgängiges Projekt-Prinzip, Phase 2+3 haben es auf Request-Ebene umgesetzt; Phase 4 bringt es auf Config-Ebene
- `platform/.env.example` hat bereits Sektions-Struktur mit Dash-Trennern — neue DB-Sektion folgt dem bestehenden Format

### Integration Points
- docker-compose.yml: `${VAR:-default}` oder `${VAR}` Syntax für env-Substitution
- Bot/Matrix-Bot Startup: `src/index.ts` — Token wird früh aus `process.env` gelesen

</code_context>

<specifics>
## Specific Ideas

- Placeholder-Strings für Startup-Check: `replace_with_`, `changeme`, `your_token_here`, `dev-` (Präfix)
- `.env.example` Warnung-Formulierung: explizit "⚠ MUST change before production — default is insecure"
- Overrides die vermutlich entfernt werden können: prüfen ob `serialize-javascript`, `node-forge`, `postcss` inzwischen upstream gepatcht sind

</specifics>

<deferred>
## Deferred Ideas

- **F-16 (Audit-Logs für Security-Events)** — Audit tagged als Phase 4, Roadmap-Criteria erwähnen es nicht. Defer auf v2 oder Phase 5 Backlog.
- **DATABASE_SSL parametrisieren** — User entschied: bleibt als Default im File, kein env-Var.
- **`pnpm audit` ohne --prod** — Dev-CVEs werden nicht in dieser Phase behandelt.
- **Mindestlängen-Check für Tokens** — nur leer + Placeholder, keine Längen-Validation.

</deferred>

---

*Phase: 04-supply-chain-secrets*
*Context gathered: 2026-04-17*
