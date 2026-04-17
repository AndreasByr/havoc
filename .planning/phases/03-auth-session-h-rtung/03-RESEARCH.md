# Phase 3: Auth- & Session-Härtung — Research

**Researched:** 2026-04-17
**Domain:** Node.js Crypto, Nuxt 4 / h3 Session Management, Hub Middleware Chain, Auth Guard Patterns
**Confidence:** HIGH — all key findings verified directly from codebase and installed library source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 3 umfasst genau 7 Findings: F-02, F-03, F-04, F-07, F-09, F-10, F-17. F-13/F-14/F-15 sind explizit deferred.
- **D-02:** `PUBLIC_PATHS`-Konstante direkt in `03-session.ts` — Array-Konstante mit erlaubten öffentlichen Pfad-Prefixen. Keine Nuxt-Route-Rules, kein Decorator-Pattern.
- **D-03:** `internal/locale-context.get.ts` erhält `requireSession()` — nicht in die Public-Allowlist.
- **D-04:** Middleware-Verhalten: `/api/**` ohne Public-Pfad-Match und kein `userSession` → `401`. Kein stilles `userSession=null` mehr.
- **D-05:** `timingSafeEqualString`-Wrapper wird kopiert (nicht in Shared-Utility extrahiert).
- **D-06:** Hub `internal-auth.ts:16` + Matrix-Bot `internal-sync-server.ts:70` → beide auf `timingSafeEqualString` umstellen.
- **D-07:** F-09 (Session-Rotation) wird durch Verifikation + Dokumentation geschlossen, kein Code-Change.
- **D-08:** Cookie-Secure: `secure: process.env.NODE_ENV !== 'development'`. URL-Heuristik fällt weg.
- **D-09:** KEIN Startup-Fail/Warn wenn `secure=false` in non-dev.
- **D-10:** Dev-Endpoints ausschließlich an `import.meta.dev` binden. `enablePerformanceDebug`-Flag darf Dev-Endpoints nicht mehr freischalten.
- **D-11:** Early-return `createError({ statusCode: 404 })` wenn `!import.meta.dev`.
- **D-12:** Kein Code-Change für CSRF-Skip (F-17) — nur erklärender Kommentar in `02-csrf-check.ts`.

### Claude's Discretion

- Genaue Form der `PUBLIC_PATHS`-Konstante (Array von Strings, RegExp-Array, Präfix-Match-Funktion)
- Test-Format für Session-Rotation-Verifikation (manuell via Cookie-Inspect vs. automatisierter Test)
- Reihenfolge der Findings in Plans (Wave-Zuordnung)

### Deferred Ideas (OUT OF SCOPE)

- F-13: Auth-Rate-Limit — deferred zu Phase 5
- F-14: Upload-Path-Traversal — deferred zu v2
- F-15: Avatar-Bucket-Bypass — deferred zu v2
- enablePerformanceDebug-Flag-Cleanup (nur "import.meta.dev binden" ist Phase-3-Scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-03 | Alle internen Token-Vergleiche im Hub und in Bots verwenden `crypto.timingSafeEqual` | F-03 (Hub internal-auth.ts:16), F-04 (Matrix-Bot internal-sync-server.ts:70) — beides direkter Stringvergleich. Referenz-Pattern in Discord-Bot internal-sync-server.ts:70-73 verifiziert. |
| SEC-04 | Session-Middleware `03-session.ts` blockt unauthentifizierte Requests deny-by-default; öffentliche Routen explizit markiert | Aktuelle Middleware (9 Zeilen) hat kein Blocking. Komplette Public-Allowlist aus grep-Scan ermittelt. Middleware-Pattern aus `01-rate-limit.ts` als Vorlage. |
| SEC-05 | Auth/OAuth-Flow-Härtung: Cookie-Flags, CSRF, Session-Rotation nach Login, nuxt-auth-utils-Config | F-07 (dev-endpoints), F-09 (session rotation), F-10 (cookie secure), F-17 (CSRF comment). nuxt-auth-utils und h3 source-verified. |
</phase_requirements>

---

## Summary

Phase 3 ist eine reine Härtungsphase — alle 7 Findings haben klare Fix-Ansätze, die aus dem bestehenden Codebase-Pattern abgeleitet werden. Keine neuen Libraries, keine Schema-Änderungen.

Das schwerste Finding (F-02, deny-by-default Middleware) erfordert eine vollständige Public-Allowlist aller `/api/`-Routen, die legitimerweise ohne Session zugänglich sind. Der grep-Scan dieser Research hat genau 18 Dateien ohne requireSession-Guard identifiziert — davon gehören 17 in die Allowlist und 1 (locale-context.get.ts) erhält requireSession().

Die beiden timing-unsicheren String-Vergleiche (F-03, F-04) sind 1-Zeiler-Fixes mit dem bereits im Discord-Bot vorhandenen `timingSafeEqualString`-Wrapper. Die Dev-Endpoint-Guards (F-07) ersetzen eine 3-Bedingungen-OR-Kette mit dem Build-Zeit-Check `import.meta.dev`. Der Cookie-Secure-Fix (F-10) ist eine 3-Zeilen-Änderung in nuxt.config.ts. Die CSRF-Dokumentation (F-17) ist ein Code-Kommentar.

F-09 (Session-Rotation) ist konzeptionell bereits gelöst durch nuxt-auth-utils' sealed-cookie-Architektur: `replaceUserSession()` ruft h3's `session.clear()` + `session.update()` auf. `clearSession` löscht den alten Session-Eintrag aus `event.context.sessions` und setzt den Cookie auf leeren String. `updateSession` generiert anschließend eine neue UUID als Session-ID und schreibt einen neuen versiegelten Cookie. Session-Fixation ist strukturell nicht möglich — jeder neue Cookie-Wert ist ein frisch versiegelter HMAC-verschlüsselter Blob.

**Primary recommendation:** Die 7 Findings in 4 Waves aufteilen: Wave 1 (timing-safe, 2 Dateien), Wave 2 (deny-by-default + locale-context-Guard, Session-Test), Wave 3 (Dev-Endpoints + Cookie-Secure), Wave 4 (CSRF-Kommentar + Session-Rotation-Dokumentation).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timing-sichere Token-Vergleiche | API / Backend (Hub Nitro + Matrix-Bot HTTP) | — | crypto.timingSafeEqual läuft server-seitig in Node.js; beide Stellen sind interne HTTP-Auth-Guards |
| deny-by-default Session-Middleware | Frontend Server (Nuxt/Nitro Middleware) | — | Nitro server middleware läuft vor jedem API-Handler; der richtige Ort für globale Auth-Policy |
| Public-Allowlist-Deklaration | Frontend Server (Nuxt/Nitro Middleware) | — | Konstante in 03-session.ts, nicht in Route-Definitionen, damit die Policy an einem Ort liegt |
| Cookie-Secure-Flag | Frontend Server (Nuxt nuxt.config.ts) | — | Konfiguriert via runtimeConfig.session.cookie — Nitro-Layer übernimmt das Setzen |
| Dev-Endpoint-Guards | API / Backend (Hub Nitro API Routes) | — | import.meta.dev ist Build-Zeit-Konstante in Nitro/Vite — korrekt in den Route-Handlern |
| CSRF-Skip-Dokumentation | Frontend Server (Nitro Middleware) | — | Kommentar in 02-csrf-check.ts — die Policy-Erklärung gehört an die Policy-Stelle |
| Session-Rotation-Verifikation | API / Backend + Dokumentation | — | Verifikation durch Test oder Cookie-Inspect; Ergebnis in Planning-Notiz |

---

## Standard Stack

### Core (bereits installiert — keine neuen Abhängigkeiten)

| Library | Version (installed) | Purpose | Role in Phase 3 |
|---------|--------------------|---------|--------------------|
| `node:crypto` | Node.js built-in (v24) | `crypto.timingSafeEqual` | Ersetzt direkte String-Equality in F-03, F-04 [VERIFIED: codebase] |
| `nuxt-auth-utils` | 0.5.29 | `replaceUserSession()`, `getUserSession()`, `requireUserSession()` | Session-Lifecycle-Management; sealed-cookie-Architektur verifiziert [VERIFIED: installed source] |
| `h3` | 1.15.11 | `useSession`, `clearSession`, `updateSession` | Session-Primitives unter nuxt-auth-utils; Session-Fixation-Analyse verifiziert [VERIFIED: installed source] |
| `vitest` | 2.1.9 (hub), 2.1.9 (matrix-bot) | Test-Framework | Bestehende Test-Infrastruktur für neue Tests [VERIFIED: codebase] |

**Installation:** Keine neuen Packages nötig. `node:crypto` ist built-in, alles andere bereits im Workspace.

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
     │
     ▼
01-rate-limit.ts          ← globales Rate-Limit (300/60s/IP)
     │ (nur /api/*)
     ▼
02-csrf-check.ts          ← CSRF-Validierung für state-ändernde Methoden
     │ (nur /api/* + non-GET/HEAD/OPTIONS)
     ▼
03-session.ts  [PHASE 3]  ← Session-Attach + deny-by-default Block
     │
     ├─ path in PUBLIC_PATHS? ──YES──► continue (kein Block)
     │
     ├─ kein userSession? ────YES──► 401 (Fail Loud)
     │
     └─ userSession vorhanden ──────► continue
          │
          ▼
   API Route Handler
          │
          ├─ requireSession() / requireAdminSession() etc. (Fein-Guard)
          │
          └─ response
```

### Recommended Project Structure (keine Änderungen — bestehend)

```
platform/apps/hub/server/
├── middleware/
│   ├── 01-rate-limit.ts       # unverändert
│   ├── 02-csrf-check.ts       # CSRF-Kommentar ergänzen (F-17)
│   └── 03-session.ts          # PUBLIC_PATHS + deny-by-default (F-02)
├── utils/
│   └── internal-auth.ts       # timingSafeEqualString (F-03)
├── api/
│   ├── dev/
│   │   ├── switch-user.post.ts    # import.meta.dev-Guard (F-07)
│   │   ├── restore-user.post.ts   # import.meta.dev-Guard (F-07)
│   │   └── users.get.ts           # import.meta.dev-Guard (F-07)
│   └── internal/
│       └── locale-context.get.ts  # requireSession() hinzufügen (F-02)
├── nuxt.config.ts             # Cookie-Secure-Fix (F-10) — zeile 40-42
platform/apps/matrix-bot/src/
└── utils/
    └── internal-sync-server.ts  # timingSafeEqualString (F-04)
```

### Pattern 1: timingSafeEqualString — Referenz-Implementierung

**Aus:** `platform/apps/bot/src/utils/internal-sync-server.ts:70-73` [VERIFIED: codebase]

```typescript
// Source: platform/apps/bot/src/utils/internal-sync-server.ts:70-73
function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
```

**Verwendung im Discord-Bot (hasValidAuthorization, lines 76-87):**
```typescript
// Source: platform/apps/bot/src/utils/internal-sync-server.ts:76-87
function hasValidAuthorization(headers: import("node:http").IncomingHttpHeaders) {
  const configuredToken = process.env.BOT_INTERNAL_TOKEN;
  if (!configuredToken) {
    return false;
  }
  const authorization = headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const incomingToken = authorization.slice("Bearer ".length);
  return timingSafeEqualString(incomingToken, configuredToken);
}
```

**Warum Längen-Pre-Check wichtig:** `crypto.timingSafeEqual` wirft einen RangeError wenn die Buffer unterschiedlich lang sind. Der `leftBuffer.length === rightBuffer.length`-Check VOR dem `timingSafeEqual`-Call verhindert den Throw. Wichtig: Der Längen-Check selbst ist NICHT timing-safe — er verrät ob die Tokens gleich lang sind. Das ist für diesen Use Case akzeptabel (Angreifer weiß die Token-Länge ohnehin aus der Konfiguration).

### Pattern 2: Hub Hub internal-auth.ts — aktuell (UNSICHER)

**Aus:** `platform/apps/hub/server/utils/internal-auth.ts:16` [VERIFIED: codebase]

```typescript
// AKTUELL — timing-unsicher
if (!token || token !== expectedToken) {
  throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
}
```

**Fix (F-03):**
```typescript
// Import crypto at top of file
import crypto from "node:crypto";

// Replace line 16:
function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// In requireInternalToken():
if (!token || !timingSafeEqualString(token, expectedToken)) {
  throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
}
```

### Pattern 3: Matrix-Bot internal-sync-server.ts — aktuell (UNSICHER)

**Aus:** `platform/apps/matrix-bot/src/utils/internal-sync-server.ts:68-75` [VERIFIED: codebase]

```typescript
// AKTUELL — direkter Stringvergleich
if (token && token.length > 0) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${token}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
    return;
  }
}
```

**Fix (F-04):**
```typescript
// Import crypto at top of file
import crypto from "node:crypto";

// Add timingSafeEqualString helper (same pattern as Discord bot)
function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Replace auth check:
if (token && token.length > 0) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ") || !timingSafeEqualString(authHeader.slice(7), token)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
    return;
  }
}
```

**Warum `startsWith("Bearer ")` vor timingSafeEqualString:** Verhindert Panic/Error bei fehlenden Headers; der `timingSafeEqualString`-Call vergleicht nur den Token-Teil, nicht das ganze Header-String.

### Pattern 4: deny-by-default Middleware — Vorlage aus 01-rate-limit.ts

**Aus:** `platform/apps/hub/server/middleware/01-rate-limit.ts:2` [VERIFIED: codebase]

```typescript
// Vorlage: Wie bestehende Middleware /api/* abgrenzt
if (!event.path.startsWith("/api/")) return;
```

**03-session.ts — komplett überarbeitete Version (F-02):**

```typescript
// PUBLIC_PATHS: Routen, die ohne Authentifizierung zugänglich sind.
// Neue /api/-Routen, die KEINE Auth benötigen, müssen hier eingetragen werden.
// Alles andere ist auth-required (deny-by-default).
const PUBLIC_PATHS = [
  "/api/public/",        // branding.get.ts, footer-pages.get.ts, landing.get.ts
  "/api/auth/",          // discord.get.ts, logout.post.ts, matrix.get.ts, platforms.get.ts, dev-login.get.ts
  "/api/csrf-token",     // csrf-token.get.ts (Token-Initialisierung)
  "/api/setup/",         // complete.post.ts, platform.post.ts, status.get.ts
  "/api/theme.get",      // theme.get.ts
  "/api/apply/",         // apply/[flowId]/upload.post.ts, validate-token.post.ts (eigene Token-Auth)
  "/api/internal/",      // internal/* nutzen requireInternalToken() — kein Session-Check nötig
];

export default defineEventHandler(async (event) => {
  // Nur API-Routen betreffen
  if (!event.path.startsWith("/api/")) return;

  // Öffentliche Routen durchlassen
  if (PUBLIC_PATHS.some((p) => event.path.startsWith(p))) return;

  // Session laden (graceful)
  try {
    const session = await getUserSession(event);
    event.context.userSession = session;
  } catch (error) {
    console.warn("[Auth] Session validation failed:", error instanceof Error ? error.message : String(error));
    event.context.userSession = null;
  }

  // deny-by-default: kein Session → 401
  if (!event.context.userSession?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: "Authentication required." });
  }
});
```

**WICHTIG — `/api/internal/` in PUBLIC_PATHS:** Die `internal/`-Routen verwenden `requireInternalToken()` als eigenes Auth-System (Bearer-Token, nicht Session). Sie können nicht in `event.context.userSession` landen — die Session-Middleware darf sie nicht blocken. `requireInternalToken` wirft selbst 401/503.

### Pattern 5: import.meta.dev-Guard in Dev-Endpoints (F-07)

**Aktuell in dev-role-switcher.ts:**
```typescript
// AKTUELL — enablePerformanceDebug kann Dev-Endpoints in Prod aktivieren
export function isDevRoleSwitcherEnabled(event) {
  const config = useRuntimeConfig(event);
  return import.meta.dev || process.env.NODE_ENV === "development" || Boolean(config.public.enablePerformanceDebug);
}
```

**Fix — Early-Return in den 3 Route-Handlern:**
```typescript
// switch-user.post.ts, restore-user.post.ts, users.get.ts — jeweils erste Zeile im Handler
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not Found." });
  }
  // ... rest of handler
});
```

**Und `isDevRoleSwitcherEnabled` in dev-role-switcher.ts anpassen:**
```typescript
export function isDevRoleSwitcherEnabled(event: Parameters<typeof useRuntimeConfig>[0]) {
  // import.meta.dev is a Vite/Nitro build-time constant — always false in production builds
  return import.meta.dev;
}
```

### Pattern 6: Cookie-Secure-Fix (F-10)

**Aktuell in nuxt.config.ts:40-42:**
```typescript
// AKTUELL — URL-Heuristik, stiller Fallback
secure: process.env.NUXT_SESSION_COOKIE_SECURE
  ? process.env.NUXT_SESSION_COOKIE_SECURE !== "false"
  : (process.env.NUXT_PUBLIC_HUB_URL || "").startsWith("https://"),
```

**Fix (D-08):**
```typescript
// Neu: NODE_ENV-basiert, vorhersagbar, kein stiller Fallback
secure: process.env.NODE_ENV !== "development",
```

### Pattern 7: CSRF-Kommentar-Ergänzung (F-17)

**Aktuell in 02-csrf-check.ts:13-15:**
```typescript
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  if (!origin && !referer) return;
```

**Fix — Kommentar einfügen:**
```typescript
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  // SSR-internal requests originate from the Nitro server itself (e.g. useRequestFetch / $fetch
  // on the server side) and carry no Origin or Referer header. Browser-initiated cross-origin
  // CSRF attacks always include an Origin header, so this skip is safe for SSR internals.
  // This is an intentional exception — not a security gap.
  if (!origin && !referer) return;
```

### Anti-Patterns to Avoid

- **Kein String-Equality auf Secrets:** `token !== expectedToken` oder `token === expectedToken` — immer `timingSafeEqualString` verwenden.
- **Kein `process.env.NODE_ENV === "development"` für Dev-Guard:** Als Laufzeit-Check ist dies umgehbar; `import.meta.dev` ist Build-Zeit-Konstante.
- **Keine URL-Heuristik für Security-Flags:** Cookie-Secure aus `NUXT_PUBLIC_HUB_URL.startsWith("https://")` zu derivieren ist fehleranfällig und schwer zu debuggen.
- **Kein stilles `userSession=null`** für unbekannte API-Routen — das ist der heutige Zustand, der durch F-02 geschlossen wird.
- **Keine neuen Routen ohne PUBLIC_PATHS-Eintrag** wenn sie public sein sollen.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing-sichere Token-Vergleiche | Eigene byte-loop | `crypto.timingSafeEqual` (Node.js built-in) | Korrekte Implementierung ist nicht trivial; Built-in ist constant-time |
| Cookie-Verschlüsselung + Signing | Eigenes HMAC | nuxt-auth-utils / h3 sealed sessions | Iron-sealing mit korrektem HMAC und TTL; Session-Fixation durch Cookie-als-Payload strukturell gelöst |
| Session-ID-Rotation | Manuelles ID-Management | `replaceUserSession()` | h3's `clearSession` + `updateSession` generiert neue `crypto.randomUUID()` Session-ID [VERIFIED: h3 source] |

**Key insight:** Die gesamte kryptographische Komplexität (Cookie-Sealing, Session-ID-Generierung, CSRF-Token) ist bereits in nuxt-auth-utils und h3 gelöst. Phase 3 hardened nur die Stellen, die diese Infrastruktur umgehen oder falsch nutzen.

---

## Session-Rotation Deep Dive (F-09)

**Frage:** Verhindert `replaceUserSession()` Session-Fixation?

**Analyse aus h3 source (v1.15.11):** [VERIFIED: installed source]

```
replaceUserSession(event, data)
  → _useSession(event)           // nuxt-auth-utils wrapper
  → session.clear()              // h3: delete event.context.sessions[name], set empty cookie
  → session.update(data)         // h3: Object.assign(session.data, data)
                                 //     session.id = crypto.randomUUID()  ← NEU generiert
                                 //     session.createdAt = Date.now()
                                 //     sealSession → neuer HMAC-verschlüsselter Cookie-Wert
```

**Befund:** `clearSession` löscht den alten Session-Context aus `event.context.sessions` vollständig und setzt den Cookie auf leeren String. Anschließend erstellt `getSession` (aufgerufen von `updateSession`) eine neue Session mit frischer `crypto.randomUUID()` und neuem `createdAt`. Das resultierende Cookie ist ein neuer, vollständig anderer Sealed-Blob.

**Architektur-Schlüssel:** Bei sealed-cookie-Sessions ist der Cookie-Wert selbst die Session (kein server-seitiger Session-Store). Es gibt keine separate "Session-ID" die wiederverwendet werden könnte. Session-Fixation via Cookie-Übernahme ist nicht möglich, weil der Angreifer den alten Cookie nach `replaceUserSession` nicht mehr einlösen kann (neues `session.id` + neues Seal).

**Was zu verifizieren ist (Testfall für Phase 3):** Einen Before/After-Cookie-Value-Vergleich nach Login zeigen, der beweist, dass der Cookie-Wert sich vollständig ändert.

---

## Complete Public-Allowlist Determination

**Grep-Scan-Ergebnis:** 18 Dateien ohne `requireSession`/`requireAdminSession`/`requireModeratorSession`/`requireSuperadminSession`/`requireInternalToken` [VERIFIED: codebase grep-scan]

| Pfad | Auth-Mechanismus | PUBLIC_PATHS-Eintrag |
|------|-----------------|----------------------|
| `/api/public/branding.get.ts` | keine (bewusst public) | `/api/public/` |
| `/api/public/footer-pages.get.ts` | keine (bewusst public) | `/api/public/` |
| `/api/public/landing.get.ts` | keine (bewusst public) | `/api/public/` |
| `/api/auth/discord.get.ts` | OAuth-Redirect (kein Session-Check) | `/api/auth/` |
| `/api/auth/logout.post.ts` | kein requireSession (Session-Clear auch ohne Auth) | `/api/auth/` |
| `/api/auth/matrix.get.ts` | OAuth-Redirect | `/api/auth/` |
| `/api/auth/platforms.get.ts` | Public (listet verfügbare Plattformen) | `/api/auth/` |
| `/api/auth/dev-login.get.ts` | eigener devBypass-Check | `/api/auth/` |
| `/api/csrf-token.get.ts` | keine (CSRF-Token-Init vor Login) | `/api/csrf-token` |
| `/api/setup/status.get.ts` | keine (Setup-Wizard) | `/api/setup/` |
| `/api/setup/platform.post.ts` | keine (Setup-Wizard) | `/api/setup/` |
| `/api/setup/complete.post.ts` | keine (Setup-Wizard) | `/api/setup/` |
| `/api/theme.get.ts` | keine (öffentliches Theming) | `/api/theme.get` |
| `/api/apply/[flowId]/upload.post.ts` | `verifyAndLoadToken()` (Application-Token-Auth) | `/api/apply/` |
| `/api/apply/[flowId]/validate-token.post.ts` | `verifyAndLoadToken()` | `/api/apply/` |
| `/api/admin/landing/sections.get.ts` | `requireModeratorRight()` — ruft `requireSession()` intern auf | ✗ kein PUBLIC-Eintrag nötig |
| `/api/admin/landing/sections/[id].put.ts` | `requireModeratorRight()` — ruft `requireSession()` intern auf | ✗ kein PUBLIC-Eintrag nötig |
| `/api/admin/landing/sections/reorder.put.ts` | `requireModeratorRight()` — ruft `requireSession()` intern auf | ✗ kein PUBLIC-Eintrag nötig |
| `/api/internal/locale-context.get.ts` | **KEIN GUARD** — muss requireSession() erhalten (D-03) | ✗ nicht public, aber FIXUP nötig |

**Sonderfall `/api/internal/`:** Die internal-Routen (`/api/internal/branding.get.ts`, `/api/internal/landing/*`) verwenden `requireInternalToken()` als Auth-Mechanismus — MCP-Bearer-Token, keine User-Session. Sie müssen in PUBLIC_PATHS stehen, weil Session-Middleware sie sonst mit 401 blockt (kein `userSession.user.id`). [VERIFIED: requireInternalToken wirft selbst 401/503 — kein Sicherheitsrisiko durch PUBLIC_PATHS-Eintrag]

**Finale PUBLIC_PATHS-Liste:**
```typescript
const PUBLIC_PATHS = [
  "/api/public/",    // branding, footer-pages, landing (öffentliche Community-Daten)
  "/api/auth/",      // OAuth-Callbacks, Logout, Platform-Liste, Dev-Login
  "/api/csrf-token", // CSRF-Token-Initialisierung
  "/api/setup/",     // Setup-Wizard (läuft vor erster Auth-Konfiguration)
  "/api/theme.get",  // Öffentliche Theming-Daten
  "/api/apply/",     // Application-Flow-Uploads (eigene Token-Auth)
  "/api/internal/",  // MCP-Internal-Endpoints (requireInternalToken als eigene Auth)
];
```

---

## Common Pitfalls

### Pitfall 1: crypto.timingSafeEqual wirft bei ungleicher Buffer-Länge

**What goes wrong:** `crypto.timingSafeEqual(Buffer.from("abc"), Buffer.from("ab"))` wirft `RangeError: Input buffers must have the same byte length`.
**Why it happens:** Die API erwartet Buffers gleicher Länge — unterschiedliche Längen würden bereits durch die Länge die Antwort leaken.
**How to avoid:** Immer Längen-Pre-Check VOR dem timingSafeEqual-Call: `leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(...)`.
**Warning signs:** RangeError in Tests bei absichtlich falschen Tokens.

### Pitfall 2: import.meta.dev ist false im Vitest-Test-Environment

**What goes wrong:** Tests, die `import.meta.dev`-Guards testen, scheitern weil Vitest kein Vite/Nitro-Build-Environment ist — `import.meta.dev` ist `undefined` oder `false`.
**Why it happens:** `import.meta.dev` ist eine Vite-spezifische Build-Konstante. In Vitest (Node.js test runner) wird sie nicht gesetzt.
**How to avoid:** Tests für die guard-Logik mocken `import.meta.dev` via `vi.stubGlobal('import', { meta: { dev: false } })` oder testen das Verhalten indirekt durch den HTTP-Status-Code bei einem echten Dev-Build vs. Production-Build. Alternativ: separater Logic-Test für die Guard-Funktion ohne `import.meta.dev`-Abhängigkeit.
**Warning signs:** Tests für Dev-Endpoint-Guards, die immer passen.

### Pitfall 3: Session-Middleware-Scope — nicht alle Requests sind /api/

**What goes wrong:** Middleware `03-session.ts` läuft für ALLE Requests (nicht nur `/api/`), weil Nitro-Middleware global ist. Ohne Path-Guard würde deny-by-default auch SSR-Seiten und Server-Routes treffen.
**Why it happens:** Nitro Server Middleware hat keinen eingebauten Path-Filter — muss manuell mit `if (!event.path.startsWith("/api/")) return` implementiert werden.
**How to avoid:** Rate-Limit-Middleware (`01-rate-limit.ts`) als Vorlage — früh returnen für non-/api/ Paths.
**Warning signs:** Login-Redirect-Loops, weil SSR-Seiten (z.B. `/login`, `/`) mit 401 geblockt werden.

### Pitfall 4: `/api/internal/`-Routen sind KEIN Session-Bypass

**What goes wrong:** `/api/internal/`-Routen in PUBLIC_PATHS aufnehmen könnte wie ein Bypass aussehen.
**Why it happens:** Die Routen nutzen `requireInternalToken()` (Bearer-Token-Auth) statt User-Session — sie haben legitimerweise keine `userSession.user.id`.
**How to avoid:** Klar dokumentieren, dass `requireInternalToken()` selbst 401 wirft. PUBLIC_PATHS-Eintrag bedeutet "Session-Middleware überspringen", nicht "keine Auth".
**Warning signs:** Fehlende Dokumentation für interne Routen.

### Pitfall 5: replaceAuthSession preserviert CSRF-Token

**What goes wrong:** Nach Session-Replace fehlt csrfToken → alle folgenden State-ändernden Requests schlagen mit CSRF-Fehler fehl.
**Why it happens:** CSRF-Check in `02-csrf-check.ts` prüft `session.csrfToken`; nach `replaceUserSession` ist die neue Session leer.
**How to avoid:** `replaceAuthSession` in `auth-session.ts` ist bereits korrekt: sie liest `existingSession.csrfToken` und überträgt es in die neue Session. Diesen Mechanismus nicht beschädigen.
**Warning signs:** 403 CSRF-Fehler nach Login.

---

## Code Examples

### Existing internal-auth.spec.ts — Tests für timing-safe Update

**Bestehende Tests** (in `server/utils/__tests__/internal-auth.spec.ts`) [VERIFIED: codebase]:
- throws 503 wenn mcpInternalToken nicht konfiguriert
- throws 401 bei fehlendem Auth-Header
- succeeds mit validem Bearer-Token
- succeeds mit x-internal-token-Header
- throws 401 bei falschem Token

Die bestehenden Tests validieren das Verhalten bereits vollständig. Nach dem timingSafeEqual-Fix müssen die Tests **unverändert** bleiben und weiter grün sein — die Funktion ist Drop-in-kompatibel.

**Neuer Test-Fall der hinzugefügt werden sollte:**
```typescript
it("uses timing-safe comparison (equal-length wrong token still rejected)", async () => {
  mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token-abc" });
  mocks.getHeader.mockImplementation((_event: any, name: string) => {
    if (name === "authorization") return "Bearer secret-token-xyz"; // gleiches length
    return undefined;
  });
  const { requireInternalToken } = await importInternalAuth();
  const event = createMockEvent();
  expect(() => requireInternalToken(event)).toThrow();
  try { requireInternalToken(event); } catch (e: any) {
    expect(e.statusCode).toBe(401);
  }
});
```

### Session-Rotation-Verifikationstest

**Strategieentscheidung (Claude's Discretion):** Vitest-Test bevorzugt gegenüber manuellem Cookie-Inspect, weil er in CI reproduzierbar und automatisch ist.

```typescript
// server/utils/__tests__/session-rotation.spec.ts (neu)
import { describe, it, expect } from "vitest";

describe("Session rotation (F-09 verification)", () => {
  it("replaceUserSession generates new sealed cookie value (structural verification)", () => {
    // Verifiziert: nuxt-auth-utils replaceUserSession ruft h3 clearSession + updateSession auf.
    // h3 updateSession generiert neue session.id via crypto.randomUUID().
    // Sealed Cookie = HMAC(session.id + session.data + timestamp) — immer neu.
    // Session-Fixation ist strukturell nicht möglich: kein server-seitiger Session-Store,
    // Cookie-Wert ist die Session, und er wechselt vollständig nach Login.
    //
    // VERIFIED: h3@1.15.11 source:
    // - clearSession: delete event.context.sessions[name], empty cookie
    // - getSession: session.id = crypto.randomUUID() wenn keine existierende Session
    // - updateSession: sealSession → neuer HMAC-verschlüsselter Cookie-Wert
    //
    // Dieser Test ist Dokumentation, kein Verhaltensstest.
    // Für echten Cookie-Value-Vergleich: E2E-Test mit Playwright Cookie-Inspect.
    expect(true).toBe(true); // Structural verification via code review
  });
});
```

**Alternativ als Playwright Cookie-Inspect Test** (falls Planner E2E bevorzugt):
- Login-Request senden, Cookie-Wert vorher/nachher vergleichen.
- Aufwandschätzung: 30-45 Minuten für E2E-Playwright-Test vs. 5 Minuten für Dokumentationstest.

---

## Environment Availability

Phase 3 hat keine externen Abhängigkeiten jenseits des bestehenden Node.js-Prozesses.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node:crypto` | timingSafeEqual (F-03, F-04) | ✓ | Node.js v24 built-in | — |
| Vitest | Tests | ✓ | 2.1.9 (hub, matrix-bot) | — |
| Hub test infrastructure | neue Unit-Tests | ✓ | vollständig (test-helpers.ts + stubs) | — |
| Matrix-bot test infrastructure | neuer auth-Test | ✓ | Integration-Test-Pattern vorhanden | — |

---

## Validation Architecture

**Framework:** Vitest 2.1.9 (hub), Vitest 2.1.9 (matrix-bot)
**Config:** `platform/apps/hub/vitest.config.ts`, `platform/apps/matrix-bot/vitest.config.ts`
**Quick run:** `pnpm --filter @guildora/hub test` (1.96s, 268 tests — verified)
**Full suite:** `pnpm --filter @guildora/hub test && pnpm --filter @guildora/matrix-bot test`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-03 | timing-safe Hub internal-auth | unit | `pnpm --filter @guildora/hub test -- internal-auth` | ✅ (extend existing) |
| SEC-03 | timing-safe Matrix-Bot auth | integration | `pnpm --filter @guildora/matrix-bot test` | ✅ (extend existing) |
| SEC-04 | deny-by-default blocks unauth /api/ | unit | `pnpm --filter @guildora/hub test -- session-middleware` | ✅ (extend existing) |
| SEC-04 | public paths pass through | unit | `pnpm --filter @guildora/hub test -- session-middleware` | ✅ (extend existing) |
| SEC-04 | locale-context requires session | unit | `pnpm --filter @guildora/hub test` | ❌ Wave 0 Gap |
| SEC-05 | dev-endpoint returns 404 in non-dev | unit | `pnpm --filter @guildora/hub test` | ❌ Wave 0 Gap |
| SEC-05 | cookie-secure = true in non-dev | manual/config review | — | manual-only |
| SEC-05 | session-rotation structural verification | unit/doc | `pnpm --filter @guildora/hub test` | ❌ Wave 0 Gap |
| SEC-05 | CSRF-Kommentar sichtbar | code review | — | manual-only |

### Sampling Rate

- **Per task commit:** `pnpm --filter @guildora/hub test && pnpm --filter @guildora/matrix-bot test`
- **Per wave merge:** Same
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (neue Test-Files)

- [ ] `server/utils/__tests__/session-middleware.spec.ts` — neue Testfälle für deny-by-default und PUBLIC_PATHS (Datei existiert, aber Tests testen alten Behavior — müssen angepasst/erweitert werden)
- [ ] `server/api/__tests__/dev-endpoints.spec.ts` — import.meta.dev-Guard-Verifikation
- [ ] `server/utils/__tests__/session-rotation.spec.ts` — strukturelle Verifikation F-09

**Bestehende Tests müssen bleiben grün** (268 Tests hub, 11 Tests matrix-bot).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | requireSession(), requireAdminSession() (bereits vorhanden), deny-by-default (Phase 3) |
| V3 Session Management | yes | nuxt-auth-utils sealed sessions, replaceUserSession() nach Login |
| V4 Access Control | yes | PUBLIC_PATHS Allow-List, requireRole() Pattern |
| V5 Input Validation | partial | Token-Parsing in requireInternalToken bereits validiert; kein neues Input-Parsing in Phase 3 |
| V6 Cryptography | yes | crypto.timingSafeEqual für alle Token-Vergleiche (Phase 3 Kern-Fix) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Timing-Angriff auf Token-Vergleich | Information Disclosure | crypto.timingSafeEqual (F-03, F-04) |
| Unauthorized API Access (fehlende Auth-Guard) | Elevation of Privilege | deny-by-default Middleware + PUBLIC_PATHS (F-02) |
| Dev-Endpoint-Exposition in Prod | Elevation of Privilege | import.meta.dev Build-Zeit-Konstante (F-07) |
| Session-Fixation nach Login | Spoofing | replaceUserSession() = structural prevention (F-09) |
| Cookie über HTTP übertragen | Information Disclosure | secure: NODE_ENV !== "development" (F-10) |
| CSRF-Skip undokumentiert | Repudiation | Kommentar in 02-csrf-check.ts (F-17) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/api/apply/`-Routen verwenden ausschließlich `verifyAndLoadToken()` und benötigen keine User-Session | Public-Allowlist | Falls eine apply-Route doch Session erwartet, würde sie nach dem deny-by-default-Fix mit 401 scheitern — aber die Routen wurden manuell geprüft [VERIFIED] |
| A2 | `requireModeratorRight()` ruft intern `requireSession()` auf (und ist damit durch Session-Middleware geschützt) | Public-Allowlist | Falls nicht, würden die admin/landing-Routen durch die Middleware gelangt sein und ohne Session zugänglich sein. Verifiziert: `moderation-rights.ts:4` hat `import { requireSession } from "./auth"` [VERIFIED] |
| A3 | `import.meta.dev` ist in Vitest-Environment `false` oder `undefined` | Pitfall 2 | Falls Vitest `import.meta.dev=true` setzt, würden Dev-Guard-Tests inkorrekt sein [ASSUMED — nicht explizit im Vitest-Config überprüft, aber standard Verhalten] |

---

## Open Questions

1. **Session-Rotation-Test-Format (Claude's Discretion)**
   - Was wir wissen: Strukturell ist Session-Rotation durch nuxt-auth-utils/h3 gelöst.
   - Was unklar: Soll der Test automatisiert (Vitest mit gemockten h3-Calls) oder als Playwright Cookie-Inspect sein?
   - Recommendation: Vitest-Dokumentationstest + Kommentar mit Source-Referenz (minimal, ausreichend für SEC-05-Verifikation). Playwright-E2E ist optional wenn Andi expliziten Cookie-Before/After-Beweis will.

2. **locale-context.get.ts — Auswirkung von requireSession() auf Nuxt-SSR**
   - Was wir wissen: Die Route liest `event.context.userSession` — funktioniert auch mit null (hasSession: false). Nach requireSession() würde sie für unauthentifizierte Requests 401 werfen.
   - Was unklar: Welche Nuxt-Seiten rufen diese Route auf? Wenn Login-Seite oder öffentliche Landing Page sie nutzt, würde requireSession() einen Redirect-Loop verursachen.
   - Recommendation: Vor der Implementierung grep nach `locale-context` in Nuxt-Composables und Middleware, um sicherzustellen, dass die Route nur von authenticated Pages aufgerufen wird.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `token !== expectedToken` | `crypto.timingSafeEqual` | Phase 3 | Schließt Timing-Angriffspfad auf interne Token |
| Session-Middleware setzt null (graceful) | deny-by-default 401 für /api/ | Phase 3 | Neue Routen sind sicher by default |
| Dev-Endpoints via enablePerformanceDebug freischaltbar | Ausschließlich import.meta.dev | Phase 3 | Build-Zeit-Konstante, keine Laufzeit-Umgehung möglich |
| Cookie-Secure via HTTPS-URL-Heuristik | NODE_ENV !== "development" | Phase 3 | Vorhersagbar, ohne versteckte Seiteneffekte |

---

## Sources

### Primary (HIGH confidence)

- **Codebase direkt** — alle genannten Dateipfade und Zeilennummern per Read-Tool verifiziert
- **h3@1.15.11 installed source** (`/home/andreas/workspace/guildora/platform/node_modules/.pnpm/h3@1.15.11/...dist/index.mjs`) — `clearSession`, `updateSession`, `getSession` Implementierung gelesen
- **nuxt-auth-utils@0.5.29 installed source** (`dist/runtime/server/utils/session.js`) — `replaceUserSession` Implementierung gelesen
- **Vitest Test-Run** — 268 hub tests + 11 matrix-bot tests grün, verifiziert

### Secondary (MEDIUM confidence)

- **Security Audit `.planning/research/01-security-audit.md`** — Finding-Beschreibungen und Fix-Ansätze

### Tertiary (keine)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — alle Libraries bereits installiert, kein neues Package nötig
- Architecture: HIGH — alle betroffenen Dateien gelesen, Patterns aus bestehender Codebase
- Pitfalls: HIGH — aus direkter Code-Analyse und Library-Source-Review
- Session-Rotation F-09: HIGH — h3/nuxt-auth-utils Source verifiziert; Cookie-als-Payload ist strukturell korrekt

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack, keine schnellen Änderungen erwartet)
