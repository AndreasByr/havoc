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

### [F-01] Unsandboxed Plugin-Code-Execution via `new Function()` — drei Execution-Sites

- **Severity:** Critical
- **Area:** Apps-Plugin
- **Datei-Pfad(e):** `platform/apps/bot/src/utils/app-hooks.ts:128`, `platform/apps/hub/server/api/apps/[...path].ts:86`, `platform/apps/hub/app/plugins/vue3-sfc-loader.client.ts` (Browser-seitig via vue3-sfc-loader)
- **Current Mitigation:** `require()` ist blockiert; für Hub-API-Routes sind nur whitelisted h3-Helpers injiziert; Apps müssen aktiv sein mit validem Manifest; Role-Based-Access wird vor Handler-Ausführung geprüft. Client-seitige Execution (vue3-sfc-loader) läuft ausschließlich im Browser (`ssr: false`), kein Server-SSR-Render von App-Code. Die h3-Helper-Whitelist enthält jedoch 5 überflüssige Helpers (defineEventHandler, setResponseHeader, setResponseStatus, sendNoContent, getHeader), die Response-Manipulation ermöglichen — solange raw `event` übergeben wird und App im Host-Prozess läuft, ist Whitelist-Schutz begrenzt.
- **Fix-Ansatz:** Echte Sandbox-Isolation für Server-seitige Execution einführen (Tech-Auswahl: Phase 2 Research); h3-Helper-Whitelist auf Minimal-Set reduzieren und durch Capability-Wrapper statt raw-event-Übergabe ersetzen.
- **Target Phase:** Phase 2 (SEC-02)
- **Discovered-By:** CONCERNS.md §"No Sandboxing for Plugin Code Execution" (CF-01) + grep-Scan P-2 (beide Server-Sites bestätigt) + Kopf-Review §A.2 (CF-18: dritte Browser-Site via vue3-sfc-loader) + Kopf-Review §A.3 (CF-19: h3-Whitelist-Surface)

## 5. Findings — High

### [F-02] Session-Middleware nicht deny-by-default

- **Severity:** High
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/middleware/03-session.ts`
- **Current Mitigation:** Jeder sensible Endpoint ruft explizit `requireSession()`, `requireAdminSession()`, `requireModeratorSession()` oder `requireModeratorRight()` auf. Bekannte Public-Endpoints (`/api/public/*`, `/api/auth/*`, `/api/theme.get`, `/api/setup/*`) überspringen Auth absichtlich. Grep-Scan P-4 fand nur 1 Delta-Kandidat (`internal/locale-context.get.ts`) außerhalb der Expected-Public-Liste.
- **Fix-Ansatz:** Session-Middleware erweitern: Routen, die nicht in der expliziten Public-Allowlist stehen, werden mit 401 geblockt statt `userSession=null` zu setzen; `locale-context.get.ts` explizit als public markieren oder absichern.
- **Target Phase:** Phase 3 (SEC-04)
- **Discovered-By:** CONCERNS.md §"Session Middleware Does Not Block Unauthenticated Requests" (CF-04) + grep-Scan P-4 (Delta-Kandidat bestätigt)

### [F-03] Timing-unsicherer Token-Vergleich im Hub-Internal-Auth

- **Severity:** High
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/utils/internal-auth.ts:16`
- **Current Mitigation:** Endpoint ist nur vom internen Docker-Netz aus erreichbar (kein öffentliches Routing). Bot-Seite (`internal-sync-server.ts:70-86`) nutzt bereits `crypto.timingSafeEqual` korrekt — Inkonsistenz nur auf der Hub-Seite.
- **Fix-Ansatz:** `token !== expectedToken` durch `timingSafeEqual`-Wrapper mit Längen-Pre-Check ersetzen (Pattern aus `internal-sync-server.ts` wiederverwenden).
- **Target Phase:** Phase 3 (SEC-03)
- **Discovered-By:** CONCERNS.md §"Non-Timing-Safe Token Comparison in Internal Auth" (CF-02) + grep-Scan P-1 (Hub-Fundstelle bestätigt)

### [F-04] Timing-unsicherer Token-Vergleich im Matrix-Internal-Sync-Server

- **Severity:** High
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/matrix-bot/src/utils/internal-sync-server.ts:70`
- **Current Mitigation:** Matrix-Bot-Port ist nicht öffentlich gemappt (nur interner Docker-Traffic). Direkter Stringvergleich `authHeader !== 'Bearer ${token}'` — identisches Muster wie F-03, aber separate Codebase.
- **Fix-Ansatz:** `!==`-Vergleich auf `timingSafeEqualString`-Wrapper umstellen (Pattern bereits in Discord-Bot `internal-sync-server.ts:70-73` vorhanden — kopieren).
- **Target Phase:** Phase 3 (SEC-03)
- **Discovered-By:** Kopf-Review §B.1 (CF-20: Andi bestätigte direkten Stringvergleich)

## 6. Findings — Medium

### [F-05] Hartcodierte Standard-Credentials in `docker-compose.yml`

- **Severity:** Medium
- **Area:** Supply-Chain
- **Datei-Pfad(e):** `platform/docker-compose.yml:7-9, 60, 69, 114`
- **Current Mitigation:** Datenbank liegt im internen Docker-Netz (`guildora_internal`), nicht direkt internet-exponiert. Nur andere Container im selben Netz können verbinden. `.env.example:32` enthält denselben Default `postgres:postgres` als Dev-Placeholder.
- **Fix-Ansatz:** `POSTGRES_PASSWORD`, `POSTGRES_USER` und alle `DATABASE_URL`-Werte auf `${VAR}`-Substitution umstellen; `.env.example` mit "MUST replace before production"-Warnung versehen.
- **Target Phase:** Phase 4 (SEC-06)
- **Discovered-By:** CONCERNS.md §"Default Database Credentials in Docker Compose" (CF-03) + grep-Scan P-3 (alle 4 Zeilen bestätigt) + Kopf-Review §D.3 (CF-03-Ergänzung: vollständige Liste inkl. DATABASE_SSL: false)

### [F-06] App-Sideload ohne Integritäts-Check und mit TOCTOU-Risiko

- **Severity:** Medium
- **Area:** Apps-Plugin
- **Datei-Pfad(e):** `platform/apps/hub/server/utils/app-sideload.ts`
- **Current Mitigation:** Sideloading ist superadmin-gated und optional per `enableSideloading`-Flag. esbuild transpiliert den Code vor Ablage in DB. Kein Hash- oder Signatur-Vergleich zwischen Manifest-Fetch und Code-Fetch.
- **Fix-Ansatz:** Code-Fetch auf denselben Commit-SHA wie Manifest-Fetch pinnen, um TOCTOU zu schließen; Manifest-Hash oder Signatur-Prüfung vor DB-Ablage einführen.
- **Target Phase:** Phase 2 (SEC-02)
- **Discovered-By:** 01-RESEARCH.md §CF-09 (Integrity-Check fehlt) + Kopf-Review §F.1 (CF-28: TOCTOU bestätigt)

### [F-07] `/api/dev/*` Endpoints via Performance-Debug-Flag in Prod aktivierbar

- **Severity:** Medium
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/api/dev/switch-user.post.ts`, `platform/apps/hub/server/api/dev/restore-user.post.ts`, `platform/apps/hub/server/api/dev/users.get.ts`
- **Current Mitigation:** Endpoints sind durch `import.meta.dev || NODE_ENV===development || config.public.enablePerformanceDebug` gated. Mit Session+Rollencheck, aber: wenn `NUXT_PUBLIC_ENABLE_PERFORMANCE_DEBUG=true` in Prod gesetzt wird, sind privilegierte Impersonation-Endpoints aktiv unabhängig von NODE_ENV.
- **Fix-Ansatz:** Dev-Endpoints ausschließlich an `import.meta.dev` binden (Build-Zeit-Konstante); `enablePerformanceDebug`-Flag darf nie Dev-Endpoints freischalten.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** Kopf-Review §C.5 (CF-24: Andi bestätigte Debug-Flag-Pfad)

### [F-08] MCP-Server als unbenutzter Angriffspfad auf `/api/internal/landing/*`

- **Severity:** Medium
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/packages/mcp-server/src/index.ts`, `platform/apps/hub/server/api/internal/landing/`
- **Current Mitigation:** MCP-Server ist optional und aktuell kaum genutzt. Internal-Endpoints sind token-gated. Hub-Frontend nutzt `/api/admin/landing/*`, nicht `/api/internal/landing/*` — MCP-Pfad ist unabhängig vom normalen Betrieb.
- **Fix-Ansatz:** MCP-Server entweder entfernen (wenn kein aktiver Use-Case) oder `/api/internal/landing/*`-Endpoints korrekt mit Startup-Check auf konfiguriertes Token absichern; Entscheidung in Phase 2.
- **Target Phase:** Phase 2 (SEC-02)
- **Discovered-By:** Kopf-Review §B.3 (CF-21: Andi bestätigte "eingebaut aber optional/kaum genutzt")

### [F-09] Session-Rotation nach Login nicht implementiert

- **Severity:** Medium
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/utils/auth.ts` (replaceAuthSessionForUserId), `nuxt-auth-utils` (replaceUserSession)
- **Current Mitigation:** `replaceUserSession()` aus nuxt-auth-utils führt `session.clear() + session.update(data)` aus. h3 bietet kein separates `regenerate()`-Primitive. Ob clear()+update() praktisch Session-Fixation verhindert, ist nicht verifiziert.
- **Fix-Ansatz:** Prüfen ob h3-Cookie-Sessions durch clear()+update() neue Session-ID erhalten (Inspect Cookie-Wert vor/nach Login); falls nicht: explizite Session-Rotation via Cookie-Invalidierung und Neuausstellung implementieren.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** Kopf-Review §C.3 (CF-23: Andi bestätigte offene Session-Rotation)

### [F-10] Cookie-Secure-Flag mit Silent-Insecure-Fallback

- **Severity:** Medium
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/nuxt.config.ts:40-42`
- **Current Mitigation:** Wenn `NUXT_SESSION_COOKIE_SECURE` nicht explizit gesetzt ist, fällt `session.cookie.secure` auf `false`, wenn `NUXT_PUBLIC_HUB_URL` nicht mit `https://` beginnt. In Prod mit korrekter HTTPS-URL greift das Flag automatisch. Lokales Dev auf HTTP ist erwartet.
- **Fix-Ansatz:** Default auf `true` setzen; nur explizit auf `false` wenn `NODE_ENV=development` (nie aus URL-Heuristik ableiten); beim Start in nicht-dev warnen/failen wenn Secure=false.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** Kopf-Review §D.2 (CF-26: Silent-Insecure-Fallback bestätigt) + 01-RESEARCH.md §CF-17

## 7. Findings — Low

### [F-11] Kein Startup-Fail bei Placeholder-Tokens

- **Severity:** Low
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/bot/src/index.ts`, `platform/apps/matrix-bot/src/index.ts`, `platform/apps/hub/server/plugins/` (Token-Initialisierung)
- **Current Mitigation:** `BOT_INTERNAL_TOKEN`, `HUB_INTERNAL_TOKEN` und `MCP_TOKEN` werden beim Start gelesen. Kein expliziter Check ob Token leer, zu kurz oder ein bekannter Placeholder-String ist. Lokale `.env` enthält ersetzten Wert (`dev-internal-sync-token-lokal`).
- **Fix-Ansatz:** Beim Start hard-failen wenn Token leer, kürzer als Mindestlänge oder gleich bekanntem Placeholder-String (`replace_with_...`); "Fail Loud, Never Fake"-Prinzip anwenden.
- **Target Phase:** Phase 4 (SEC-06)
- **Discovered-By:** Kopf-Review §B.4 (CF-22: Andi schlug Startup-Check vor)

### [F-12] `pnpm.overrides` ohne dokumentierte CVE-Zuordnung

- **Severity:** Low
- **Area:** Supply-Chain
- **Datei-Pfad(e):** `platform/package.json:32-48` (12 Override-Einträge)
- **Current Mitigation:** 12 Overrides für serialize-javascript, undici, node-forge, h3, srvx, postcss und weitere. Paket-Versionen sind gepinnt. Andi kann CVE-Zuordnung nicht aus dem Kopf nennen.
- **Fix-Ansatz:** Jeden Override mit CVE-Nummer oder Begründungs-Kommentar versehen; prüfen ob Upstream inzwischen gepatcht hat und Override entfernt werden kann.
- **Target Phase:** Phase 4 (SEC-07)
- **Discovered-By:** Kopf-Review §D.1 (CF-25: undokumentierte Overrides bestätigt) + 01-RESEARCH.md §CF-14

### [F-13] Rate-Limit zu grob für Brute-Force-Schutz

- **Severity:** Low
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/middleware/01-rate-limit.ts:7`
- **Current Mitigation:** Globales Rate-Limit 300 Requests/60s/IP. Kein Pro-Endpoint-Limit für `/api/auth/*`. Bei 300 Requests/Minute sind enumeration-Angriffe auf Login-Endpoints durchführbar.
- **Fix-Ansatz:** Separates, engeres Rate-Limit für Auth-Endpoints (`/api/auth/*`) einrichten; Brute-Force-Pattern erfordert niedrigere Schwelle als globaler Traffic.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** 01-RESEARCH.md §CF-16 (Security-Einordnung per Pitfall-4-Dichotomie: Angreifer-Pfad beschreibbar)

### [F-14] Upload-Pfad schreibt in `process.cwd()/data/application-uploads/`

- **Severity:** Low
- **Area:** Uploads
- **Datei-Pfad(e):** `platform/apps/hub/server/api/apply/[flowId]/upload.post.ts:47`
- **Current Mitigation:** Dateiname wird mit `replace(/[^a-zA-Z0-9._-]/g, "_")` sanitisiert. Zugriff auf Upload-Endpoint erfordert gültiges Application-Token. `flowId` und `discordId` aus Token-Payload — nicht frei wählbar.
- **Fix-Ansatz:** Prüfen ob `flowId`/`discordId`-Werte aus Token-Payload Path-Traversal via `../` ermöglichen (wenn unsanitisiert in Pfad); Path-Join durch `path.resolve()` + Boundary-Check absichern.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** 01-RESEARCH.md §CF-15

### [F-15] Avatar-Upload-Flow bypassed Bucket-Storage

- **Severity:** Low
- **Area:** Uploads
- **Datei-Pfad(e):** `platform/apps/hub/server/api/profile/avatar.put.ts`
- **Current Mitigation:** Avatar-Upload schreibt lokal nach `public/uploads/avatars/*` — auch wenn R2/Bucket konfiguriert ist. Avatare sind über statisches Serving öffentlich erreichbar. Bewerbungs-Dateien (sensibel) gehen korrekt über API mit Auth-Check.
- **Fix-Ansatz:** Avatar-Storage-Pfad auf denselben Media/Bucket-Service umstellen wie andere Uploads; lokale `public/uploads/avatars/`-Auslieferung deaktivieren wenn Bucket aktiv.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** Kopf-Review §E.3 (CF-27: Andi identifizierte Avatar-Bucket-Bypass)

### [F-16] Fehlende Audit-Logs für Security-Events

- **Severity:** Low
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/api/auth/`, `platform/apps/hub/server/api/admin/apps/`, `platform/apps/hub/server/api/admin/roles/`
- **Current Mitigation:** keine — Security-Events (fehlgeschlagene Logins, Role-Changes, App-Installs, Token-Revoke) werden nicht als strukturierte Audit-Entries persistiert; nur flüchtiges Console-/Nitro-Logging.
- **Fix-Ansatz:** Für Security-Events strukturierte Log-Entries einführen (wer, was, wann, Ergebnis); UI-Fehlermeldungen bei Auth-Flows informativer gestalten ohne interne Details preiszugeben.
- **Target Phase:** Phase 4 (SEC-05 adjacent)
- **Discovered-By:** Kopf-Review §G.1 (CF-29: Andi bestätigte Audit-Log-Lücken)

### [F-17] CSRF-Skip bei fehlendem Origin/Referer-Header

- **Severity:** Low
- **Area:** Auth/Session
- **Datei-Pfad(e):** `platform/apps/hub/server/middleware/02-csrf-check.ts:15`
- **Current Mitigation:** CSRF-Check wird übersprungen wenn weder `Origin` noch `Referer` gesetzt sind (SSR-Internal-Request-Exception). Andi sieht keinen klaren externen Angriffspfad mit aktuellem Setup. Token-basierter CSRF-Schutz greift für Browser-Requests.
- **Fix-Ansatz:** Exception-Logik dokumentieren und per Kommentar als absichtliche SSR-Ausnahme markieren; evaluieren ob Exception in Phase 3 weiter eingeschränkt werden kann.
- **Target Phase:** Phase 3 (SEC-05)
- **Discovered-By:** 01-RESEARCH.md §CF-07 + Kopf-Review §C.2 (kein Angriffspfad sichtbar — Low bestätigt)

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
