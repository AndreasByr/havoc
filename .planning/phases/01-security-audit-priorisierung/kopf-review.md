# Kopf-Review Protokoll - Phase 1 Security Audit

**Session-Datum:** _Task 2 füllt._
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
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...
- Notiz: A.1 ist Input für Phase-2-Research (Sandbox-Tech-Wahl), KEIN Phase-1-Finding - per 01-RESEARCH.md Bereich-A-Note.

---

### A.2 - Gibt es Apps-Code, der im Hub anders aufgerufen wird als im Bot — also abseits der beiden bekannten Execution-Sites (`apps/bot/src/utils/app-hooks.ts:128` und `apps/hub/server/api/apps/[...path].ts:86`)? Z.B. Page-Render-Server-Side via `vue3-sfc-loader`?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### A.3 - Welche h3-Helpers sind heute exponiert und welchen davon würdest du im Nachhinein lieber nicht exponieren? (Whitelist-Review)

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### A.4 - Die `createAppDb`-KV-Abstraktion — hast du dort Bauchweh wegen Scope-Leakage zwischen Apps (ein App liest fremde App-Keys)?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich B - Internal-Auth (Hub <-> Bot, MCP, Application-Tokens)

### B.1 - Neben `internal-auth.ts:16` und `internal-sync-server.ts:86` — gibt es einen weiteren Pfad, an dem ein Token verglichen wird (z.B. `application-tokens.ts`, `platformBridge.ts`)? Welches Vergleichs-Schema dort?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### B.2 - `APPLICATION_TOKEN_SECRET` — wie wird der genutzt, wo wird er verifiziert, und gibt es dort eine Timing-Frage?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### B.3 - Der MCP-Token-Pfad: hat die MCP-Komponente je in Produktion gelaufen, oder ist das aktuell "eingebaut, aber ungenutzt"? Relevant für Severity-Bewertung (ungenutzt ≠ unrisky, aber andere Restrisiko-Basis).

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### B.4 - Im `.env.example` steht `BOT_INTERNAL_TOKEN=replace_with_internal_sync_token` — gibt es in der Realität Deployments, wo dieser Placeholder NICHT ersetzt wurde, und das dadurch zum Live-Finding wird?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich C - Session & CSRF

### C.1 - `03-session.ts` fängt `getUserSession`-Fehler und setzt `userSession = null`. Hast du konkrete Stellen im Kopf, wo dieser Silent-Fallback dich beißt, oder ist das "nur Bauchweh"?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### C.2 - `02-csrf-check.ts` skippt CSRF, wenn weder `Origin` noch `Referer` gesetzt sind (SSR-Internal-Request-Exception). Siehst du einen Angriffspfad, wie das von aussen ausgenutzt werden kann (z.B. via Tool, das Header bewusst weglässt)?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### C.3 - Session-Rotation nach Login (SEC-05): funktioniert das heute schon durch `nuxt-auth-utils` automatisch, oder ist das offen? Falls offen — weißt du warum?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### C.4 - Cookie-Flags (`HttpOnly`, `Secure`, `SameSite`): kennst du Umgebungen, in denen `Secure` nicht greift (lokale Preview-URL ohne TLS, o.ä.)?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### C.5 - Dev-Login-Bypass (`NUXT_AUTH_DEV_BYPASS=true`, `apps/hub/server/api/auth/dev-login.get.ts`, `apps/hub/server/api/dev/*`): wie sicher bist du, dass dieser Pfad in Prod wirklich aus ist?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich D - Supply-Chain & Secrets

### D.1 - 12 `pnpm.overrides` — weißt du bei allen, welchen CVE oder welches Upstream-Problem sie patchen? Fällt dir einer ein, wo du dir NICHT mehr sicher bist, ob er noch nötig ist?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### D.2 - `.env`-Handling — gibt es irgendwo im Code eine Stelle, an der ein Fallback-Default "auslöst, wenn ENV fehlt" und damit schweigend weiterläuft mit einer unsicheren Default-Konfiguration? (Fail-Loud-Test)

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### D.3 - `docker-compose.yml` — neben dem bekannten `POSTGRES_PASSWORD: postgres`: kennst du weitere Stellen, wo ein Wert hartcoded ist, der eigentlich aus `.env` kommen sollte?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich E - Upload / Media / File-Serving

### E.1 - Avatar-Upload (`apps/hub/server/api/profile/avatar.put.ts`) und Application-Upload (`apps/hub/server/api/apply/[flowId]/upload.post.ts`) prüfen MIME-Allowlist + 5MB-Limit. Hast du ein Finding dazu im Kopf, das über MIME-Sniffing-Risiken, Path-Traversal (`../`) oder Race-Conditions hinausgeht, was der Code heute prüft?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### E.2 - `media.ts` / S3-Config: fällt dir eine Stelle ein, an der ein User-eingeschleuster Pfad direkt an `PutObjectCommand` gelangen könnte?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### E.3 - `apps/hub/media/uploads/` liegt untracked auf dem Host-Filesystem — ist das nach aussen servbar (z.B. durch ein `/uploads/*`-Serve), und wenn ja: ist das auth-protected?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich F - Apps-Pipeline & Sideload

### F.1 - `app-sideload.ts` holt Code von `raw.githubusercontent.com`. Gibt es ein TOCTOU-Risiko (Manifest-Fetch zeigt X, aber der Code-Fetch Sekunden später zeigt Y)? Schon mal gesehen?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### F.2 - esbuild-Transpilation in `app-sideload.ts`: hat esbuild jemals verschachtelten Code ausgegeben, der sich im Runtime anders verhält als im Manifest signalisiert? (Compile-Time Obfuscation durch Angreifer)

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### F.3 - `installed_apps.code_bundle` (DB-JSONB): wer kann diese Spalte direkt manipulieren (z.B. via Admin-API)? Falls ja — ist das im Audit als eigenes Finding wert?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich G - Audit- / Logging-Pfad

### G.1 - Gibt es Security-relevante Events (failed Login, Role-Change, App-Install, Token-Revoke), für die du dir zu wenig Audit-Log wünschst? (Low-Priorität-Finding-Kandidat)

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### G.2 - PII im Log: erinnerst du dich an ein `console.log` oder `logger.info`, das E-Mail/Discord-ID/Session-Token im Klartext loggt und im Kopf als "später mal fixen" abgelegt wurde?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

## Bereich H - Offene Kategorie (Catch-All)

### H.1 - Welches bisher nicht genanntes Finding trägst du im Kopf herum, das in keinem der obigen Bereiche fällt?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### H.2 - Wovon hast du nachts mal geträumt ("jemand kann X tun und dann …") und dir gedacht "muss ich mal prüfen"? → Das kommt jetzt rein, egal ob Critical oder Low.

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...

---

### H.3 - Etwas, das du im PROJECT.md-Core-Value "Andi kann ohne Bauchschmerzen zeigen" als offen hast und was NICHT in die SEC-02…SEC-07 reinpasst?

> **Andis Antwort:**
>
> _Task 2 füllt._

**Claude-Bucket-Zuordnung:**
- [ ] Wird Finding (Kandidat-ID: CF-...)
- [ ] Wird Deferred mit Begründung: ...
- [ ] Wird gelöscht mit Begründung: ...
- Notiz: Falls H.3 ein Gap in SEC-02..07 aufdeckt -> per 01-RESEARCH.md §Open Questions #3 wird es Deferred mit Phase v2 und Notiz "wurde in Phase 1 entdeckt, fällt nicht in SEC-02..SEC-07, wird in nächster Milestone als neues Requirement aufgenommen". Nicht als neues SEC-XX in Phase 1.

---

## Session-Abschluss

- **Dauer:** _Task 2 füllt._
- **Gesamt-Fragen beantwortet:** 27 (4+4+5+3+3+3+2+3)
- **Bucket-Aufteilung:** _Task 2 füllt (X Finding-Kandidaten, Y Deferred, Z gelöscht)._
- **Offene Punkte für Wave 4:** _Task 2 füllt - Fragen, bei denen Andi "muss ich noch prüfen" gesagt hat._
