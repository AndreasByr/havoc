# Phase 1: Security Audit & Priorisierung — Research

**Researched:** 2026-04-16
**Domain:** Security audit document production (no code changes; pure documentation phase)
**Confidence:** HIGH

## Summary

Phase 1 is not a build phase — it is a **structured synthesis** phase. The work is mechanical: take the already-written findings in `CONCERNS.md`, extract Andi's undocumented "im-Kopf" reviews via a guided questionnaire, run five targeted grep/ripgrep passes to catch stragglers, and assemble everything into `.planning/research/01-security-audit.md` using a fixed per-finding heading template. The planner should treat this phase as a **pipeline of artefacts**, not a discovery expedition.

The hardest part is **discipline, not depth**: staying inside the 15–25 finding budget, honouring the Operational-vs-Security split, and refusing to slip into Phase 2+ fix-brainstorming. The second-hardest part is making the audit **grep-addressable** so Phase 2/3/4 researchers can pull "all Phase 3 findings" mechanically.

**Primary recommendation:** Build the plan as five waves: (1) skeleton/criteria, (2) grep catalog, (3) Kopf-Review questionnaire execution with Andi, (4) finding consolidation + severity assignment, (5) Phase-mapping + deferred section + exec summary. Each wave produces one commit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audit-Output-Form & -Ort:**
- **D-01:** Primäres Audit-Dokument lebt in `.planning/research/01-security-audit.md` (neu angelegt). `CONCERNS.md` wird NICHT als Haupt-Doc erweitert — bleibt reine Codebase-Snapshot-Analyse vom 2026-04-15.
- **D-02:** Format: Markdown mit strukturierter Heading-Konvention pro Finding (nicht Tabelle, nicht JSON+MD-Split). Jedes Finding = eine `###`-Section, damit Phase-2/3/4-Researcher einzelne Findings linkbar referenzieren können.
- **D-03:** Gruppierung: Severity zuerst (Critical → High → Medium → Low), innerhalb jedes Severity-Blocks nach Bereich (Apps-Plugin, Auth/Session, Supply-Chain, etc.).
- **D-04:** Primäre Zielgruppe: Claude-Builder in Phase 2/3/4 + Andi im Planning-Modus. NICHT für externe Reviewer formatieren — keine CVSS-Vektoren, kein CWE-Mapping.

**Severity-Schema & Finding-Metadaten:**
- **D-05:** Severity-System: Qualitativ C/H/M/L mit Kriterien-Definition am Anfang des Dokuments.
  - **Critical:** Unauthenticated Remote-Code-Execution, Zugriff auf alle User-Daten oder Secrets durch externen Angreifer ohne Nutzerbeteiligung.
  - **High:** Privilege-Escalation für authenticated User, Data-Leak einzelner User, Timing-/Info-Leaks mit direktem Angriffsweg.
  - **Medium:** Schwächen, die zusätzliche Voraussetzungen brauchen (innerer Netzzugriff, kompromittierte Apps), oder Härtungs-Lücken ohne direkten Exploit.
  - **Low:** Defense-in-Depth, Best-Practice-Abweichungen ohne bekannten Exploit-Pfad.
- **D-06:** Pflicht-Metadaten pro Finding: `Datei-Pfad(e)`, `Fix-Ansatz`, `Current Mitigation` (required, auch wenn "keine"), `Target Phase` (`Phase 2` / `Phase 3` / `Phase 4` / `v2` / `out-of-scope`). Jedes Critical/High MUSS auf Phase 2–4 zeigen.
- **D-07:** Optional: `Discovered-By`. CWE/CVE-Referenzen weglassen.
- **D-08:** Accepted Risks / Deferred in eigenem Abschnitt am Ende des Dokuments, mit Begründung pro Item.
- **D-09:** Severity = Restrisiko (nach Current Mitigation), nicht Maximum.

**Discovery-Tiefe:**
- **D-10:** Scan-Breite: CONCERNS.md + Andis Kopf-Reviews + gezielte grep/ripgrep-Scans. KEIN Null-Punkt-Re-Audit.
- **D-11:** Pattern-Liste für grep-Scans (Planner finalisiert — Kategorien: Token-Vergleiche, Code-Execution, Hardcoded Secrets, Auth-Guards, Unsafe-HTML).
- **D-12:** Nur manuelle grep/ripgrep-Scans. KEIN neues Tooling (`eslint-plugin-security` → Phase 5). `pnpm audit` out-of-scope für Phase 1 — sein Ergebnis wird in Phase 4 gezogen.
- **D-13:** Kopf-Review-Extraktion: strukturierte Abfrage-Runde für Andi (Checkliste-Prompt statt freie Assoziation).

**Boundaries:**
- **D-14:** Out-of-Scope — explizit im Dokument markieren: Code ausserhalb `platform/` (marketplace, guildai, voice-rooms, app-template, Workspace-Root), Runtime/Infrastruktur (Docker-Daemon, Cloudflare-Tunnel, Host-Härtung).
- **D-15:** In-Scope, aber separat klassifiziert: Performance/DoS/Operational → "Operational" markieren, nicht als Security-Severity.
- **D-16:** Volumen-Ziel: ~15-25 Findings, jeweils ~10-20 Zeilen. Bei Überschreitung: schwächste Lows nach v2 schieben.

### Claude's Discretion
- Exakter Regex + gescannte Directories für jede grep-Pattern-Klasse → dieser Researcher/Planner definiert.
- Genaue Formulierung von Andis Kopf-Review-Abfrage-Prompt → dieser Researcher/Planner gestaltet.
- Reihenfolge der Findings innerhalb eines Severity+Bereich-Blocks → nach Claude-Judgement.
- Executive-Summary am Doc-Anfang: ja, kurz (3-5 Zeilen).

### Deferred Ideas (OUT OF SCOPE)
- ESLint-Security-Plugins (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`) → Phase 5.
- `pnpm audit`-Lauf + Auflösung → Phase 4.
- CVSS-Scoring oder externes Review-Format.
- Runtime-/Infrastruktur-Audit (Docker-Daemon-Config, Cloudflare-Tunnel-Härtung, Host-OS).
- Audit von marketplace/guildai/voice-rooms/app-template.
- Re-Audit-Kadenz (quartalsweise o.ä.).
- Sign-off-Prozess.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Konsolidiertes Security-Audit des `platform/`-Stacks existiert, nach Severity priorisiert; Andis bisher-im-Kopf-Reviews sind in `.planning/research/` verfügbar | Dieses Dokument liefert: (a) fertigen Finding-Inventar aus CONCERNS.md + Codebase-Stichproben → `Candidate Finding Inventory`, (b) verifizierte Grep-Pattern-Liste als konkrete Befehle → `Grep Pattern Catalog`, (c) Kopf-Review-Fragenkatalog für Andi → `Kopf-Review Questionnaire`, (d) exaktes Audit-Doc-Skelett → `Audit Document Skeleton`, (e) Finding → Phase-Mapping-Erstentwurf → `Proposed Finding → Phase Mapping`, (f) Validation-Architecture für Nyquist → `Validation Architecture`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Agent läuft bereits im `alice-bot` Docker-Container — keine `docker`-Befehle, keine SSH-Tunnel, Ports nicht ändern.
- **Scope:** Änderungen nur innerhalb `platform/` (dies ist ein Nur-Dokumentations-Phase; Audit darf aber `platform/`-interne Code-Pfade referenzieren).
- **"Fail Loud, Never Fake":** Keine stillen Sec-Fallbacks. Wenn eine Mitigation löchrig ist, explizit benennen — nicht weichspülen.
- **Sprache:** Audit-Doc Deutsch (folgt PROJECT.md), technische Feldnamen + Code-Snippets Englisch.
- **GSD-Workflow:** Jede Änderung läuft durch einen GSD-Command — für Phase 1 ist das `/gsd-execute-phase` mit den pro-Wave-Tasks, die der Planner schreibt.
- **Apps-Freigabe:** Das Apps/Plugin-System DARF im Audit analysiert werden (explizite Freigabe aus PROJECT.md entgegen SOUL.md-Default).
- **Compat:** Hub↔Bot Internal-HTTP-Sync-Contract bleibt Pflichtbegriff — Audit darf Contract-Schwächen benennen, aber nicht "Vertrag brechen" vorschlagen.

## Architectural Responsibility Map

Dies ist eine Dokumentations-Phase — es wird kein Code zwischen Schichten platziert. Die Map zeigt, welche architektonischen Tiers die Findings **betreffen**, damit der Planner das Audit nach Tier-Betroffenheit gegenchecken kann.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audit-Dokument-Produktion | `.planning/research/` (Markdown) | — | Reines Doc-Artefakt, kein Runtime-Tier |
| Finding-Quelle: Plugin-Sandbox | API / Bot (gemeinsam) | `packages/app-sdk` | `new Function()` existiert parallel in Hub-API und Bot; Sandbox berührt beide Tiers identisch — muss im Audit als Paar-Finding erscheinen |
| Finding-Quelle: Internal-Auth | API (Hub) | Bot (internal-sync-server) | Hub-Seite prüft MCP-Token, Bot-Seite prüft Bot-Token — inkonsistent (Hub `!==`, Bot `timingSafeEqual`) |
| Finding-Quelle: Session-Middleware | API (Hub) | — | `03-session.ts` hängt nur an `event.context`, enforcement liegt in jedem Handler — pure Backend-Concern |
| Finding-Quelle: Docker-Secrets | CDN/Infra (Compose) | API + Bot (env-Lesing) | Hartcoded `postgres:postgres` im Compose-File; betrifft alle Container, die DATABASE_URL konsumieren |
| Finding-Quelle: Uploads | API (Hub) | Storage (S3/FS) | `readMultipartFormData` + `writeFile` in avatar.put.ts, upload.post.ts — Filename-Sanitization + Size-Limit + MIME-Allowlist vorhanden (zu verifizieren für Audit) |
| Finding-Quelle: Unsafe HTML | Browser / Client (Vue) | API (sanitize.ts) | `v-html` in `apps/web/app/pages/[slug].vue` IST sanitisiert; `innerHTML` in `packages/motion` ist Text-Split (nicht user-controlled) — Audit muss das explizit clearen |

## Standard Stack

> Phase 1 ist Nur-Dokumentation — es werden keine Libraries installiert. Die hier gelisteten "Tools" sind reine **Discovery-Instrumente**, die bereits im Container verfügbar sind.

### Core Discovery-Tools (bereits verfügbar)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `ripgrep` (`rg`) | assumed ≥13 | Pattern-Scan über `platform/` | Schneller und gitignore-aware; Standard-Tool in modernen Codebase-Audits |
| `grep` | GNU | Fallback für unsupported Regex-Features | Portable baseline |
| `git log` / `git blame` | 2.x | Kontext für Findings (wann eingeführt, letzter Touch) | Verknüpft Finding mit PR/Commit |
| `jq` | assumed | Optional: JSONB-Extraktion aus DB (für installedApps-Inspektion) | Nur falls Finding DB-Inspektion braucht — wahrscheinlich nicht |

**Verification:** Kein `npm install` nötig. Die Planner-Task sollte mit `rg --version` und `grep --version` eine kurze Sanity-Prüfung machen.

### Supporting: Audit-Doc-Struktur-Referenzen

| Resource | Purpose | When to Use |
|----------|---------|-------------|
| `.planning/codebase/CONCERNS.md` | Rohinput: 4 Security-Findings + Operational-Kandidaten | Wave 4 (Konsolidierung) |
| `.planning/REQUIREMENTS.md` SEC-02…SEC-07 | Ziel-Taxonomie für Phase-Mapping | Wave 5 (Phase-Mapping) |
| `.planning/codebase/CONCERNS.md` Style (`###` mit `Files:`/`Impact:`/`Fix approach:`) | Heading-Konvention — wir schliessen daran an, erweitern um `Severity`/`Target Phase`/`Current Mitigation` | Wave 1 (Skeleton) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure Markdown per D-02 | JSON-Finding-Inventory + Markdown-Render | D-02 lehnt JSON+MD-Split explizit ab. JSON würde zwar tool-bar sein, aber die Zielgruppe "Claude-Builder" liest Markdown atomar — JSON wäre Lesehürde ohne Mehrwert in einem Solo-Projekt. |
| `ripgrep` für Scans | `sourcegraph` / CodeQL | Würde neues Tooling + Setup bedeuten — durch D-12 ausgeschlossen. |
| Severity C/H/M/L qualitativ | CVSS-Vektoren | Durch D-04 explizit ausgeschlossen (kein externer Reviewer-Prozess). |

**Version verification:** Nicht anwendbar — dies ist eine Doc-Phase, keine Dependency-Installation.

## Architecture Patterns

### Audit-Produktions-Pipeline (Data-Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 1 Production Pipeline                 │
└─────────────────────────────────────────────────────────────────┘

  CONCERNS.md (existing)                Andi's head-reviews
        │                                    │
        │                                    │ (Kopf-Review
        │                                    │  Questionnaire
        │                                    │  → recorded
        │                                    │  answers)
        ▼                                    ▼
  [Wave 4: Finding Consolidation]─────◀──────┘
        │                 ▲
        │                 │
        │         ripgrep/grep scans
        │         (5 pattern classes)
        │                 │
        │         [Wave 2: Grep Catalog
        │          Execution → delta
        │          findings]
        │                 │
        ▼                 │
  [Wave 4: Severity        Severity
   Assignment per D-05]◀──criteria block
        │
        ▼
  [Wave 5: Phase Mapping per D-06
   — every C/H maps to Phase 2/3/4;
   deferred gets justification]
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  .planning/research/01-security-audit.md │
  │  ├── Exec Summary                       │
  │  ├── Severity Criteria                  │
  │  ├── Scope & Out-of-Scope               │
  │  ├── Critical findings   (### blocks)   │
  │  ├── High findings       (### blocks)   │
  │  ├── Medium findings     (### blocks)   │
  │  ├── Low findings        (### blocks)   │
  │  ├── Operational (tagged, separate)     │
  │  └── Deferred / Accepted Risks          │
  └─────────────────────────────────────────┘
        │
        ▼
  SEC-01 Traceability-Row → Done in REQUIREMENTS.md
```

**Reader's guide:** Pipeline läuft strikt links-nach-rechts, oben-nach-unten. Jede Wave schreibt in eine temporäre Arbeitsdatei, die erst in Wave 5 zum finalen Audit-Dokument verschmolzen wird. Der Planner kann Waves 2 und 3 parallelisieren (Grep-Scans hängen nicht an Andis Kopf-Review).

### Recommended Artefact Structure

```
.planning/
├── phases/01-security-audit-priorisierung/
│   ├── 01-CONTEXT.md                 # existing — user decisions (read-only)
│   ├── 01-RESEARCH.md                # this file
│   ├── 01-PLAN.md                    # planner produces
│   ├── 01-VALIDATION.md              # Nyquist coverage map
│   └── 01-DISCUSSION-LOG.md          # existing — transcript
└── research/                         # NEW — created by Phase 1
    └── 01-security-audit.md          # THE AUDIT (D-01 mandated location)
```

### Pattern 1: Finding-Block-Template

**What:** Fixed Markdown heading template for each `###` finding block.
**When to use:** Every finding in the audit uses this exact shape — no exceptions, no variants.
**Example:**

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

**Rationale:** 9 Zeilen Fliesstext + 1 Heading = 10 Zeilen → matcht D-16-Untergrenze. Bei komplexeren Findings dehnt sich `Current Mitigation` / `Fix-Ansatz` aus auf 15–20 Zeilen.

### Pattern 2: Operational-Block-Template (D-15)

**What:** Separate heading-tag für Performance/DoS/Operational-Items, die trotzdem im selben Dokument landen.
**When to use:** Findings aus `CONCERNS.md §"Performance Bottlenecks"` + `§"Tech Debt"`, die keinen Security-Exploit-Pfad haben, aber "Fail Loud"-Stabilitätswert haben.
**Example:**

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

**Rationale:** `Class: Operational` statt `Severity:` → visueller Unterschied für den Scanner-Leser, dass das NICHT in die Security-Priorisierungs-Summe reinzählt.

### Pattern 3: Deferred-Block-Template (D-08)

**What:** Eigene Sektion am Doc-Ende. Jedes Item hat Pflicht-Feld `Warum nicht jetzt`.
**When to use:** Low-Severity-Findings, die bewusst in die v2-Bucket geschoben werden, UND Findings, die aufgedeckt wurden aber in keiner Phase 2–4 landen.
**Example:**

```markdown
### [D-02] Fehlender `pnpm audit`-Lauf

- **Severity:** Low (Defense-in-Depth)
- **Area:** Supply-Chain
- **Datei-Pfad(e):** — (Prozess-Lücke, nicht Code)
- **Current Mitigation:** 12 `pnpm.overrides` in `platform/package.json` decken
  bekannte CVE-Patches ab (serialize-javascript, undici, node-forge, h3, srvx, postcss, …).
- **Warum nicht jetzt:** `pnpm audit`-Durchlauf + Finding-Auflösung ist als eigener
  Phase-4-Arbeitsblock (SEC-07) geplant. Ein Audit-Lauf HIER würde Arbeit
  duplizieren und Phase 1 aus dem Volumen-Budget (15–25 Findings) schieben.
- **Target Phase:** Phase 4 (SEC-07)
```

### Anti-Patterns to Avoid

- **Severity-Inflation:** "Alle Findings sind Critical, weil die Platform ja noch nicht sauber ist." → Severity muss Restrisiko messen, nicht Frust. Enforce D-05-Kriterien beim Assignment.
- **Fix-Ausarbeitung:** `Fix-Ansatz` ist **ein Satz** ("use `crypto.timingSafeEqual`"), nicht ein Implementierungs-Plan. Tiefe Fix-Arbeit gehört in Phase-2/3/4-Research.
- **Raw-Severity-Reporting (= D-09 ignorieren):** "Plugin-Sandbox = Critical weil fremder Code läuft" ohne zu prüfen, was `require()`-Block + Role-Check heute kleinhalten. Immer Restrisiko nach Mitigation.
- **Phase-Leakage:** Audit-Finding enthält Satz "und wir sollten isolated-vm verwenden". → Nein. Das ist Phase-2-Entscheidung. Audit sagt nur "Sandbox fehlt, Fix-Ansatz: echte Isolation (Tech offen)".
- **Operational als Security-Severity:** Rate-Limit-Memory-Issue als "Medium" klassifizieren → würde Phase-Priorisierung verzerren. D-15 enforce.
- **Undokumentierte "keine"-Mitigation:** Feld `Current Mitigation` leer lassen ist verboten. Wenn es wirklich keine gibt → "Current Mitigation: keine — Finding ist ungemildert" ausdrücklich schreiben.
- **Zu viele Lows:** Jeder Low, der keinen konkreten Fix-Ansatz hat, ist ein Kandidat zum Streichen oder Deferren (D-16 Volumen-Budget).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity-Skala | Eigenes Scoring-System erfinden | D-05 Kriterien-Block verbatim | Subjektivität sonst unvermeidbar |
| Finding-IDs | UUIDs oder Hash-basierte IDs | Sequenzielle `F-01`, `F-02`, … + `OP-01` für Operational + `D-01` für Deferred | Menschen-les-/link-bar; Audit ist statisch und wird nicht durch ein Tool geschrieben |
| Metadata-Format | YAML-Frontmatter pro Finding | Markdown-Bulletlist (siehe Pattern 1) | D-02 lehnt JSON/YAML-Split explizit ab; Bullets sind grep-bar |
| Grep-Result-Pipeline | Shell-Skript, das Findings auto-generiert | Manuelle Inspektion der Scan-Ergebnisse durch Claude | False-Positive-Raten sind zu hoch für Auto-Generierung (siehe Grep Pattern Catalog unten) |
| Phase-Mapping-Logik | Regel-Engine | Tabelle in Doc + Begründung in Finding-Block | Statische Zuordnung, 7 Requirements — Tabelle reicht |
| CSRF-Middleware-Review | Eigenen CSRF-Test bauen | Existierendes `02-csrf-check.ts` lesen und dokumentieren | Phase 1 analysiert, Phase 3 ändert |

**Key insight:** In einer Doc-Phase gibt es nichts zu "bauen" — jeder Impuls, ein Tool/Skript/Hilfs-Struktur zu erfinden, ist Scope-Creep. Der einzige Build ist die `.md`-Datei selbst.

## Grep Pattern Catalog

**Konkrete, ausführbare ripgrep-Befehle für die 5 Pattern-Klassen aus D-11.** Jeder Befehl ist direkt copy-paste-tauglich in eine Planner-Task.

Alle Befehle laufen vom Repo-Root (`/home/andreas/workspace/guildora/platform`) — das hält den Scope auf `platform/` (D-14).

### P-1 — Token Comparisons (unsichere Gleichheit)

**Ziel:** Alle String-Vergleiche finden, die Secrets/Tokens/Keys betreffen und **nicht** `timingSafeEqual` nutzen.

```bash
# Strikte Äquivalenz-Vergleiche im direkten Umfeld von Token/Secret/Password
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' \
  -g '!**/__tests__/**' -g '!**/*.spec.ts' -g '!**/*.test.ts' \
  '(token|secret|password|apiKey|signature|hash)\w*\s*(===|!==)\s*\w' \
  apps/ packages/

# Komplementärer Check: timingSafeEqual-Aufrufe explizit listen (zur Gegenprobe)
rg -n --type ts --type js 'timingSafeEqual' apps/ packages/
```

**Expected known positives:**
- `platform/apps/hub/server/utils/internal-auth.ts:16` — bekannt aus CONCERNS.md, bestätigt.

**Expected false positives to filter out:**
- Vergleiche von DB-IDs, Rollen-Strings, Enum-Werten — nicht Token-Material.
- Test-Files mit Mock-Token-Assertions.

**Action:** Jeder Treffer MUSS einzeln bewertet werden; nicht auto-als-Finding übernehmen.

### P-2 — Code Execution (Runtime-Evaluation von externen Strings)

**Ziel:** Alle Stellen finden, an denen Strings zu Code werden.

```bash
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' \
  -g '!**/__tests__/**' -g '!**/*.spec.ts' \
  'new Function\(|[^a-zA-Z_.]eval\(|vm\.(createContext|runInContext|runInNewContext|runInThisContext|Script)' \
  apps/ packages/
```

**Expected known positives:**
- `platform/apps/bot/src/utils/app-hooks.ts:128` — `new Function()` für CJS-Bundle.
- `platform/apps/hub/server/api/apps/[...path].ts:86` — `new Function()` für API-Handler.

**Expected false positives:**
- `new Function()` in Test-Fixtures (sollten durch `__tests__` Ausschluss rausfallen; falls nicht → manuell prüfen).
- String-Literale in Docs/Comments → rg findet sie nicht, weil Kommentare trotzdem matchen; manuell bewerten.

### P-3 — Hardcoded Secrets

**Ziel:** Mögliche hartcodierte Credentials in Code / Config finden.

```bash
# Config-Files (yml, yaml, json, env.example, ts, js)
rg -n -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' \
  -g '!**/pnpm-lock.yaml' -g '!**/package-lock.json' \
  '(password|secret|token|api[_-]?key|postgres:postgres)\s*[:=]\s*["'\''][^$\{\}][^"'\'']{3,}' \
  apps/ packages/ docker-compose.yml docker-compose.override.yml .env.example 2>/dev/null

# Zusätzlich: fixed `postgres:postgres` in Connection-Strings
rg -n 'postgres:postgres@' apps/ packages/ docker-compose.yml 2>/dev/null
```

**Expected known positives:**
- `platform/docker-compose.yml:8` — `POSTGRES_PASSWORD: postgres`
- `platform/docker-compose.yml:60, 69, 114` — `postgres:postgres@db:5432/guildora`
- `platform/.env.example:32` — `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/guildora` (Default-Dev-Credentials; Audit muss entscheiden, ob Finding oder Documented-Dev-Default)

**Expected false positives:**
- `${VAR}`-Interpolationen (gezielt ausgefiltert durch `[^$\{\}]`-Lookahead).
- Placeholder-Strings wie `"replace_with_..."` — manuell als "Placeholder, kein Finding" abhaken.

### P-4 — API-Routen ohne Auth-Marker

**Ziel:** Heuristik für "Route unter `server/api/` ohne expliziten `requireSession`/`requireAdmin`/`requireInternalToken`/`requirePublic`-Aufruf".

```bash
# Alle API-Route-Files auflisten
ROUTES=$(find apps/hub/server/api -type f \( -name '*.ts' -not -name '*.spec.ts' -not -name '*.test.ts' \) 2>/dev/null)

# Pro File prüfen, ob ein require*-/internal-Guard-Aufruf vorkommt
for f in $ROUTES; do
  if ! rg -q 'require(Session|AdminSession|ModeratorSession|SuperadminSession|Role|ModeratorRight|InternalToken)|/api/public/|/api/theme|/api/auth/|/api/setup/|/api/csrf-token|/api/apply/' "$f"; then
    echo "UNGUARDED-CANDIDATE: $f"
  fi
done
```

**Baseline bestätigt durch Stichprobe:** 140 API-Files haben `requireSession|requireAdmin|requireModerator|requireInternalToken`-Aufrufe (287 Treffer über 140 Files). Die `find`-Liste enthält ~161 Files — die ~21 Delta-Files sind Kandidaten für manuelles Review.

**Known expected non-positives (legit public routes per ROADMAP §Phase 3 Success Criteria #3):**
- `apps/hub/server/api/public/*` (landing, branding, footer-pages)
- `apps/hub/server/api/auth/*` (discord, matrix, logout, platforms, dev-login)
- `apps/hub/server/api/theme.get.ts`
- `apps/hub/server/api/setup/*`
- `apps/hub/server/api/csrf-token.get.ts`
- `apps/hub/server/api/apply/[flowId]/*` (token-based, nicht session-based)

**Action:** Jeder Treffer aus der Delta-Liste wird einzeln angeschaut. Ergebnis landet als **ein** Finding "Session-Middleware ist nicht deny-by-default" (siehe CF-04), nicht als separates Finding pro Route.

### P-5 — Unsafe HTML Rendering

**Ziel:** `v-html`-Nutzung ohne sichtbaren Sanitizer im Umfeld.

```bash
# v-html direkt
rg -n 'v-html' apps/ packages/ -g '*.vue' -g '!**/node_modules/**' -g '!**/.nuxt/**'

# innerHTML direkt
rg -n 'innerHTML\s*=' apps/ packages/ -g '!**/node_modules/**' -g '!**/.nuxt/**' \
  -g '!**/playwright-report/**'

# Jeden Treffer gegen sanitizeHtml/DOMPurify im selben File prüfen
# (manuell: Read-Tool pro File, sonst zu viele Heuristik-Fehler)
```

**Bereits verifiziert (Stichprobe):**
- `apps/web/app/pages/[slug].vue:25` — `v-html="sanitizeHtml(page!.content)"` → **safe** (DOMPurify-Wrapper in `apps/web/app/utils/sanitize.ts`).
- `apps/web/app/pages/index.vue:121` — nur ein ESLint-Disable-Comment, KEIN v-html daneben (false positive, grep matcht den Comment-Text).
- `packages/motion/src/composables/useGsapTextReveal.ts:13,36,63` — `element.innerHTML` wird mit Text-aus-eigenem-State überschrieben (GSAP Text-Split), **nicht user-controlled** → safe, aber im Audit als "no finding, verified" erwähnen (Transparenz).
- `apps/hub/server/utils/sanitize.ts` + `apps/web/app/utils/sanitize.ts` — zentrale DOMPurify-Wrapper existieren.

**Conclusion:** P-5 dürfte **kein neues Critical/High-Finding** liefern; vermutlich ein Low "zentrale Sanitize-Nutzung dokumentieren" ODER gar kein Finding. Im Audit explizit verifizieren und entweder klein-oder-gar-nicht listen.

### Finalized Scan-Commands für Planner-Tasks

Der Planner kann diesen einen Block 1:1 in eine Task-Anweisung "Run security greps" kopieren:

```bash
set -e
cd platform
echo "=== P-1 Token Comparisons ==="
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/__tests__/**' -g '!**/*.spec.ts' '(token|secret|password|apiKey|signature|hash)\w*\s*(===|!==)\s*\w' apps/ packages/ || true

echo "=== P-1 timingSafeEqual sites (cross-check) ==="
rg -n --type ts --type js 'timingSafeEqual' apps/ packages/ || true

echo "=== P-2 Code Execution ==="
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/__tests__/**' -g '!**/*.spec.ts' 'new Function\(|[^a-zA-Z_.]eval\(|vm\.(createContext|runInContext|runInNewContext|runInThisContext|Script)' apps/ packages/ || true

echo "=== P-3 Hardcoded Secrets ==="
rg -n -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/pnpm-lock.yaml' '(password|secret|token|api[_-]?key|postgres:postgres)\s*[:=]\s*["'\''][^$\{\}][^"'\'']{3,}' apps/ packages/ docker-compose.yml docker-compose.override.yml .env.example 2>/dev/null || true

echo "=== P-3b postgres:postgres in connection strings ==="
rg -n 'postgres:postgres@' apps/ packages/ docker-compose.yml 2>/dev/null || true

echo "=== P-4 Unguarded API routes (heuristic) ==="
find apps/hub/server/api -type f -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' | while read -r f; do
  if ! rg -q 'require(Session|AdminSession|ModeratorSession|SuperadminSession|Role|ModeratorRight|InternalToken)' "$f"; then
    echo "UNGUARDED-CANDIDATE: $f"
  fi
done

echo "=== P-5 v-html ==="
rg -n 'v-html' apps/ packages/ -g '*.vue' -g '!**/node_modules/**' -g '!**/.nuxt/**' || true
echo "=== P-5 innerHTML ==="
rg -n 'innerHTML\s*=' apps/ packages/ -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/playwright-report/**' || true
```

**Output-Handling:** Ergebnisse werden als Freitext in die Wave-2-Arbeitsdatei kopiert (z.B. `.planning/phases/01-security-audit-priorisierung/scan-results.tmp.md`), von Claude per Finding-Block gefiltert, und die temporäre Datei am Ende der Phase gelöscht (D-01: nur das finale Audit-Doc lebt lang).

## Kopf-Review Questionnaire

**Zweck:** Strukturierte Prompt-Liste, die Andi in einer gezielten Session (schriftlich oder mit Alice) abarbeitet, damit die bisher-nur-im-Kopf-Reviews als Klartext landen. Entspricht D-13.

**Format:** Claude / Alice stellt pro Bereich 2–4 konkrete Fragen. Andi antwortet stichpunktartig; Antworten werden wörtlich in die Wave-3-Arbeitsdatei gelegt. Die Antworten werden dann in Wave 4 zu Findings verdichtet (nicht jede Antwort wird ein Finding, aber keine Antwort wird weggeworfen).

**Sprache:** Deutsch (Andis Arbeitssprache).

---

### Bereich A — Apps-Plugin-System

1. **Welche konkrete Sandbox-Mechanik schwebt dir vor** (isolated-vm / Worker Threads / Docker-per-App)? Wo vermutest du den Haken? *(→ Input für Phase-2-Research, kein Phase-1-Finding)*
2. **Gibt es Apps-Code, der im Hub anders aufgerufen wird als im Bot** — also abseits der beiden bekannten Execution-Sites (`apps/bot/src/utils/app-hooks.ts:128` und `apps/hub/server/api/apps/[...path].ts:86`)? Z.B. Page-Render-Server-Side via `vue3-sfc-loader`?
3. **Welche h3-Helpers sind heute exponiert** und welchen davon würdest du im Nachhinein lieber nicht exponieren? *(Whitelist-Review)*
4. **Die `createAppDb`-KV-Abstraktion — hast du dort Bauchweh wegen Scope-Leakage** zwischen Apps (ein App liest fremde App-Keys)?

### Bereich B — Internal-Auth (Hub ↔ Bot, MCP, Application-Tokens)

1. **Neben `internal-auth.ts:16` und `internal-sync-server.ts:86` — gibt es einen weiteren Pfad**, an dem ein Token verglichen wird (z.B. `application-tokens.ts`, `platformBridge.ts`)? Welches Vergleichs-Schema dort?
2. **`APPLICATION_TOKEN_SECRET`** — wie wird der genutzt, wo wird er verifiziert, und gibt es dort eine Timing-Frage?
3. **Der MCP-Token-Pfad**: hat die MCP-Komponente je in Produktion gelaufen, oder ist das aktuell "eingebaut, aber ungenutzt"? Relevant für Severity-Bewertung (ungenutzt ≠ unrisky, aber andere Restrisiko-Basis).
4. **Im `.env.example` steht `BOT_INTERNAL_TOKEN=replace_with_internal_sync_token`** — gibt es in der Realität Deployments, wo dieser Placeholder NICHT ersetzt wurde, und das dadurch zum Live-Finding wird?

### Bereich C — Session & CSRF

1. **`03-session.ts`** fängt `getUserSession`-Fehler und setzt `userSession = null`. Hast du konkrete Stellen im Kopf, wo dieser Silent-Fallback dich beißt, oder ist das "nur Bauchweh"?
2. **`02-csrf-check.ts`** skippt CSRF, wenn weder `Origin` noch `Referer` gesetzt sind (SSR-Internal-Request-Exception). Siehst du einen Angriffspfad, wie das von aussen ausgenutzt werden kann (z.B. via Tool, das Header bewusst weglässt)?
3. **Session-Rotation nach Login** (SEC-05): funktioniert das heute schon durch `nuxt-auth-utils` automatisch, oder ist das offen? Falls offen — weißt du warum?
4. **Cookie-Flags** (`HttpOnly`, `Secure`, `SameSite`): kennst du Umgebungen, in denen `Secure` nicht greift (lokale Preview-URL ohne TLS, o.ä.)?
5. **Dev-Login-Bypass** (`NUXT_AUTH_DEV_BYPASS=true`, `apps/hub/server/api/auth/dev-login.get.ts`, `apps/hub/server/api/dev/*`): wie sicher bist du, dass dieser Pfad in Prod wirklich aus ist?

### Bereich D — Supply-Chain & Secrets

1. **12 `pnpm.overrides`** — weißt du bei allen, welchen CVE oder welches Upstream-Problem sie patchen? Fällt dir einer ein, wo du dir NICHT mehr sicher bist, ob er noch nötig ist?
2. **`.env`-Handling** — gibt es irgendwo im Code eine Stelle, an der ein Fallback-Default "auslöst, wenn ENV fehlt" und damit schweigend weiterläuft mit einer unsicheren Default-Konfiguration? (Fail-Loud-Test)
3. **`docker-compose.yml`** — neben dem bekannten `POSTGRES_PASSWORD: postgres`: kennst du weitere Stellen, wo ein Wert hartcoded ist, der eigentlich aus `.env` kommen sollte?

### Bereich E — Upload / Media / File-Serving

1. **Avatar-Upload** (`apps/hub/server/api/profile/avatar.put.ts`) und **Application-Upload** (`apps/hub/server/api/apply/[flowId]/upload.post.ts`) prüfen MIME-Allowlist + 5MB-Limit. Hast du ein Finding dazu im Kopf, das über MIME-Sniffing-Risiken, Path-Traversal (`../`) oder Race-Conditions hinausgeht, was der Code heute prüft?
2. **`media.ts`** / S3-Config: fällt dir eine Stelle ein, an der ein User-eingeschleuster Pfad direkt an `PutObjectCommand` gelangen könnte?
3. **`apps/hub/media/uploads/`** liegt untracked auf dem Host-Filesystem — ist das nach aussen servbar (z.B. durch ein `/uploads/*`-Serve), und wenn ja: ist das auth-protected?

### Bereich F — Apps-Pipeline & Sideload

1. **`app-sideload.ts`** holt Code von `raw.githubusercontent.com`. Gibt es ein TOCTOU-Risiko (Manifest-Fetch zeigt X, aber der Code-Fetch Sekunden später zeigt Y)? Schon mal gesehen?
2. **esbuild-Transpilation** in `app-sideload.ts`: hat esbuild jemals verschachtelten Code ausgegeben, der sich im Runtime anders verhält als im Manifest signalisiert? (Compile-Time Obfuscation durch Angreifer)
3. **`installed_apps.code_bundle`** (DB-JSONB): wer kann diese Spalte direkt manipulieren (z.B. via Admin-API)? Falls ja — ist das im Audit als eigenes Finding wert?

### Bereich G — Audit-/Logging-Pfad

1. **Gibt es Security-relevante Events** (failed Login, Role-Change, App-Install, Token-Revoke), für die du dir zu wenig Audit-Log wünschst? *(Low-Priorität-Finding-Kandidat)*
2. **PII im Log**: erinnerst du dich an ein `console.log` oder `logger.info`, das E-Mail/Discord-ID/Session-Token im Klartext loggt und im Kopf als "später mal fixen" abgelegt wurde?

### Bereich H — Offene Kategorie (Catch-All)

1. **Welches bisher nicht genanntes Finding** trägst du im Kopf herum, das in keinem der obigen Bereiche fällt?
2. **Wovon hast du nachts mal geträumt** ("jemand kann X tun und dann …") und dir gedacht "muss ich mal prüfen"? → Das kommt jetzt rein, egal ob Critical oder Low.
3. **Etwas, das du im PROJECT.md-Core-Value "Andi kann ohne Bauchschmerzen zeigen"** als offen hast und was NICHT in die SEC-02…SEC-07 reinpasst?

---

**Operational-Hinweis für Planner:** Die Ausführung dieser Fragenrunde braucht Andi-Zeit und kann nicht durch einen Agent allein beantwortet werden. Wave 3 ist daher eine **Mensch-im-Loop-Wave** — planner muss `waits_for_user: true` markieren. Claude kann die Antworten aber live in die Arbeitsdatei protokollieren, damit kein Klartext verloren geht.

## Audit Document Skeleton

**Vollständiges Skelett für `.planning/research/01-security-audit.md` — der Planner kann das in eine Final-Wave-Task kopieren und ausfüllen.**

```markdown
# Security Audit — Guildora Platform

**Audit-Datum:** 2026-04-16 (ursprüngliche Erstellung); letzte Aktualisierung: YYYY-MM-DD
**Scope:** `platform/`-Stack (ohne marketplace/, guildai/, voice-rooms/, app-template/)
**Methode:** Konsolidierung aus `.planning/codebase/CONCERNS.md` (2026-04-15) +
strukturierte Kopf-Review-Session mit Andi + gezielte ripgrep-Scans für
5 Pattern-Klassen. KEIN frisches Full-Audit.
**Zielgruppe:** Phase-2/3/4-Builder (Claude-Agents) + Andi im Planning-Modus.

---

## 1. Executive Summary

- **Gesamt-Findings:** N (davon X Critical, Y High, Z Medium, W Low + V Operational + U Deferred)
- **Phase-Aufteilung:**
  - Phase 2 (Apps-Plugin-Sandbox): N Findings (davon X Critical)
  - Phase 3 (Auth- & Session-Härtung): N Findings (davon Y High)
  - Phase 4 (Supply-Chain & Secrets): N Findings (davon Z Critical/High)
  - v2 / Deferred: N Findings
- **Sofort-Handlungsempfehlung:** {1 Satz, z.B. "Phase 2 zuerst — Plugin-Sandbox ist einziges Critical."}
- **Nicht abgedeckt (out-of-scope):** Infrastructure (Docker daemon, Cloudflare), Fremd-Repos.

## 2. Severity-Kriterien

**Critical:** Unauthenticated RCE, vollständiger Secret-/User-Daten-Zugriff durch externen
Angreifer ohne Nutzerbeteiligung.
**High:** Privilege-Escalation für authenticated User, Einzel-User-Data-Leak,
Timing-/Info-Leak mit direktem Angriffsweg.
**Medium:** Schwächen mit Zusatzvoraussetzungen (innerer Netzzugriff, kompromittierte App)
oder Härtungs-Lücken ohne direkten Exploit.
**Low:** Defense-in-Depth, Best-Practice-Abweichung ohne bekannten Exploit-Pfad.
**Operational (nicht Security):** Performance/DoS/Stabilität — wird getrennt geführt, damit
Phase-Priorisierung nicht verzerrt wird (D-15).

Severity bewertet **Restrisiko** nach heutiger Mitigation (`Current Mitigation`-Feld), nicht
das theoretische Maximum (D-09).

## 3. Scope & Methodik

**In-Scope:**
- Sämtlicher Code in `platform/apps/*` und `platform/packages/*`
- `platform/docker-compose.yml`, `platform/docker-compose.override.yml`, `platform/.env.example`
- `platform/package.json` (inkl. `pnpm.overrides`)

**Explizit Out-of-Scope** (D-14):
- Code in `marketplace/`, `guildai/`, `voice-rooms/`, `app-template/`, Workspace-Root
- Runtime/Infrastruktur: Docker-Daemon-Config, Cloudflare-Tunnel-Setup, Host-OS-Härtung,
  Caddy-Config, Netzwerk-Topologie
- `pnpm audit`-Finding-Auflösung (gehört zu Phase 4/SEC-07)
- Einführung neuer Tooling-Layer (ESLint-Security-Plugins etc.) — Phase 5

**Methodik:**
1. Bestehende Findings aus `.planning/codebase/CONCERNS.md` (2026-04-15) übernommen + Pflicht-Metadaten ergänzt.
2. Andis bisher-nur-im-Kopf-Reviews via strukturierter Fragenkatalog (Bereiche A–H) schriftlich protokolliert.
3. 5 ripgrep-Pattern-Scans (Token-Vergleiche, Code-Execution, Hardcoded Secrets, ungeschützte API-Routen, unsafe HTML) durchgeführt; Treffer einzeln bewertet.

---

## 4. Findings — Critical

### [F-01] <Titel>
- **Severity:** Critical
- **Area:** Apps-Plugin
- **Datei-Pfad(e):** `...`
- **Current Mitigation:** `...`
- **Fix-Ansatz:** `...`
- **Target Phase:** Phase 2 (SEC-02)
- **Discovered-By:** `...`

---

## 5. Findings — High

### [F-02] <Titel>
…

## 6. Findings — Medium

### [F-XX] <Titel>
…

## 7. Findings — Low

### [F-XX] <Titel>
…

## 8. Operational Findings (nicht Security-Severity)

> Diese Items sind Stabilitäts-/Performance-relevant, nicht Security-Exploit-relevant.
> Sie stehen hier, damit Phase-2/3/4-Planning sie nicht fälschlich als Security-Blocker priorisiert.

### [OP-01] <Titel>
- **Class:** Operational
- **Area:** `...`
- **Datei-Pfad(e):** `...`
- **Current Mitigation:** `...`
- **Fix-Ansatz:** `...`
- **Target Phase:** `...`

---

## 9. Deferred / Accepted Risks

> Findings, die bewusst NICHT in dieser Milestone adressiert werden — mit Begründung.

### [D-01] <Titel>
- **Severity:** Low
- **Area:** `...`
- **Datei-Pfad(e):** `...`
- **Current Mitigation:** `...`
- **Warum nicht jetzt:** `...`
- **Target Phase:** v2 / out-of-scope

---

## 10. SEC-Requirement Traceability

> Gegenprobe: jedes Critical/High-Finding zeigt auf SEC-02…SEC-07. Wenn ein SEC-Requirement
> NICHT durch ein Audit-Finding gedeckt ist, ist das eine Lücke im Audit oder ein
> überflüssiges Requirement — beides wird hier sichtbar.

| SEC-Req | Beschreibung | Abgedeckt durch Finding(s) |
|---------|--------------|----------------------------|
| SEC-02  | Apps-Plugin Sandbox | F-01, (ggf. weitere) |
| SEC-03  | timingSafeEqual für interne Tokens | F-0X |
| SEC-04  | Session-Middleware deny-by-default | F-0X |
| SEC-05  | OAuth/Cookie/CSRF-Review | F-0X (+ evtl. mehrere) |
| SEC-06  | Docker-Compose env-basiert | F-0X |
| SEC-07  | pnpm.overrides-Review + pnpm audit | D-0X (Phase 4) |

**Unabgedeckt / offen:** {Liste der SEC-Requirements ohne Finding ODER leer, wenn alle gedeckt.}

---

*Audit erstellt: 2026-04-16 (Phase 1 dieses Stabilisierungs-Projekts)*
```

**SEC-Traceability-Entscheidung (war offen im Research-Focus Punkt 3):** **JA, Tabelle am Doc-Ende einfügen.**
Begründung:
1. Success Criteria #3 der Phase 1 verlangt "keine offenen Critical/High ohne zugeordnete Folge-Phase" — eine Traceability-Tabelle ist der natürliche Beweis.
2. SEC-01 selbst fordert "nach Severity priorisiert"; die Phase-Zuordnung pro Finding ist der Join-Key für Phase-2/3/4-Research. Die SEC-Traceability-Tabelle ist die **inverse Sicht** (pro SEC-Req, nicht pro Finding), die Andi im Planning der Folge-Phasen spart, grep-Volumen zu lesen.
3. Die Tabelle ist 7 Zeilen lang (SEC-02…SEC-07 + evtl. SEC-01-Self-Reference). Kein Volumen-Problem.

**Volumen-Check auf Skelett:** Executive Summary (~5 Zeilen) + Kriterien (~8) + Scope (~15) + 4 Severity-Blöcke × 4–8 Findings × 10–20 Zeilen + Operational (~3 Findings) + Deferred (~3 Items) + Traceability (~10) ≈ 400–700 Zeilen. Liegt im 15–25 × ~15 Zeilen = 225–375-Band der D-16-Zielgrösse plus Rahmen. Passt.

## Candidate Finding Inventory

**Alle Findings-Kandidaten aus CONCERNS.md + Stichproben-Verifikation im Codebase, verdichtet zu einer Flat-Liste.** Severity-Werte sind **Vorschläge** — final bewertet Andi in Wave 4.

Format: `[Candidate-ID] Title — severity-guess — source location — one-liner`

### Security-Severity-Kandidaten

| ID | Title | Severity-Guess | Source | Notes |
|----|-------|----------------|--------|-------|
| CF-01 | No Sandboxing for Plugin Code Execution (`new Function()`) | **Critical** | CONCERNS.md §Security + `apps/bot/src/utils/app-hooks.ts:128` + `apps/hub/server/api/apps/[...path].ts:86` | Doppel-Execution-Site; beide müssen im selben Finding genannt oder als paralleles Finding-Paar geführt werden |
| CF-02 | Non-Timing-Safe Token Comparison im Hub (`internal-auth.ts`) | **High** | CONCERNS.md §Security + `apps/hub/server/utils/internal-auth.ts:16` | Bot-Seite (`internal-sync-server.ts:70-86`) hat bereits `timingSafeEqual` — Inkonsistenz-Finding |
| CF-03 | Default Database Credentials in `docker-compose.yml` | **Medium** | CONCERNS.md §Security + `docker-compose.yml:8, 60, 69, 114` | Bei Default-Prod-Deployment ohne Override wird `postgres:postgres` live — Severity hängt an "ist das in Prod heute wirklich so?" |
| CF-04 | Session-Middleware blockt unauthentifizierte Requests nicht | **High** | CONCERNS.md §Security + `apps/hub/server/middleware/03-session.ts` | Silent-Fallback auf `userSession = null`; deny-by-default fehlt; neue Routen ohne `requireSession()` wären unbemerkt offen |
| CF-05 | MCP-Internal-Token: Placeholder in `.env.example`, unklar ob in Prod ersetzt | **Medium-or-Low** | `.env.example:69` (kommentiert), Nuxt-Runtime-Config in `nuxt.config.ts` | Abhängig von Kopf-Review Bereich B.3 — ggf. kein Finding (MCP ungenutzt) oder Placeholder-Risiko |
| CF-06 | Dev-Login-Bypass-Pfad (`NUXT_AUTH_DEV_BYPASS`, `/api/auth/dev-login`, `/api/dev/*`) | **Medium** | `.env.example:60` + `apps/hub/server/api/auth/dev-login.get.ts` + `apps/hub/server/api/dev/*` | Finding relevant nur, wenn Prod-Guard prüfbar (Kopf-Review C.5) |
| CF-07 | CSRF-Skip bei fehlendem Origin/Referer | **Low-or-Medium** | `apps/hub/server/middleware/02-csrf-check.ts:15` | Dokumentiertes SSR-Fallback — muss im Audit als bekannt-akzeptiert oder als Finding durchdacht werden; hängt an Kopf-Review C.2 |
| CF-08 | Hartcodierte DB-Credentials in `.env.example` (DATABASE_URL-Default) | **Low** | `.env.example:32` | "replace before prod"-Default; Finding über Documentation Quality, nicht Code-Problem |
| CF-09 | App-Sideload lädt aus `raw.githubusercontent.com` ohne Integritäts-Check | **Medium** | `apps/hub/server/utils/app-sideload.ts` + ARCHITECTURE.md §App Installation | TOCTOU zwischen Manifest-Fetch und Code-Fetch; Hash/Signatur fehlt |
| CF-10 | Apps greifen via `createAppDb` auf KV-Tabelle — Scope-Leakage? | **Medium-or-Low** | `apps/bot/src/utils/app-hooks.ts:141` (`createAppDb(row.appId)`) | Hängt an Kopf-Review A.4 (ist Scope-Enforcement gegeben oder pro-Convention?) |
| CF-11 | `installed_apps.code_bundle` JSONB — Manipulations-Pfad via Admin-API | **Medium** | `apps/hub/server/api/admin/apps/*` + `apps/hub/server/plugins/app-loader.ts` | Admin-Role kann Code manipulieren; relevant weil "admin compromise → RCE-on-Hub" |
| CF-12 | Application-Tokens (`APPLICATION_TOKEN_SECRET`) — Verifikationspfad | **needs-review** | `apps/bot/src/utils/internal-sync-server.ts:12` imports `signTokenId`, `apps/hub/server/utils/application-tokens.ts` | Kopf-Review B.2 nötig — eventuell kein Finding |
| CF-13 | `pnpm audit` wurde nie gefahren — offene CVEs in Dependencies unbekannt | **Low (process)** | CONCERNS.md §Dependencies + `package.json` pnpm.overrides | Deferred an Phase 4 per D-12; steht als "process finding" im Deferred-Block |
| CF-14 | `pnpm.overrides` (12 Einträge) — Grund pro Override ungeprüft | **Low** | `platform/package.json:32-48` | Deferred an Phase 4 per SEC-07 |
| CF-15 | Uploads schreiben in `process.cwd()/data/application-uploads/...` | **Low** | `apps/hub/server/api/apply/[flowId]/upload.post.ts:47` | Filename wird sanitisiert (`replace(/[^a-zA-Z0-9._-]/g, "_")`), Path-Traversal via `flowId`/`discordId` möglich? → Prüfung im Audit |
| CF-16 | Rate-Limit nur global (300/60s/IP) — kein Pro-Endpoint-Schutz | **Low** | `apps/hub/server/middleware/01-rate-limit.ts:7` | Defense-in-Depth; Brute-Force-Mitigation für `/api/auth/*` fehlt |
| CF-17 | `NUXT_SESSION_COOKIE_SECURE=false` als env-Option | **Low** | `.env.example:47` | Opt-out von Secure-Flag möglich — dokumentieren, ob Audit das als Finding sieht |

### Operational-Kandidaten (D-15)

| ID | Title | Source | Notes |
|----|-------|--------|-------|
| OC-01 | In-Memory Rate-Limiting (nicht horizontal skalierbar) | CONCERNS.md §Tech Debt + `apps/hub/server/utils/rate-limit.ts:13` | v2/INFRA-01 |
| OC-02 | App Registry-Reload Thundering Herd auf DB | CONCERNS.md §Performance + `apps/hub/server/plugins/app-loader.ts:67` | v2/INFRA-02 |
| OC-03 | DB Migration Fixups laufen bei jedem Start (~200 Zeilen) | CONCERNS.md §Performance + `packages/shared/src/db/run-migrations.ts:101-444` | v2/DEBT-01 |

### Deferred / Accepted-Risk-Kandidaten

| ID | Title | Warum deferred |
|----|-------|----------------|
| DF-01 | `pnpm audit`-Lauf | Phase 4 / SEC-07 — eigenständige Arbeit, nicht in Phase 1 |
| DF-02 | ESLint-Security-Plugins | Phase 5 / CI-02 — CI-Stabilisierung macht Lint erst wieder blocking |
| DF-03 | CVSS-Scoring / externes Reviewer-Format | Solo-Projekt; irrelevant |
| DF-04 | Runtime-/Infra-Audit (Docker, CF-Tunnel, Host) | Out-of-Scope dieses Projekts |
| DF-05 | Audit von marketplace/guildai/voice-rooms/app-template | Getrennte Repos; eigene Milestones bei Bedarf |

**Volumen-Check:** 17 Security + 3 Operational + 5 Deferred = **25 Items** — am oberen Rand von D-16 (15–25). Wave 4 muss konsolidieren — erwartet, dass einige Kandidaten verschmelzen (z.B. CF-08 in CF-03 als Sub-Punkt) oder als "kein Finding" gestrichen werden (z.B. CF-07 wenn Kopf-Review C.2 clear). Ziel ist **~18–22 Security-Findings + 3 Operational + 5 Deferred** im finalen Doc.

## Proposed Finding → Phase Mapping

**Erste Grob-Zuordnung — Andi confirmed in Wave 5.** Mapping-Logik: jede SEC-02…SEC-07-Requirement-ID wird mindestens einem Finding zugeordnet.

| Candidate | Severity-Guess | Proposed Target Phase | SEC-Req |
|-----------|----------------|----------------------|---------|
| CF-01 Plugin-Sandbox | Critical | Phase 2 | SEC-02 |
| CF-02 Timing-Safe Token | High | Phase 3 | SEC-03 |
| CF-03 Docker-Secrets | Medium | Phase 4 | SEC-06 |
| CF-04 Session-Middleware | High | Phase 3 | SEC-04 |
| CF-05 MCP-Token Placeholder | Medium-or-skip | Phase 4 (falls Finding) | SEC-06 (process) |
| CF-06 Dev-Bypass-Pfad | Medium | Phase 3 | SEC-05 |
| CF-07 CSRF-Skip | Low-or-Medium | Phase 3 | SEC-05 |
| CF-08 `.env.example`-Default | Low | Phase 4 | SEC-06 |
| CF-09 Sideload ohne Integrity | Medium | Phase 2 (Sandbox-adjacent) ODER v2 | SEC-02 (erweitern) |
| CF-10 KV-Scope-Leakage | Medium-or-Low | Phase 2 | SEC-02 |
| CF-11 code_bundle Admin-Manipulation | Medium | Phase 2 (Sandbox-adjacent) | SEC-02 |
| CF-12 Application-Tokens | needs-review | Phase 3 (ggf.) | SEC-03 |
| CF-13 pnpm audit | Low | Phase 4 (deferred section) | SEC-07 |
| CF-14 pnpm.overrides | Low | Phase 4 | SEC-07 |
| CF-15 Upload-Path-Handling | Low | Phase 3 ODER v2 | SEC-05 (grenzwertig) |
| CF-16 Rate-Limit zu grob | Low | v2 | — (kein SEC-Req) |
| CF-17 Secure-Flag-Opt-out | Low | Phase 3 | SEC-05 |
| OC-01 In-Memory RL | Operational | v2 | INFRA-01 |
| OC-02 Thundering Herd | Operational | v2 | INFRA-02 |
| OC-03 Migration-Fixups | Operational | v2 | DEBT-01 |

**Traceability-Gegenprobe:**
- SEC-02 → CF-01, CF-09, CF-10, CF-11 ✓
- SEC-03 → CF-02, CF-12 ✓
- SEC-04 → CF-04 ✓
- SEC-05 → CF-06, CF-07, CF-15, CF-17 ✓
- SEC-06 → CF-03, CF-05, CF-08 ✓
- SEC-07 → CF-13, CF-14 ✓

**Alle 6 SEC-Requirements gedeckt.** Kein SEC-Req ist ohne zugeordnetes Finding — Success Criteria #3 ist mit diesem Inventar erfüllbar.

## Common Pitfalls

### Pitfall 1: Kopf-Review-Fatigue — zu viele Lows

**What goes wrong:** Andi sitzt mit Alice durch den 8-Bereich-Fragenkatalog, und jeder "hatte ich mal ein komisches Gefühl bei …"-Moment wird als Finding eingetragen. Nach 45 Minuten stehen 35 Lows im Inventar; der Audit-Volumen-Budget (D-16: 15–25) ist gesprengt.
**Why it happens:** Fragenkatalog ist offen formuliert ("Was trägst du im Kopf herum?"); Claude ist geneigt, alles als valides Finding zu validieren, um "Fail Loud" zu folgen.
**How to avoid:**
1. Planner schreibt in Wave-3-Task: "Nach Kopf-Review, Claude sortiert Antworten in 3 Buckets: (a) Wird Finding, (b) Wird Deferred mit Begründung, (c) Wird gelöscht mit Begründung — alle drei Buckets ins Wave-3-Arbeitsprotokoll."
2. Severity-Kriterien (D-05) werden VOR der Kopf-Review an Andi wiederholt, damit er im Antworten schon vorfiltert.
3. Bei >25 Finding-Kandidaten: Claude muss in Wave 4 hart schneiden. Low-Findings ohne **konkreten Fix-Ansatz** sind Streich-Kandidaten Nr. 1.
**Warning signs:** Wave-4-Arbeitsdatei hat >25 Einträge. Sofortige Verdichtung nötig.

### Pitfall 2: Fix-Ansatz-Scope-Creep

**What goes wrong:** Finding `Fix-Ansatz`-Feld wird zu einer Mini-Sandbox-Architektur-Spec. Z.B. bei CF-01: "Use isolated-vm with X/Y/Z CPU limits, following pattern from [link]…". Das ist Phase-2-Research, nicht Phase-1-Audit.
**Why it happens:** Claude neigt dazu, "hilfreich" zu sein und gleich eine Lösung vorzudenken.
**How to avoid:** Planner nimmt in den Write-Finding-Task eine harte Regel auf: **`Fix-Ansatz` ist ≤ 2 Sätze, keine Code-Snippets, keine Library-Namen, keine Bench-Werte.** Beispiele für gute `Fix-Ansatz`:
- "Token-Vergleich auf `crypto.timingSafeEqual` umstellen (Pattern aus `internal-sync-server.ts` wiederverwenden)."
- "Session-Middleware erweitern: Routen nicht in Public-Allowlist werden geblockt (401) statt `userSession=null` zu setzen."
- "Echte Sandbox-Isolation einführen (Tech-Auswahl: Phase 2)."
**Warning signs:** `Fix-Ansatz` überschreitet 200 Zeichen oder nennt konkrete Libraries.

### Pitfall 3: Audit wird stale zwischen Phase 1 und Phase 2 Start

**What goes wrong:** Audit wird 2026-04-17 committed, Phase 2 startet erst 2026-04-22. In der Zwischenzeit landen 3 unrelated Commits auf `main`, die einen der referenzierten Datei-Pfade verschieben (z.B. `internal-auth.ts` wird umbenannt). Audit-Pfade sind veraltet.
**Why it happens:** Phase-Kette läuft sequenziell, aber Main-Branch pausiert nicht.
**How to avoid:**
1. Audit-Doc enthält **Commit-SHA** in Header-Metadaten (z.B. "Codebase-Stand: {git rev-parse HEAD}"), damit Phase-2-Researcher gegenchecken kann.
2. Phase 1 endet mit einem **git-tag**: `phase-1-audit-baseline`. Phase-2-Research clone von diesem Tag, nicht von `main`.
3. Als Wave-5-Abschluss ein kurzes "git status" des Audit-Doc-Pfades checken — stellt sicher, dass die `apps/hub/media/uploads/`-Drift (siehe `git status` im Phase-Start) keine relevanten Dateien trifft.
**Warning signs:** Unerwartete File-Renames während Phase 1; Merges mit grossen Diffs auf `main`.

### Pitfall 4: Operational vs. Security blurry

**What goes wrong:** CF-16 (Rate-Limit zu grob) landet als "Medium Security", weil "könnte bei Brute-Force-Login missbraucht werden". Der Planner von Phase 3 liest das als Security-Pflicht und priorisiert es hoch, obwohl der echte Fix in v2 ist.
**Why it happens:** Die Grenze zwischen "Defense-in-Depth-Security" und "Operational-Robustness" ist weich.
**How to avoid:** Wave-4-Task nimmt eine **Dichotomie-Regel** auf:
> Ein Finding ist **Security**, wenn ein konkreter Angreifer-Pfad beschreibbar ist ("Angreifer X macht Y und erreicht Z"). Ist der "Angreifer" nur "hohe Last" → Operational.

Unter dieser Regel wird CF-16 zu "Low Security + Rate-Limit-Upgrade in v2" (Brute-Force auf `/api/auth/*` ist ein konkreter Angreifer-Pfad), CF-01 bleibt Critical Security. OC-01 ist klar Operational.
**Warning signs:** Severity-Diskussion dauert länger als 30 Sekunden pro Finding → wahrscheinlich Operational.

### Pitfall 5: `Current Mitigation: keine` ohne weitere Begründung

**What goes wrong:** Finding hat `Current Mitigation: keine` und nichts weiter — Planner nimmt das als "also Raw-Severity" an und bläht die Severity auf.
**Why it happens:** "keine" ist ein zu grober Operator; es kann heissen "nicht geprüft" oder "geprüft, wirklich keine".
**How to avoid:** Pflichtregel: `Current Mitigation: keine — {ein Satz warum}`. Beispiele:
- `keine — Endpoint ist öffentlich und der Code führt die Unsafe-Operation direkt aus.`
- `keine — wurde im Kopf-Review geprüft, es gibt keine indirekte Schutzschicht.`
**Warning signs:** Findings mit Ein-Wort-Mitigation.

## Runtime State Inventory

*Phase 1 ist Dokumentationsphase — kein Rename, kein Refactor, keine Migration. Diese Sektion ist nicht anwendbar.*

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ripgrep (`rg`) | Grep Pattern Catalog | ✓ (assumed) | ≥13 typ. | `grep -r` |
| git | Finding-Kontext, Traceability | ✓ | ≥2.x | — |
| Node.js/pnpm | nicht benötigt (keine Installs) | ✓ | Node ≥20 | — |
| Internet-Zugang | nicht benötigt (keine WebFetch) | — | — | — |

**Missing dependencies with no fallback:** —
**Missing dependencies with fallback:** Falls `rg` fehlt: GNU `grep -rnE` auf allen Patterns fahren (langsamer, aber funktional äquivalent für die 5 Pattern-Klassen).

**Pre-flight check** (Planner sollte dies als erste Bash-Task einbauen):

```bash
command -v rg >/dev/null && rg --version | head -1 || echo "ripgrep MISSING — use grep fallback"
git rev-parse HEAD
```

## Validation Architecture

> Nyquist-validation ist in `.planning/config.json` `workflow.nyquist_validation: true` gesetzt. Diese Sektion ist Pflicht.

### Test Framework

Phase 1 produziert kein Code — es gibt keinen Test-Framework-Aufruf. "Validation" bedeutet hier **strukturelle Prüfung des Audit-Dokuments** gegen die Success-Criteria. Alle Checks sind grep-verifizierbar auf dem finalen `.planning/research/01-security-audit.md`.

| Property | Value |
|----------|-------|
| Framework | Bash + ripgrep (strukturelle Doc-Validation) |
| Config file | none — Validation-Befehle stehen direkt in VALIDATION.md |
| Quick run command | `bash .planning/phases/01-security-audit-priorisierung/validation.sh` (Planner generiert dieses Skript in Wave 5) |
| Full suite command | Selbes Skript — Audit ist one-shot, keine Sub-Suites |

### Phase Requirements → Test Map

Alle Prüfungen referenzieren die 4 ROADMAP-Success-Criteria und die D-06-Pflicht-Metadaten.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01.SC1 | Andis Kopf-Reviews sind schriftlich + datiert im Audit-Doc | grep | `rg -q '^\*\*Audit-Datum:\*\*' .planning/research/01-security-audit.md` | ❌ Wave 5 |
| SEC-01.SC2a | Jedes Finding hat `Severity` | grep | `! rg -B1 '^### \[F-' .planning/research/01-security-audit.md \| rg -A6 '^### \[F-' \| rg -v '^(###\|--\|$)' \| rg -L '^- \*\*Severity:\*\*'` (alternativ: pro-Finding manuell) | ❌ Wave 5 |
| SEC-01.SC2b | Jedes Finding hat `Datei-Pfad(e)` | grep | Zählcheck: Anzahl `### [F-` == Anzahl `- **Datei-Pfad(e):**`  ab F-Block | ❌ Wave 5 |
| SEC-01.SC2c | Jedes Finding hat `Fix-Ansatz` | grep | Zählcheck: Anzahl `### [F-` == Anzahl `- **Fix-Ansatz:**` | ❌ Wave 5 |
| SEC-01.SC2d | Jedes Finding hat `Current Mitigation` (D-06 Pflicht) | grep | Zählcheck: Anzahl `### [F-` == Anzahl `- **Current Mitigation:**` | ❌ Wave 5 |
| SEC-01.SC2e | Jedes Finding hat `Target Phase` (D-06 Pflicht) | grep | Zählcheck: Anzahl `### [F-` == Anzahl `- **Target Phase:**` | ❌ Wave 5 |
| SEC-01.SC3a | Findings nach Severity sortiert: Critical → High → Medium → Low | grep + line-number | Reihenfolge der Header `## 4. Findings — Critical`, `## 5. Findings — High`, etc. prüfen | ❌ Wave 5 |
| SEC-01.SC3b | Jedes Critical/High zeigt auf Phase 2/3/4 (KEIN Critical/High auf v2/out-of-scope) | grep | `rg -A10 '^### \[F-.+\*\*Severity:\*\* (Critical\|High)' \| rg '^\*\*Target Phase:\*\* (v2\|out-of-scope)' && echo "FAIL"` (invert check) | ❌ Wave 5 |
| SEC-01.SC4 | Deferred-Section existiert + jedes Deferred-Item hat `Warum nicht jetzt`-Begründung | grep | `rg -q '^## 9\. Deferred / Accepted Risks' && rg -A5 '^### \[D-' .planning/research/01-security-audit.md \| rg -q '^- \*\*Warum nicht jetzt:\*\*'` | ❌ Wave 5 |
| SEC-01.D-13 | Kopf-Review-Antworten sind im Wave-3-Protokoll (oder im Audit direkt) erhalten | file existence | `test -f .planning/phases/01-security-audit-priorisierung/kopf-review.md OR grep within audit` | ❌ Wave 5 |
| SEC-01.D-15 | Operational-Findings sind separat mit `Class: Operational`-Tag markiert | grep | `rg -q '^### \[OP-' .planning/research/01-security-audit.md && rg -A1 '^### \[OP-' \| rg -q '^- \*\*Class:\*\* Operational'` | ❌ Wave 5 |
| SEC-01.TRACE | Alle SEC-02…SEC-07 Requirements sind in der Traceability-Tabelle gedeckt | grep | `for req in SEC-02 SEC-03 SEC-04 SEC-05 SEC-06 SEC-07; do rg -q "^\\\| $req " .planning/research/01-security-audit.md \|\| echo "MISSING: $req"; done` | ❌ Wave 5 |

### Sampling Rate

- **Per task commit:** `rg -c '^### \[F-' .planning/research/01-security-audit.md` — zeigt Finding-Count; Wave 4 committed inkrementell.
- **Per wave merge:** Full validation-Skript (alle obigen Commands); muss grün sein für Wave-Merge.
- **Phase gate:** Full validation-Skript grün + Andi-ACK auf das Kopf-Review-Protokoll + SEC-01 Traceability-Zeile in REQUIREMENTS.md auf `Done` gesetzt.

### Wave 0 Gaps

- [ ] `.planning/phases/01-security-audit-priorisierung/validation.sh` — das Bash-Skript, das die obigen 11 Checks ausführt. Wird vom Planner in Wave 5 als Task definiert.
- [ ] `.planning/research/01-security-audit.md` — existiert am Phase-Ende, nicht vorher.
- [ ] `.planning/phases/01-security-audit-priorisierung/kopf-review.md` — temporäres Wave-3-Arbeitsprotokoll (Planner entscheidet, ob das als permanentes Artefakt bleibt oder in den Audit als "Appendix A" einfliesst).

*(Phase 1 braucht KEIN vitest/playwright — die Validation ist reine Dokument-Struktur-Prüfung.)*

## Security Domain

> `security_enforcement` ist für dieses GSD-Projekt nicht explizit abgeschaltet — Sektion ist enthalten. Für eine reine Doc-Phase ist sie jedoch weitgehend **nicht anwendbar** (es wird kein schützenswerter Code geschrieben).

### Applicable ASVS Categories

Phase 1 produziert ein Markdown-Dokument — klassische ASVS-Kategorien (V2 Auth, V3 Session, V4 Access Control, V5 Input Validation, V6 Crypto) beziehen sich auf Runtime-Code, nicht auf Audit-Artefakte.

**Anwendbar nur indirekt:**

| ASVS Category | Applies to Phase 1 | Standard Control |
|---------------|-------------------|------------------|
| V1 Architecture/Threat Modeling | yes | Audit SELBST ist ein V1-Artefakt — es dokumentiert das Threat Model |
| V14 Configuration | partial | Findings über hartcoded Credentials (CF-03) und `.env.example`-Defaults (CF-08) sind V14-Territory |

### Known Threat Patterns Relevant to the Audit-Produktion

| Pattern | STRIDE | Standard Mitigation (im Phase-1-Kontext) |
|---------|--------|------------------------------------------|
| Audit leak (Findings werden public sichtbar, bevor Mitigations greifen) | Information Disclosure | Audit-Doc bleibt im privaten `platform/`-Repo; dieses Repo ist nicht public. Phase-Branch `gsd/phase-1-security-audit-priorisierung` nicht pushen, bis Phase 2 in Arbeit |
| Audit-Finding unterschlagen (Fail-Loud-Verletzung) | — | "Fail Loud, Never Fake" aus PROJECT.md: keine Finding-Weichspülung; explizite Pflicht zur `Current Mitigation: keine`-Begründung |
| Severity-Inflation oder -Deflation | — | D-05 Kriterien-Block am Doc-Anfang als objektiver Anker |
| Stale-Audit-Drift zur Phase-2-Zeit | — | Git-Tag `phase-1-audit-baseline` + Commit-SHA in Audit-Header |

**Hinweis:** Die realen ASVS-relevanten Findings (V2 Auth in CF-02/CF-04, V6 Crypto in CF-02, V14 Config in CF-03) werden **im Audit dokumentiert**, sind aber nicht durch Phase 1 zu mitigieren — das ist Phase 2/3/4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ripgrep (`rg`) ist im Container verfügbar | Environment Availability, Grep Pattern Catalog | Scripts müssen auf `grep -rnE` fallen zurück; Pattern-Syntax minimal anders |
| A2 | `internal-sync-server.ts:70-86` nutzt korrekt `timingSafeEqual` (nicht nur zufällig passendes Wort) | Candidate CF-02, Pattern P-1 | Bestätigt durch Read-Tool in Research-Session — **VERIFIED**, nicht mehr Assumed |
| A3 | Die 21 Delta-Files aus P-4 sind tatsächlich legitimerweise public (auth, setup, public, theme, csrf-token, apply) | Grep Pattern Catalog P-4 | Wenn nicht, dann fehlt ein echtes Finding. Wave 4 muss jede Delta-Datei einzeln bestätigen |
| A4 | Andi kann Wave 3 (Kopf-Review) in einer einzigen Session antworten | Common Pitfall 1 | Wenn Kopf-Review fragmentiert läuft, Phasen-Timing verschiebt sich; kein Blocker |
| A5 | Das Apps-Plugin-System wird im Audit berücksichtigt — PROJECT.md-Apps-Freigabe ist aktiv | Multiple Findings (CF-01, CF-09, CF-10, CF-11) | Wenn nicht, CF-01 wäre ausgeschlossen → Audit hätte kein Critical und Success Criteria #3 wäre trivial |
| A6 | `pnpm audit` wurde tatsächlich noch nie systematisch gefahren | CF-13 | Falls doch gelaufen + dokumentiert, ist CF-13 ein Miss-Finding → streichen |
| A7 | Die Severity-Guesses im Inventar sind grobe Richtgrößen, kein Commitment | Candidate Finding Inventory | Wave 4 wird sie neu bewerten; kein Risiko |

Tagged claims im Text:
- [VERIFIED via Read-Tool] Dateien/Zeilen in CF-01…CF-17 wurden per Read geprüft.
- [VERIFIED via Grep] P-4 Delta-Count (161 vs 140) per Grep-Scan bestätigt.
- [ASSUMED] A1, A4, A5, A6 — brauchen User-Confirmation vor Wave-Start.

## Open Questions (RESOLVED)

1. **Kopf-Review als Appendix oder in Findings aufgelöst?**
   - Was wir wissen: D-13 verlangt strukturierte Abfrage; D-16 begrenzt das Audit-Volumen.
   - Was unklar war: Ob die Roh-Antworten als "Appendix A: Kopf-Review-Protokoll" im Audit-Doc landen, oder ob nur die daraus destillierten Findings sichtbar werden.
   - RESOLVED: **In Wave 3 als eigene `.planning/phases/01-.../kopf-review.md` protokollieren; in Wave 4 zu Findings verdichten; am Ende des Phases-Lebens entweder (a) als Appendix in den Audit einfliessen lassen oder (b) als separates Kurzdoc im Phase-Dir belassen.** Planner entscheidet in Wave 5. (Umgesetzt in 01-03-PLAN.md und 01-05-PLAN.md.)

2. **SEC-01 Self-Reference in der Traceability-Tabelle?**
   - Was wir wissen: SEC-01 ist "Audit existiert" — das Audit-Dokument selbst ist der Deliverable.
   - Was unklar war: Ob SEC-01 in der Traceability-Tabelle als "covered by: the document itself" steht oder weggelassen wird.
   - RESOLVED: **Weglassen.** Die Tabelle dient der Gegenprobe SEC-02…SEC-07; SEC-01 ist das Meta-Requirement der Phase. (Umgesetzt in 01-01-PLAN.md Wave-1-Skeleton.)

3. **Was tun, wenn ein Kopf-Review-Finding eine SEC-Req-Lücke aufdeckt?**
   - Was wir wissen: Phase 1 ist Audit, nicht Requirements-Änderung.
   - Was unklar war: Wenn Andi in Bereich H.3 ein Finding aufdeckt, das in keinem SEC-Req landet (z.B. "Secret-Rotation-Policy fehlt") — wird das ein neues SEC-08, oder landet es im Deferred?
   - RESOLVED: **Deferred mit Phase `v2`** und expliziter Notiz "wurde in Phase 1 entdeckt, fällt nicht in SEC-02…SEC-07, wird in nächster Milestone als neues Requirement aufgenommen." Requirements-Änderung läuft durch `/gsd-transition`, nicht durch Phase 1. (Umgesetzt in 01-03-PLAN.md H.3-Special-Note und 01-04-PLAN.md Deferred-Handling.)

4. **Ist `apps/hub/media/uploads/` git-status-Drift (ungetracked) ein Finding?**
   - Was wir wissen: `git status` zeigt `apps/hub/media/`, `apps/hub/playwright-report/`, `apps/hub/server/routes/uploads/`, `apps/matrix-bot/matrix-bot-state.json` als untracked.
   - Was unklar war: Ob diese Drift-Einträge zu einem Phase-1-Finding führen sollen oder ob sie zu Phase-6/BOT-02 (matrix-bot-state) gehören.
   - RESOLVED: **Nicht Phase-1-Finding.** `matrix-bot-state.json` ist expliziter BOT-02-Scope; `media/uploads/` ist Runtime-Output (Upload-Ziel), `playwright-report/` ist CI/Test-Output, `server/routes/uploads/` ist evtl. neu entstanden (prüfen). Wenn davon wirklich ein Security-Issue ausgeht (z.B. server/routes/uploads lädt ungeprüft was hoch), landet es als eigenes Finding CF-18 — sonst nicht. (Scope-Grenze in 01-02-PLAN.md acceptance criteria verankert.)

## Risks to Phase Planning

Nicht Finding-Risiken, sondern **Risiken für die Phase-1-Ausführung selbst**:

1. **Kopf-Review-Fatigue** (siehe Pitfall 1): adressiert durch 3-Bucket-Protokoll in Wave-3-Task.
2. **Scope-Creep in Fix-Ansatz** (Pitfall 2): adressiert durch ≤2-Sätze-Regel in Wave-4-Task.
3. **Audit-Staleness** (Pitfall 3): adressiert durch Commit-SHA in Header + `phase-1-audit-baseline` git-Tag.
4. **Severity-Blur zwischen Operational und Security** (Pitfall 4): adressiert durch Dichotomie-Regel in Wave-4-Task.
5. **Missing `Current Mitigation`-Begründung** (Pitfall 5): adressiert durch Validation-Check in `validation.sh`.
6. **Phase-3-Forward-Looking-Überschreibung:** Phase 3 ROADMAP §Success Criteria #2 fordert einen Integration-Test für deny-by-default Session-Middleware. Das ist **nicht** Phase-1-Pflicht — aber das Audit muss CF-04 so formulieren, dass Phase-3-Research den Test als Ziel ableiten kann.
7. **Verzögerung durch Human-in-Loop:** Wave 3 (Kopf-Review) hängt an Andi. Planner muss `waits_for_user`-Marker setzen, damit der Agent nicht endlos pollt.

## Sources

### Primary (HIGH confidence)

- `.planning/codebase/CONCERNS.md` (2026-04-15, lokal verifiziert) — Haupt-Quelle für CF-01..CF-04 + Operational-Kandidaten
- `.planning/REQUIREMENTS.md` (2026-04-16, lokal verifiziert) — SEC-01…SEC-07 Taxonomie + v1/v2-Split
- `.planning/ROADMAP.md` (2026-04-16, lokal verifiziert) — 4 Success Criteria für Phase 1
- `.planning/PROJECT.md` (2026-04-16) — "Fail Loud, Never Fake", Apps-Freigabe-Ausnahme, Scope auf `platform/`
- `.planning/phases/01-security-audit-priorisierung/01-CONTEXT.md` — D-01 bis D-16 Decisions + Deferred
- Live-Code-Stichproben:
  - `platform/apps/hub/server/utils/internal-auth.ts:16` (verifiziert `!==`-Vergleich)
  - `platform/apps/bot/src/utils/internal-sync-server.ts:70-86` (verifiziert `timingSafeEqual`)
  - `platform/apps/hub/server/middleware/03-session.ts` (verifiziert silent-fallback)
  - `platform/apps/hub/server/middleware/02-csrf-check.ts` (verifiziert Skip-Logik)
  - `platform/docker-compose.yml:8, 60, 69, 114` (verifiziert `postgres:postgres`)
  - `platform/package.json:32-48` (verifiziert 12 Overrides)
  - `platform/apps/bot/src/utils/app-hooks.ts:100-160` (verifiziert `new Function()`)
  - `platform/apps/hub/server/api/apps/[...path].ts:50-112` (verifiziert `new Function()`)
  - `platform/apps/hub/server/api/apply/[flowId]/upload.post.ts` + `profile/avatar.put.ts` (verifiziert Upload-Pfade)
  - `platform/apps/hub/server/utils/sanitize.ts` + `apps/web/app/utils/sanitize.ts` (verifiziert DOMPurify-Wrapper)

### Secondary (MEDIUM confidence)

- `.planning/codebase/STRUCTURE.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md` (2026-04-15) — konsistent mit Codebase-Stichproben; Directory-Orientation
- `platform/CLAUDE.md` + Workspace-Root-`CLAUDE.md` — Runtime-Constraints (Container, Ports, no-docker-commands)

### Tertiary (LOW confidence)

- `ripgrep`-Versionsannahme (`rg ≥13`) — nicht verifiziert im Container, aber erwartet verfügbar (A1 in Assumptions Log)

## Metadata

**Confidence breakdown:**
- Grep Pattern Catalog: HIGH — alle 5 Patterns gegen echte Stichproben gegengeprüft
- Candidate Finding Inventory: HIGH — 17 Kandidaten referenzieren konkrete Dateien/Zeilen
- Kopf-Review Questionnaire: MEDIUM — Qualität hängt an Andi-Response-Tiefe, nicht am Framework
- Audit-Doc-Skelett: HIGH — vollständig, D-01 bis D-16 honouriert, Traceability-Entscheidung begründet
- Phase-Mapping-Proposal: MEDIUM — Severity-Guesses bewusst als Vorschläge markiert, final Andi in Wave 5
- Validation Architecture: HIGH — 11 grep-basierte Checks gegen ROADMAP-Success-Criteria und D-06-Metadaten

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 Tage für stabile Doc-Struktur; solange Phase 2 in den nächsten 30 Tagen startet, bleibt das Research gültig). Wenn grösser, Commit-SHAs der referenzierten Code-Stellen re-validieren.
