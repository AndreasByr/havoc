# Kopf-Review Protokoll - Phase 1 Security Audit

**Session-Datum:** 2026-04-17
**Teilnehmende:** Andi + Claude (via Alice)
**Bezug:** .planning/phases/01-security-audit-priorisierung/01-RESEARCH.md §Kopf-Review Questionnaire (Zeilen 448-511)
**Schutzmechanismen:**
- Severity-Kriterien (D-05) wurden zu Session-Beginn wiederholt (Anti-Drift).
- Jede Antwort landet in einem von 3 Buckets: wird Finding / wird Deferred / wird gelöscht (Anti-Fatigue, Pitfall 1).
- Andis Antworten werden WÖRTLICH protokolliert (Blockquote) - keine Paraphrasierung (Fail-Loud).

---

## Bereich A - Apps-Plugin-System

### A.1 - Welche konkrete Sandbox-Mechanik schwebt dir vor (isolated-vm / Worker Threads / Docker-per-App)? Wo vermutest du den Haken?

> **Andis Antwort:**
>
> Für euer aktuelles Modell ist Docker-per-App nicht zwingend sofort nötig, wenn ihr diese Regeln hart durchzieht:
> Prod lädt nur source="marketplace" (Hub und Bot).
> sideloaded wird in Prod nicht nur versteckt, sondern technisch geblockt (inkl. update/auto-update).
> Startup-Check: Wenn enableSideloading=false und es existiert sideloaded in DB -> fail/disable.
> Marketplace-Apps werden als geprüfte, gepinnte Artefakte installiert (z. B. Commit-SHA), nicht „floating latest".
> Dann ist das Restrisiko bei euch eher Low/Medium, nicht High.
>
> Docker-per-App wird erst wichtig, wenn ihr wirklich untrusted third-party code in Prod dynamisch ausführen wollt (ohne harte Vorprüfung/Signierung). Dann braucht ihr die harte Isolation.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Konkrete Enforcement-Regeln (marketplace-only, sideloading-Block, Startup-Check, gepinnte Artefakte) sind Phase-2-Research-Input für Sandbox-Tech-Entscheidung. Kein Phase-1-Finding per Bereich-A-Note.
- [ ] Wird gelöscht mit Begründung: ...
- Notiz: A.1 ist Input für Phase-2-Research (Sandbox-Tech-Wahl), KEIN Phase-1-Finding - per 01-RESEARCH.md Bereich-A-Note.

---

### A.2 - Gibt es Apps-Code, der im Hub anders aufgerufen wird als im Bot — also abseits der beiden bekannten Execution-Sites (`apps/bot/src/utils/app-hooks.ts:128` und `apps/hub/server/api/apps/[...path].ts:86`)? Z.B. Page-Render-Server-Side via `vue3-sfc-loader`?

> **Andis Antwort:**
>
> Ja, es gibt noch eine dritte Execution-Site, aber nicht serverseitig:
> Bekannt 1: Hub-API-Handler via new Function in apps/hub/server/api/apps/[...path].ts.
> Bekannt 2: Bot-Hooks via new Function in apps/bot/src/utils/app-hooks.ts.
> Zusätzlich: App-Page-Code wird im Browser über vue3-sfc-loader geladen und ausgeführt (loadModule in app/pages/apps/[appId]/[...slug].vue, Plugin vue3-sfc-loader.client.ts).
> Wichtig:
> vue3-sfc-loader läuft bei euch client-only (.client.ts).
> /apps/** ist in nuxt.config.ts auf ssr: false.
> In der Page ist zusätzlich definePageMeta({ ssr: false }).
> Also: kein SSR-Page-Render von App-Code im Hub-Server.
> Die _page-source / _source Endpunkte liefern nur Quelltext aus codeBundle, sie führen ihn nicht aus.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-18) — Dritte Execution-Site (client-seitig via vue3-sfc-loader) war nicht im P-2-Grep-Output sichtbar (grep findet nur server-side `new Function()`). Client-side App-Code läuft unkontrolliert im Browser des Users ohne Browser-Sandbox-Isolation. Audit-Doc muss alle 3 Sites dokumentieren; Phase 2 muss Browser-Execution-Surface in Sandbox-Design einbeziehen.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### A.3 - Welche h3-Helpers sind heute exponiert und welchen davon würdest du im Nachhinein lieber nicht exponieren? (Whitelist-Review)

> **Andis Antwort:**
>
> Guter Punkt. Aktuell sind in apps/hub/server/api/apps/[...path].ts diese h3-Helpers exponiert:
> defineEventHandler, getQuery, readBody, createError, getRouterParams, setResponseHeader, sendNoContent, getHeader, setResponseHeader, setResponseStatus
>
> Was ich im Nachhinein eher nicht exponieren würde:
> defineEventHandler (für App-Handler unnötig, erhöht nur Surface)
> setResponseHeader (Cache/CORS/Content-Type-Manipulation)
> setResponseStatus (Response-Semantik frei manipulierbar)
> sendNoContent (kontrolliert frühen Response-Exit)
> getHeader (erleichtert Zugriff auf sensitive Request-Header)
>
> Pragmatische Minimal-Whitelist wäre eher: getQuery, readBody, createError, getRouterParams
>
> Wichtige Einschränkung: Solange App-Code den rohen event bekommt und im Host-Prozess läuft, ist die Helper-Whitelist nur begrenzt wirksam. Der echte Hebel ist Capability-Wrapper statt raw event.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-19) — h3-Helper-Surface zu groß: 5 der 9 exponierten Helpers (defineEventHandler, setResponseHeader, setResponseStatus, sendNoContent, getHeader) sollten aus der Whitelist entfernt werden. Kern-Insight: Solange raw event übergeben wird und App im Host-Prozess läuft, ist Whitelist nur Theater — echter Fix ist Capability-Wrapper. Phase 2 muss das adressieren.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### A.4 - Die `createAppDb`-KV-Abstraktion — hast du dort Bauchweh wegen Scope-Leakage zwischen Apps (ein App liest fremde App-Keys)?

> **Andis Antwort:**
>
> Kurz: begrenztes Bauchweh bei createAppDb selbst, mehr Bauchweh beim Runtime-Modell.
> createAppDb(appId) ist sauber scoped: get/set/delete/list filtern immer auf appKv.appId = appId.
> Kein API-Pfad in AppDb, um fremde appId direkt anzugeben.
> PRIMARY KEY (appId, key) verhindert Kollisionen zwischen Apps.
>
> Was trotzdem bleibt:
> Das ist App-Layer-Scoping, keine harte DB-Isolation (kein RLS, kein separater DB-User pro App).
> Wenn App-Code aus der Runtime ausbricht (unsandboxed Prozess), ist createAppDb egal und fremde Daten wären theoretisch erreichbar.
> list(prefix) mit %/_ kann höchstens innerhalb der eigenen App breiter matchen, nicht cross-app.
>
> Einstufung: KV-Abstraktion allein: Low. Gesamtrisiko mit aktuellem Execution-Modell: eher Medium (systemisch, nicht wegen createAppDb-Code selbst).

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: createAppDb-Code selbst ist korrekt scoped (Low). Das systemische Medium-Risiko ist Bestandteil von CF-01 (unsandboxed Execution) — kein eigenes Finding. Wave 4 soll CF-01 um die KV-Scope-Dimension ergänzen (App-Layer-Scoping ≠ harte DB-Isolation, kein RLS).
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich B - Internal-Auth (Hub <-> Bot, MCP, Application-Tokens)

### B.1 - Neben `internal-auth.ts:16` und `internal-sync-server.ts:86` — gibt es einen weiteren Pfad, an dem ein Token verglichen wird (z.B. `application-tokens.ts`, `platformBridge.ts`)? Welches Vergleichs-Schema dort?

> **Andis Antwort:**
>
> Ja, es gibt weitere Vergleichspfade.
>
> Ja: Application-Token-Signaturprüfung in application-tokens.ts (line 18).
> Schema: HMAC-SHA256(payloadB64, secret) und dann timingSafeEqual auf expected vs provided (mit vorherigem Längencheck). Danach Ablaufdatum + DB-Existenz/usedAt-Check in hub application-tokens.ts (line 22).
>
> Ja: Matrix Internal Sync in matrix internal-sync-server.ts (line 70).
> Schema: direkter Stringvergleich authHeader !== `Bearer ${token}` (nicht timing-safe).
>
> Nein: platformBridge vergleicht nichts in platformBridge.ts (line 31).
> Es setzt nur aus Config den Authorization: Bearer ... Header für Outbound-Requests.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-20) — Matrix Internal Sync Server (`matrix internal-sync-server.ts:70`) verwendet direkten `!==`-Stringvergleich statt `timingSafeEqual` — identisches Problem wie CF-02 (Hub `internal-auth.ts:16`). Beide müssen in Phase 2 auf `timingSafeEqual` gepatcht werden. application-tokens.ts ist korrekt (timingSafeEqual + Längencheck) → kein Finding dort.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### B.2 - `APPLICATION_TOKEN_SECRET` — wie wird der genutzt, wo wird er verifiziert, und gibt es dort eine Timing-Frage?

> **Andis Antwort:**
>
> Nutzung (Signing): Bot erzeugt Bewerbungs-Token mit signTokenId(tokenId, expiresAt, APPLICATION_TOKEN_SECRET).
> Pfade: application-button.ts (line 102) und interner Endpoint in internal-sync-server.ts (line 769).
> Format: base64url(tokenId:expiresAtISO).base64url(hmac) in shared application-tokens.ts (line 8).
>
> Verifikation: In Hub über verifyAndLoadToken() in hub application-tokens.ts (line 14).
> Erst Signaturprüfung via verifyTokenSignature(...), dann Expiry-Check und DB-Check (tokenId existiert, usedAt IS NULL) in derselben Datei.
> Verwendet in Apply-Flows (validate-token, submit, upload).
>
> Timing-Frage: Signaturvergleich selbst ist timing-safe: crypto.timingSafeEqual mit Längencheck in shared application-tokens.ts (line 30).
> Also: bei APPLICATION_TOKEN_SECRET-Verifikation sehe ich kein relevantes Timing-Leak.
> Restliche Unterschiede (expired vs not found) sind eher logische Antwortpfade, kein klassischer Secret-Vergleichs-Leak.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Implementierung korrekt — HMAC-SHA256 + timingSafeEqual + Längencheck. Kein Timing-Leak. Logische Unterscheidungen (expired/not found) sind kein Secret-Vergleichs-Problem.

---

### B.3 - Der MCP-Token-Pfad: hat die MCP-Komponente je in Produktion gelaufen, oder ist das aktuell "eingebaut, aber ungenutzt"? Relevant für Severity-Bewertung (ungenutzt ≠ unrisky, aber andere Restrisiko-Basis).

> **Andis Antwort:**
>
> Ja, du kannst ihn komplett entfernen, wenn ihr keine AI/MCP-Landing-Automation nutzt.
> Meine Einschätzung nach kurzem Check: packages/mcp-server ist ein separater, optionaler Integrationspfad.
> Hub-Frontend nutzt nicht /api/internal/landing/*, sondern /api/admin/landing/*.
> Damit bleibt der normale Landing-Editor auch ohne MCP funktionsfähig.
> Aktuell wirkt MCP bei euch wie "eingebaut, aber optional/kaum genutzt".
> Empfehlung: Wenn kein aktiver Use-Case: entfernen (weniger Komplexität, weniger Angriffsfläche).

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-21) — MCP-Server existiert als unbenutzter Angriffspfad auf `/api/internal/landing/*`. Solange vorhanden, ist der Token-Auth-Pfad (CF-07-verwandt) aktive Angriffsfläche trotz Nicht-Nutzung. Severity senkt sich durch "kaum genutzt", bleibt aber als Finding: entweder entfernen oder korrekt absichern. Entscheidung gehört in Phase 2.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### B.4 - Im `.env.example` steht `BOT_INTERNAL_TOKEN=replace_with_internal_sync_token` — gibt es in der Realität Deployments, wo dieser Placeholder NICHT ersetzt wurde, und das dadurch zum Live-Finding wird?

> **Andis Antwort:**
>
> Kurz: aus dem Repo kann ich keine realen Deployments mit dem Placeholder belegen.
> Der String replace_with_internal_sync_token taucht bei dir nur in guildora/.env.example auf.
> In der lokalen guildora/.env ist er ersetzt (BOT_INTERNAL_TOKEN=dev-internal-sync-token-lokal), also lokal kein Placeholder.
> Ob irgendwo "in echt" (Server/Hosting Secrets) noch der Placeholder läuft, kann ich ohne Zugriff auf diese Umgebungen nicht verifizieren.
>
> Severity-Einordnung: Nur dann Live-Finding, wenn in Prod wirklich der bekannte Placeholder genutzt wird. Mit eurem Standard-Compose (Bot-Port nicht öffentlich gemappt) eher begrenztes Risiko.
> Sicherste Härtung: beim Start hard-fail, wenn BOT_INTERNAL_TOKEN leer/zu kurz/replace_with_internal_sync_token ist.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-22) — Kein Startup-Check ob BOT_INTERNAL_TOKEN der bekannte Placeholder ist. Per "Fail Loud, Never Fake"-Prinzip: Bot muss beim Start hard-failen wenn Token = Placeholder/leer/zu kurz. Betrifft auch analoge Tokens (HUB_INTERNAL_TOKEN, MCP_TOKEN). Unabhängig davon ob Prod-Deployments betroffen sind — die Härtung fehlt.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich C - Session & CSRF

### C.1 - `03-session.ts` fängt `getUserSession`-Fehler und setzt `userSession = null`. Hast du konkrete Stellen im Kopf, wo dieser Silent-Fallback dich beißt, oder ist das "nur Bauchweh"?

> **Andis Antwort:**
>
> Eher "Bauchweh + 1-2 konkrete UX/Ops-Effekte", kein akuter Security-Bug.
>
> Konkrete Stellen, die ich sehe:
> /api/internal/locale-context nutzt event.context.userSession aus 03-session.ts. Wenn getUserSession dort fehlschlägt, wird hasSession=false zurückgegeben und die Locale-Logik fällt auf Cookie/Default zurück. Effekt: mögliche falsche Sprache/Flicker statt klarer Auth-Fehler.
> locale.global.ts hat eine Mismatch-Heuristik (loggedIn vs localeContext.hasSession). Bei dauerhaftem Session-Parse-Fehler kann das zu wiederholten Refreshes führen (unnötige Calls, Debugging-Lärm).
>
> Was ich nicht sehe: Kein Endpoint mit kritischer AuthZ, der auf event.context.userSession vertraut. Die sensiblen Routen gehen über requireSession/requireAdminSession und failen korrekt mit 401/403.
> Fazit: nicht exploitable, aber ein echtes Operational/Observability-Problem (Fehler werden in "anonym" umgebogen).

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Kein Security-Exploit-Pfad — requireSession/requireAdminSession werfen korrekt 401/403. Operationales Problem (Silent-Fallback verschleiert echte Fehler, Locale-Flicker, Refresh-Loops) — Wave 4 klassifiziert als Operational/Observability, nicht als Security-Finding.

---

### C.2 - `02-csrf-check.ts` skippt CSRF, wenn weder `Origin` noch `Referer` gesetzt sind (SSR-Internal-Request-Exception). Siehst du einen Angriffspfad, wie das von aussen ausgenutzt werden kann (z.B. via Tool, das Header bewusst weglässt)?

> **Andis Antwort:**
>
> Keinen klaren externen Angriffspfad mit heutigem Setup.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi sieht keinen klaren externen Angriffspfad. Bestehende CF-06 (CSRF-Skip-Exception) deckt diesen Punkt bereits ab — kein additives Finding.

---

### C.3 - Session-Rotation nach Login (SEC-05): funktioniert das heute schon durch `nuxt-auth-utils` automatisch, oder ist das offen? Falls offen — weißt du warum?

> **Andis Antwort:**
>
> Kurz: strikte Session-Rotation nach Login ist aktuell eher offen.
> Warum: Eure Login-Flows rufen replaceAuthSessionForUserId(...) auf, das intern replaceUserSession(...) nutzt.
> In nuxt-auth-utils (dist/runtime/server/utils/session.js) macht replaceUserSession nur: session.clear() + session.update(data).
> Das ist kein explizites "regenerate session id" API.
> In h3 gibt es bei Sessions auch kein separates regenerate(); clear/update ist vorhanden, aber keine garantierte Rotation-Primitive.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-23) — SEC-05 verlangt Session-Rotation nach Login; nuxt-auth-utils replaceUserSession implementiert nur clear()+update(), kein echtes Session-ID-Regeneration. h3 bietet kein regenerate()-Primitive. Bestätigt: SEC-05 ist aktuell offen. Phase 2 muss prüfen ob clear()+update() auf h3-Cookie-Sessions praktisch Session-Fixation verhindert oder ob eine echte Mitigation nötig ist.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### C.4 - Cookie-Flags (`HttpOnly`, `Secure`, `SameSite`): kennst du Umgebungen, in denen `Secure` nicht greift (lokale Preview-URL ohne TLS, o.ä.)?

> **Andis Antwort:**
>
> Ja. Secure greift bei euch nicht in Umgebungen mit HTTP oder falscher Konfiguration, z. B.:
> Lokales Dev: http://localhost:3003
> Preview/Staging ohne TLS
> Proxy-Setup, bei dem NUXT_PUBLIC_HUB_URL auf http://... steht
> Explizites Override: NUXT_SESSION_COOKIE_SECURE=false
> HttpOnly und SameSite=lax bleiben davon unberührt, aber Secure hängt genau an diesen Bedingungen.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Dev-HTTP ist erwartet und akzeptiert. Die echte Gefahr ist Preview/Staging ohne TLS oder falsche NUXT_PUBLIC_HUB_URL — das ist ein Deployment/Config-Risiko, kein Code-Bug. Wave 4 prüft ob CF-05 (Cookie-Flags) diese Dimension bereits abdeckt; falls nicht, ergänzen.

---

### C.5 - Dev-Login-Bypass (`NUXT_AUTH_DEV_BYPASS=true`, `apps/hub/server/api/auth/dev-login.get.ts`, `apps/hub/server/api/dev/*`): wie sicher bist du, dass dieser Pfad in Prod wirklich aus ist?

> **Andis Antwort:**
>
> Für /api/auth/dev-login bin ich relativ sicher, dass es in Prod aus ist. Für die gesamte Dev-Surface bin ich es nicht.
>
> /api/auth/dev-login + Discord-Bypass in auth/discord.get.ts: Gate ist isDev && config.authDevBypass === true. authDevBypass kommt aus NUXT_AUTH_DEV_BYPASS (default false). Bei eurem Docker-Setup ist NODE_ENV=production. Einschätzung: hoch sicher, solange niemand NODE_ENV=development in Prod fährt.
>
> /api/dev/* (switch-user, restore-user, users): Gate ist nicht nur Dev, sondern: import.meta.dev || NODE_ENV===development || config.public.enablePerformanceDebug. enablePerformanceDebug hängt an NUXT_PUBLIC_ENABLE_PERFORMANCE_DEBUG. Wenn das in Prod versehentlich true ist, sind die Endpoints aktiv (zusätzlich mit Session+Rollencheck).
> Einschätzung: nicht 100% sicher "aus in Prod".
>
> Kurz: Dev-Login-Bypass: eher sauber abgesichert. /api/dev/*: potenzieller Prod-Leak bei falscher Flag-Konfiguration.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-24) — `/api/dev/*` Endpoints (switch-user, restore-user, users) sind aktiv wenn `NUXT_PUBLIC_ENABLE_PERFORMANCE_DEBUG=true` — unabhängig von NODE_ENV. Privilegierte User-Impersonation-Endpoints in Prod durch Debug-Flag aktivierbar. Auch mit Session+Rollencheck bleibt das ein klares Finding: Dev-Endpoints dürfen nicht via Performance-Flag freischaltbar sein.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich D - Supply-Chain & Secrets

### D.1 - 12 `pnpm.overrides` — weißt du bei allen, welchen CVE oder welches Upstream-Problem sie patchen? Fällt dir einer ein, wo du dir NICHT mehr sicher bist, ob er noch nötig ist?

> **Andis Antwort:**
>
> Nein, bei allen kann ich die CVE-Zuordnung nicht sicher aus dem Kopf nennen.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-25) — 12 pnpm.overrides ohne dokumentierte CVE-Zuordnung. Undokumentierte Overrides sind Supply-Chain-Risiko: kann nicht festgestellt werden welche noch nötig sind, welche veraltet sind oder ob neue CVEs entstanden. Mitigation: jeden Override mit CVE-Nummer/Begründung kommentieren + prüfen ob upstream inzwischen gepatcht hat.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### D.2 - `.env`-Handling — gibt es irgendwo im Code eine Stelle, an der ein Fallback-Default "auslöst, wenn ENV fehlt" und damit schweigend weiterläuft mit einer unsicheren Default-Konfiguration? (Fail-Loud-Test)

> **Andis Antwort:**
>
> Ja, ein paar Stellen gibt es. Kurz und kritisch:
>
> Medium: session.cookie.secure fällt still auf false, wenn NUXT_SESSION_COOKIE_SECURE nicht gesetzt ist und NUXT_PUBLIC_HUB_URL nicht mit https:// beginnt (apps/hub/nuxt.config.ts:40-42). Risiko: Session-Cookie kann in falsch konfigurierten Deployments ohne Secure laufen (Hardening-Lücke).
>
> Low/Operational: Discord-Platform hat ENV-Fallback und wird teils als "aktiv" behandelt, auch bei unvollständiger ENV-Konfiguration (server/utils/platformConfig.ts:102-132, server/api/auth/platforms.get.ts:12-19). Ergebnis meist 503/Fehlfunktion später, eher kein direkter Exploit.
>
> Operational: DB-Migrations-Plugin läuft bei Fehlern weiter (server/plugins/00-db-migrate.ts:82-86) und bei fehlender DATABASE_URL wird nur geloggt (:58-62). Das ist Stabilitäts-/Betriebsrisiko, kein direkter Security-Fail-Open.
>
> Was positiv fail-loud/fail-closed ist: MCP-Internal-Token fehlt => 503. Bot-Internal-Token fehlt => interner Sync-Server startet nicht. APPLICATION_TOKEN_SECRET fehlt => Token-Flow bricht ab.
>
> Fazit D.2: Kein klarer Critical/High-Fail-Open durch fehlende ENV, aber ein echter Medium-Härtungspunkt bei Cookie-Secure-Fallback plus mehrere Low/Operational Silent-Fallbacks.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-26) — `session.cookie.secure` fällt still auf `false` wenn NUXT_SESSION_COOKIE_SECURE fehlt und URL kein https:// (apps/hub/nuxt.config.ts:40-42). Verletzt "Fail Loud, Never Fake" — Security-relevantes Flag (Cookie-Secure) hat Silent-Insecure-Fallback. Mitigation: wenn NUXT_SESSION_COOKIE_SECURE nicht explizit gesetzt, auf `true` defaulten oder beim Start warnen/failen.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### D.3 - `docker-compose.yml` — neben dem bekannten `POSTGRES_PASSWORD: postgres`: kennst du weitere Stellen, wo ein Wert hartcoded ist, der eigentlich aus `.env` kommen sollte?

> **Andis Antwort:**
>
> Ja, neben POSTGRES_PASSWORD: postgres sehe ich weitere hardcodete Werte in guildora/docker-compose.yml:
> POSTGRES_USER: postgres (:7), POSTGRES_DB: guildora (:9)
> DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora in hub (:60) und bot (:114)
> NUXT_DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora (:69)
> DATABASE_SSL: "false" in hub (:61) und bot (:115)
> NUXT_BOT_INTERNAL_URL: http://bot:3050 (:71)
>
> Kurz-Einschätzung: Low (Hardening), solange alles nur im internen Docker-Netz hängt. Medium, falls DB/Service-Ports falsch exponiert oder wiederverwendet werden (gleiche Credentials in echten Umgebungen). docker-compose.override.yml hat dazu keine weiteren Secret-Hardcodings (nur Ports/Labels).

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Erweitert CF-03/CF-08 (bekannte docker-compose-Hardcodings) um vollständige Liste. Kein neues eigenständiges Finding — Wave 4 soll CF-03 mit dieser Vollständigkeitsliste anreichern. DATABASE_SSL: "false" ist separates Low-Härtungs-Item (TLS zur DB deaktiviert).

---

## Bereich E - Upload / Media / File-Serving

### E.1 - Avatar-Upload (`apps/hub/server/api/profile/avatar.put.ts`) und Application-Upload (`apps/hub/server/api/apply/[flowId]/upload.post.ts`) prüfen MIME-Allowlist + 5MB-Limit. Hast du ein Finding dazu im Kopf, das über MIME-Sniffing-Risiken, Path-Traversal (`../`) oder Race-Conditions hinausgeht, was der Code heute prüft?

> **Andis Antwort:**
>
> Nein.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi hat kein Finding dazu im Kopf. MIME-Allowlist + 5MB-Limit als ausreichend bestätigt.

---

### E.2 - `media.ts` / S3-Config: fällt dir eine Stelle ein, an der ein User-eingeschleuster Pfad direkt an `PutObjectCommand` gelangen könnte?

> **Andis Antwort:**
>
> Nein, kein Produktionsprojekt noch in der Entwicklung, es wurden keine realen Tests gemacht.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Kein konkreter Pfad im Kopf. S3/Media-Pfad ist noch nicht produktiv getestet — Wave 4 prüft Code statisch auf User-Pfad-Injection via Read-Tool, da Andi keine Laufzeit-Erfahrung hat.
- [ ] Wird gelöscht mit Begründung: ...

---

### E.3 - `apps/hub/media/uploads/` liegt untracked auf dem Host-Filesystem — ist das nach aussen servbar (z.B. durch ein `/uploads/*`-Serve), und wenn ja: ist das auth-protected?

> **Andis Antwort:**
>
> Ja, differenziert:
> apps/hub/media/uploads/ ist im aktuellen Code kein Standard-Serve-Pfad. In deinem Checkout existiert der Pfad auch nicht.
> Öffentlich servt wird standardmäßig apps/hub/public/uploads/* (bzw. in Prod .output/public/uploads/*) und das ist nicht auth-protected.
> Avatare landen unter /uploads/avatars/* — Media-Fallback unter /uploads/media/*
> Die wirklich sensiblen Bewerbungs-Dateien liegen unter apps/hub/data/application-uploads/* und sind nicht statisch öffentlich; Zugriff läuft über API mit requireModeratorSession.
>
> Wenn R2 korrekt konfiguriert ist, nutzt Hub den Bucket — dann sind Uploads nicht im lokalen public/uploads/media/*, sondern im Bucket. Auth hängt dann an der Bucket-Auslieferung (mit BUCKET_PUBLIC_URL typischerweise öffentlich, ohne Public-URL über signierte Zugriffe).
>
> Wichtig — das ist ein Fehler und sollte gefixt werden: Avatar-Flow nutzt lokal weiterhin /uploads/avatars/* unabhängig vom Media-Bucket. Erwartet: Wenn R2 konfiguriert ist, sollen Uploads konsistent im Bucket liegen. Ist aktuell: Avatar-Flow schreibt weiter lokal nach /uploads/avatars/* und ist damit vom Media-Bucket entkoppelt. Risiko: Inkonsistente Storage-Policy + potenziell öffentlich servbare Avatare außerhalb der Bucket-Controls.
>
> Finding: "Avatar-Flow bypassed Bucket storage". Severity: Medium (Härtung/Policy-Bypass, kein direkter Critical-Exploit). Fix-Richtung: Avatar-Storage auf denselben Media/Bucket-Service umstellen, bestehende lokale Avatare migrieren, optional lokale /uploads/avatars/* Auslieferung deaktivieren.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-27) — Avatar-Upload-Flow schreibt lokal nach `/uploads/avatars/*` auch wenn R2/Bucket konfiguriert ist — Bucket-Storage wird bypassed. Avatare landen in öffentlich servierbarem `public/uploads/avatars/*` außerhalb der Bucket-Access-Controls. Medium: Inkonsistente Storage-Policy, potenziell öffentliche Avatare ohne Bucket-Auth.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich F - Apps-Pipeline & Sideload

### F.1 - `app-sideload.ts` holt Code von `raw.githubusercontent.com`. Gibt es ein TOCTOU-Risiko (Manifest-Fetch zeigt X, aber der Code-Fetch Sekunden später zeigt Y)? Schon mal gesehen?

> **Andis Antwort:**
>
> Ja, TOCTOU ist hier real.

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-28) — TOCTOU bestätigt: Manifest-Fetch und Code-Fetch sind separate HTTP-Requests zu GitHub. Zwischen beiden kann ein Angreifer (mit Push-Zugriff auf das App-Repo) den Code wechseln. Mitigation: Code-Fetch muss denselben Commit-SHA wie Manifest-Fetch pinnen, nicht floating latest.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### F.2 - esbuild-Transpilation in `app-sideload.ts`: hat esbuild jemals verschachtelten Code ausgegeben, der sich im Runtime anders verhält als im Manifest signalisiert? (Compile-Time Obfuscation durch Angreifer)

> **Andis Antwort:**
>
> Keine Ahnung.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi hat kein Finding dazu im Kopf. Kein praktischer Erfahrungswert vorhanden. Theoretisches Risiko existiert, aber ohne konkreten Erfahrungshinweis kein Phase-1-Finding.

---

### F.3 - `installed_apps.code_bundle` (DB-JSONB): wer kann diese Spalte direkt manipulieren (z.B. via Admin-API)? Falls ja — ist das im Audit als eigenes Finding wert?

> **Andis Antwort:**
>
> Direkt per Admin-API code_bundle als Payload setzen: Nein (kein Endpoint akzeptiert codeBundle im Body).
> Indirekt überschreiben: Ja über Sideload/Update-Flows: admin/apps/sideload.post + local-sideload.post (nur superadmin, plus sideload-gate); admin/apps/[appId]/update.post (admin/superadmin) kann bei preserveCodeBundle=false das Bundle neu bauen und in installed_apps.code_bundle schreiben.
> Wer kann also effektiv manipulieren? App-seitig: Admin/Superadmin, aber i.d.R. nur über vorhandene repositoryUrl/lokalen Pfad, nicht frei per JSON. DB-seitig: jeder mit direktem SQL-Write auf DB.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Kein direkter API-Injection-Pfad. Indirekter Zugriff (Sideload/Update) ist bereits superadmin-gated und durch CF-01 (unsandboxed Execution) abgedeckt. DB-direkter-Write ist Infrastructure-Concern, kein App-Code-Finding. Wave 4 prüft ob CF-01 diesen Angle schon enthält.

---

## Bereich G - Audit- / Logging-Pfad

### G.1 - Gibt es Security-relevante Events (failed Login, Role-Change, App-Install, Token-Revoke), für die du dir zu wenig Audit-Log wünschst? (Low-Priorität-Finding-Kandidat)

> **Andis Antwort:**
>
> Ja, ich sehe Lücken: zu wenig nutzbares Audit + zu wenig klare UI-Fehlergründe bei Security-relevanten Flows (Login/App-Install/Token).

**Claude-Bucket-Zuordnung:**
- [x] Wird Finding (Kandidat-ID: CF-29) — Fehlende Audit-Logs für Security-Events (failed Login, Role-Change, App-Install, Token-Revoke) + unklare UI-Fehlergründe bei diesen Flows. Low/Operational: kein direkter Exploit-Pfad, aber Observability-Lücke erschwert Incident-Detection. Phase 3+ adressieren.
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### G.2 - PII im Log: erinnerst du dich an ein `console.log` oder `logger.info`, das E-Mail/Discord-ID/Session-Token im Klartext loggt und im Kopf als "später mal fixen" abgelegt wurde?

> **Andis Antwort:**
>
> Nein, aber auch nicht drauf geachtet.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [x] Wird Deferred mit Begründung: Kein konkretes Finding im Kopf, aber auch nie aktiv geprüft. Wave 4 soll per grep auf PII-Patterns in console.log/logger.info scannen (E-Mail, discordId, token) — kein Kopf-Review-Finding, aber offener Scan-Task.
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich H - Offene Kategorie (Catch-All)

### H.1 - Welches bisher nicht genanntes Finding trägst du im Kopf herum, das in keinem der obigen Bereiche fällt?

> **Andis Antwort:**
>
> Keine Ahnung.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi hat kein Finding dazu im Kopf.

---

### H.2 - Wovon hast du nachts mal geträumt ("jemand kann X tun und dann …") und dir gedacht "muss ich mal prüfen"? → Das kommt jetzt rein, egal ob Critical oder Low.

> **Andis Antwort:**
>
> Nichts.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi hat kein Finding dazu im Kopf.

---

### H.3 - Etwas, das du im PROJECT.md-Core-Value "Andi kann ohne Bauchschmerzen zeigen" als offen hast und was NICHT in die SEC-02…SEC-07 reinpasst?

> **Andis Antwort:**
>
> Nein.

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [x] Wird gelöscht mit Begründung: Andi hat kein Finding dazu im Kopf. Kein Gap außerhalb SEC-02..07.
- Notiz: Falls H.3 ein Gap in SEC-02..07 aufdeckt -> per 01-RESEARCH.md §Open Questions #3 wird es Deferred mit Phase v2 und Notiz "wurde in Phase 1 entdeckt, fällt nicht in SEC-02..SEC-07, wird in nächster Milestone als neues Requirement aufgenommen". Nicht als neues SEC-XX in Phase 1.

---

## Session-Abschluss

- **Dauer:** ~45 Minuten
- **Gesamt-Fragen beantwortet:** 27 (4+4+5+3+3+3+2+3)
- **Bucket-Aufteilung:** 12 Finding-Kandidaten (CF-18–CF-29), 9 Deferred, 6 gelöscht.
- **Offene Punkte für Wave 4:** G.2 (PII-Log-Scan per grep), E.2 (S3-Pfad statisch prüfen via Read-Tool), D.3 (CF-03 um DATABASE_SSL: false ergänzen).
