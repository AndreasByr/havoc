# Phase 3: Auth- & Session-Härtung - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 liefert **gehärtete Authentifizierungs- und Session-Schicht im Hub**: timing-sichere Token-Vergleiche in allen Internal-Auth-Stellen, eine deny-by-default Session-Middleware mit expliziter Public-Allowlist, und gehärtete Cookie/OAuth/Dev-Endpoint-Konfiguration.

**7 Findings aus dem Security-Audit sind in dieser Phase:**

| Finding | Severity | Bereich | Requirement |
|---------|----------|---------|-------------|
| F-02 | High | Session-Middleware nicht deny-by-default | SEC-04 |
| F-03 | High | Timing-unsicherer Token-Vergleich in Hub `internal-auth.ts` | SEC-03 |
| F-04 | High | Timing-unsicherer Token-Vergleich in Matrix-Bot `internal-sync-server.ts` | SEC-03 |
| F-07 | Medium | Dev-Endpoints via `enablePerformanceDebug`-Flag in Prod aktivierbar | SEC-05 |
| F-09 | Medium | Session-Rotation nach Login nicht verifiziert | SEC-05 |
| F-10 | Medium | Cookie-Secure via stille URL-Heuristik (nicht `NODE_ENV`-basiert) | SEC-05 |
| F-17 | Low | CSRF-Skip bei fehlendem Origin/Referer undokumentiert | SEC-05 |

**Nicht-Ziele dieser Phase:**
- F-13 (Rate-Limit Auth-Endpoints) → deferred zu Phase 5
- F-14 (Upload-Path-Traversal) → deferred zu v2
- F-15 (Avatar-Bucket-Bypass) → deferred zu v2
- Keine neuen Tools oder Libraries
- Keine Schema-Änderungen oder Migrationen

</domain>

<decisions>
## Implementation Decisions

### Scope-Abgrenzung

- **D-01:** Phase 3 umfasst genau 7 Findings: F-02, F-03, F-04, F-07, F-09, F-10, F-17. F-13/F-14/F-15 sind explizit deferred (Low-Severity, keine direkten Auth-/Session-Angriffspfade).

### deny-by-default Session-Middleware (F-02)

- **D-02:** Implementierung als **`PUBLIC_PATHS`-Konstante direkt in `03-session.ts`** — eine Array-Konstante mit explizit erlaubten öffentlichen Pfad-Prefixen. Neue public Routes müssen in diese Liste eingetragen werden; keine Nuxt-Route-Rules, kein Decorator-Pattern.
- **D-03:** `internal/locale-context.get.ts` ist der einzige identifizierte Delta-Kandidat (Audit Finding F-02, grep-Scan P-4). Dieser Route wird mit `requireSession()` abgesichert — **nicht** in die Public-Allowlist. Rationale: Locale-Context ist intern; public machen wäre inkonsistent mit dem Deny-by-Default-Prinzip.
- **D-04:** Middleware-Verhalten: Wenn ein Request auf `/api/**` trifft und kein Pfad in `PUBLIC_PATHS` matcht und kein `userSession` gesetzt ist → `401` werfen. "Fail Loud" — kein stilles `userSession=null` für unbekannte Routen mehr.

### Timing-sichere Token-Vergleiche (F-03, F-04)

- **D-05:** Muster aus `platform/apps/bot/src/utils/internal-sync-server.ts:70-73` (`timingSafeEqualString`-Wrapper) wird **kopiert** — nicht in ein Shared-Utility extrahiert. Rationale: Hub und Matrix-Bot haben getrennte Abhängigkeitsgraphen; ein Shared-Utility würde Kopplung schaffen für einen 3-Zeiler.
- **D-06:** Beide Stellen werden gefixt:
  - `platform/apps/hub/server/utils/internal-auth.ts:16` → `token !== expectedToken` durch `timingSafeEqualString` ersetzen
  - `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` → direkten String-Vergleich auf `timingSafeEqualString` umstellen

### Session-Rotation (F-09)

- **D-07:** F-09 wird durch **Verifikation + Dokumentation** geschlossen, nicht durch Code-Änderungen. Rationale: nuxt-auth-utils sealed-cookie-sessions haben keine separate Session-ID — der Cookie-Wert *ist* die versiegelte Payload, die sich bei jedem `replaceUserSession()`-Call vollständig ändert. Session-Fixation ist strukturell nicht möglich. Phase 3 verifiziert dies durch einen Cookie-Before/After-Inspect-Test (manuell oder automatisiert) und dokumentiert das Ergebnis im Phase-Summary.

### Cookie-Secure-Flag (F-10)

- **D-08:** Neue Logik: `secure: process.env.NODE_ENV !== 'development'`. URL-Heuristik (`NUXT_PUBLIC_HUB_URL.startsWith('https://')`) fällt weg. In Prod immer `true`, in Dev immer `false`. Keine `.env`-Pflicht, vorhersagbar ohne Seiteneffekte.
- **D-09:** KEIN Startup-Fail/Warn wenn `secure=false` in non-dev — die `NODE_ENV`-Bindung ist bereits die sicherere Lösung; ein weiterer Check wäre redundant.

### Dev-Endpoints (F-07)

- **D-10:** Dev-Endpoints (`/api/dev/switch-user`, `/api/dev/restore-user`, `/api/dev/users`) werden ausschließlich an `import.meta.dev` gebunden — Build-Zeit-Konstante, die in Prod immer `false` ist. `enablePerformanceDebug`-Flag bleibt im Code, darf aber keine Dev-Endpoints mehr freischalten.
- **D-11:** Implementierung: Early-return `createError({ statusCode: 404 })` wenn `!import.meta.dev` — analog zu existierenden Dev-Guards falls vorhanden.

### CSRF-Skip-Dokumentation (F-17)

- **D-12:** Kein Code-Change. Der `!origin && !referer`-Skip in `02-csrf-check.ts` erhält einen erklärenden Kommentar, der die SSR-Internal-Request-Ausnahme als absichtlich markiert. "Fail Loud" bedeutet hier: wenn man den Code liest, soll klar sein, dass das eine explizite Entscheidung ist.

### Claude's Discretion

- Genaue Form der `PUBLIC_PATHS`-Konstante (Array von Strings, RegExp-Array, Präfix-Match-Funktion) — Planner entscheidet nach bestehenden Patterns
- Test-Format für Session-Rotation-Verifikation (manuell via Cookie-Inspect vs. automatisierter Playwright/Vitest-Test) — Planner entscheidet nach Aufwand
- Reihenfolge der Findings in Plans (Wave-Zuordnung) — Planner entscheidet nach Abhängigkeiten

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security Audit (Pflicht)
- `.planning/research/01-security-audit.md` §5 "Findings — High" [F-02, F-03, F-04] — vollständige Finding-Beschreibungen inkl. Current Mitigation und Fix-Ansatz
- `.planning/research/01-security-audit.md` §6 "Findings — Medium" [F-07, F-09, F-10] — dito für Medium-Findings
- `.planning/research/01-security-audit.md` §7 "Findings — Low" [F-17] — CSRF-Skip-Finding

### Zu ändernde Dateien (alle müssen angefasst werden)
- `platform/apps/hub/server/middleware/03-session.ts` — deny-by-default (F-02)
- `platform/apps/hub/server/utils/internal-auth.ts:16` — timing-safe (F-03)
- `platform/apps/matrix-bot/src/utils/internal-sync-server.ts` — timing-safe (F-04)
- `platform/apps/hub/server/api/dev/switch-user.post.ts` — import.meta.dev-Guard (F-07)
- `platform/apps/hub/server/api/dev/restore-user.post.ts` — import.meta.dev-Guard (F-07)
- `platform/apps/hub/server/api/dev/users.get.ts` — import.meta.dev-Guard (F-07)
- `platform/apps/hub/nuxt.config.ts:36-42` — Cookie-Secure-Fix (F-10)
- `platform/apps/hub/server/middleware/02-csrf-check.ts:15` — Kommentar (F-17)
- `platform/apps/hub/server/api/internal/locale-context.get.ts` — requireSession() hinzufügen (F-02 Delta)

### Existierendes Timing-Safe-Pattern (Kopier-Quelle)
- `platform/apps/bot/src/utils/internal-sync-server.ts:70-73` — `timingSafeEqualString`-Wrapper, direkt in Hub und Matrix-Bot kopieren

### Anforderungen
- `.planning/REQUIREMENTS.md` §SEC-03 — Timing-sichere Token-Vergleiche (F-03, F-04)
- `.planning/REQUIREMENTS.md` §SEC-04 — deny-by-default Session-Middleware (F-02)
- `.planning/REQUIREMENTS.md` §SEC-05 — Auth/OAuth-Härtung (F-07, F-09, F-10, F-17)
- `.planning/ROADMAP.md` §"Phase 3: Auth- & Session-Härtung" — Goal + Success Criteria

### Auth-Utilities (Kontext für Planner)
- `platform/apps/hub/server/utils/auth.ts` — requireSession(), requireAdminSession(), requireRole() — bestehende Guard-Pattern
- `platform/apps/hub/server/utils/auth-session.ts` — replaceAuthSessionForUserId(), replaceAuthSession() — Session-Replacement-Implementierung
- `platform/apps/hub/server/middleware/01-rate-limit.ts` — bestehendes Rate-Limit-Middleware für Referenz

### Workspace-Konventionen
- `platform/CLAUDE.md` — Runtime-Einschränkungen, "Fail Loud, Never Fake"-Prinzip

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/apps/bot/src/utils/internal-sync-server.ts:70-73` — `timingSafeEqualString`-Wrapper für Bytes-Vergleich. Direkt kopierbar für Hub und Matrix-Bot.
- `platform/apps/hub/server/utils/auth.ts` — `requireSession()`, `requireAdminSession()`, `requireModeratorSession()` — bestehende Guard-Pattern; `locale-context.get.ts` bekommt denselben Guard.
- `platform/apps/hub/server/middleware/02-csrf-check.ts` — bestehende PUBLIC_PATH-Ausnahmen (`/api/csrf-token`, `/api/auth/discord`) als Orientierung für PUBLIC_PATHS-Konstante in 03-session.ts.

### Established Patterns
- Hub-Server-Middleware folgt Nummerierungskonvention (`01-rate-limit`, `02-csrf-check`, `03-session`). Kein neues Middleware-File nötig — `03-session.ts` wird erweitert.
- nuxt-auth-utils sealed-cookie-sessions: keine separate Session-ID, Cookie-Wert = versiegelte Payload. `replaceUserSession()` = neuer Cookie-Wert. Session-Fixation strukturell nicht möglich.
- `nuxt.config.ts:30` hat bereits `auth: {}` Block; Session-Cookie-Config steht bei `runtimeConfig.session.cookie`.

### Integration Points
- `03-session.ts` → muss PUBLIC_PATHS vor der Session-Validierung prüfen; Pattern: `if (PUBLIC_PATHS.some(p => event.path.startsWith(p))) return`
- `internal-auth.ts` → wird von MCP-Internal-Endpoints genutzt; Fix ist Drop-in (Signatur unverändert)
- Matrix-Bot `internal-sync-server.ts` → standalone Node.js http-Server; kein nuxt-auth-utils; timingSafeEqualString ist lokaler Wrapper

</code_context>

<specifics>
## Specific Ideas

- **timingSafeEqualString-Pattern:** `Buffer.from(a).length === Buffer.from(b).length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` — Längen-Pre-Check verhindert Buffer-Längen-Leak.
- **PUBLIC_PATHS-Konstante Beispiel-Form:** `const PUBLIC_PATHS = ['/api/public/', '/api/auth/', '/api/csrf-token', '/api/setup/', '/api/theme.get', '/api/landing/']` — Planner passt die genaue Liste nach grep-Scan an.
- **import.meta.dev-Guard in Dev-Endpoints:** `if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found.' })` — früh im Handler, vor jeglicher Logik.
- **CSRF-Kommentar-Ziel:** Kommentar soll den *warum* erklären ("SSR-internal requests originate from the Nitro server itself and carry no Origin header — this is not a security hole but an expected server-side request pattern"), nicht nur das *was*.

</specifics>

<deferred>
## Deferred Ideas

- **F-13: Auth-Rate-Limit** — separates, engeres Rate-Limit für `/api/auth/*` Endpoints. Low-Severity, bestehende globale Limite decken den Prod-Use-Case ab. Deferred zu Phase 5 (CI & API-Tests), wo Rate-Limit-Stabilität sowieso betrachtet wird.
- **F-14: Upload-Path-Traversal** — Path.resolve()-Boundary-Check für `flowId`/`discordId` in Upload-Endpoint. Low-Severity mit bestehenden Mitigations (Token-Payload, Sanitizer). Deferred zu v2.
- **F-15: Avatar-Bucket-Bypass** — Avatar-Storage auf denselben Bucket-Service wie andere Uploads umstellen. Low-Severity. Deferred zu v2.
- **enablePerformanceDebug-Flag bereinigen** — Flag aus public config entfernen wenn er ausschließlich Dev-Endpoints kontrolliert. Wurde besprochen; "nur import.meta.dev binden" ist der gewählte Ansatz für Phase 3. Cleanup des Flags kann später in einem Tech-Debt-Sweep erfolgen.

</deferred>

---

*Phase: 03-auth-session-härtung*
*Context gathered: 2026-04-17*
