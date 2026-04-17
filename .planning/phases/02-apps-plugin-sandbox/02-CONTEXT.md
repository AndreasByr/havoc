# Phase 2: Apps-Plugin-Sandbox - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 liefert **minimale Härtung der App-Plugin-Execution** — kein echter Sandbox-Mechanismus, sondern drei gezielte Schutzmaßnahmen gegen reale Risiken in einem geschlossenen, admin-kontrollierten Self-Hosting-System.

**Rescoped aus dem ursprünglichen isolated-vm-Konzept:**
Das ursprüngliche Sandbox-Design (isolated-vm) passt nicht zum Threat Model. Guildora ist ein closed, admin-controlled System: Apps durchlaufen Marketplace-Zertifizierung mit AI Code Review, Sideloading ist in Production deaktiviert, nur Admins können Apps installieren. Ein Angreifer der Fremd-Code einschleusen könnte, hat bereits Admin-Zugriff — dann ist die Sandbox das kleinste Problem. Aufwand für echte Isolation (Native Addon, Bridge-API, App-Migration) steht in keinem Verhältnis zum Gewinn.

**Was Phase 2 liefert:**
1. **Hook-Timeout** — Promise.race() mit konfigurierbarem Timeout in beiden Execution-Sites
2. **Memory-Cap** — Prozess-Level-Limits für Bot und Hub
3. **Audit-Log** — Strukturiertes Logging aller App-Lifecycle- und Fehler-Events

**Nicht-Ziele dieser Phase:**
- Kein isolated-vm oder Worker-Thread-Isolation
- Kein Sideload-Integrity-Check (F-06 deferred)
- Keine Browser-seitige Härtung (vue3-sfc-loader — eigenes Thema)
- Keine Änderungen an der App-API-Surface (App-Hooks + h3-Helpers bleiben wie sie sind)

</domain>

<decisions>
## Implementation Decisions

### Rescope-Rationale

- **D-01:** Phase 2 wird auf minimale Härtung umgescopet. SEC-02-Requirement wird entsprechend angepasst. Begründung: Threat Model für isolated-vm (kompromittierte App-Installation durch externen Angreifer) trifft bei Guildora nicht zu — das System ist admin-gated, marketplace-zertifiziert, Sideloading in Prod deaktiviert. Die drei Härtungen schützen gegen reale Risiken (unbeabsichtigte Bugs in zertifizierten Apps), ohne Wochen Entwicklungsarbeit und Build-Komplexität einzuführen.

### Hook-Timeout

- **D-02:** `Promise.race()` mit Timeout in **beiden** Execution-Sites implementieren:
  - `platform/apps/bot/src/utils/app-hooks.ts` (Bot-Hooks via emit())
  - `platform/apps/hub/server/api/apps/[...path].ts` (Hub-API-Route-Handler)
  - Der Hub-Fall ist kritischer als der Bot-Fall: ein hängender Handler blockiert den gesamten Nitro-Worker für diesen Request.
- **D-03:** Timeout-Wert ist konfigurierbar via env var `APP_HOOK_TIMEOUT_MS` mit Default `5000` (ms). Implementierung: `process.env.APP_HOOK_TIMEOUT_MS ?? 5000`. Begründung: Eine legitime App mit externem API-Call braucht sonst einen Code-Change; Self-Hosting-Admins kontrollieren die .env und das ist der natürliche Tuning-Knopf.
- **D-04:** Bei Timeout-Hit: Fail Loud — Fehler wird geloggt (siehe Audit-Log), Request/Hook returned einen klaren Fehler statt silent hanging.

### Memory-Cap

- **D-05:** Beide App-Code-ausführenden Prozesse bekommen einen Memory-Cap via `--max-old-space-size` Node.js-Flag:
  - **Bot-Prozess:** `--max-old-space-size=512` (leichtgewichtig, nur Hooks)
  - **Hub-Prozess:** `--max-old-space-size=1024` (mehr Headroom für Nuxt/SSR/Sharp)
- **D-06:** Implementierung als Startup-Flags — entweder in `package.json` scripts (NODE_OPTIONS oder direktes Flag) oder als Docker ENTRYPOINT-Parameter. Planner entscheidet die genaue Stelle, muss konsistent mit dem bestehenden Docker-Setup sein.

### Audit-Log

- **D-07:** Logging via **consola** (existing pattern im Bot — `platform/apps/bot/src/utils/logger.ts`). Kein eigenes DB-Schema, keine Migration, kein neue UI. Begründung: `docker logs | grep appId` reicht für die Solo-Admin-Use-Case.
- **D-08:** Strukturiertes Log-Format: `{ appId, event, durationMs?, error? }` — damit Logs maschinenlesbar bleiben.
- **D-09:** Zu loggenden Events:
  | Event | Wo | Warum |
  |-------|-----|-------|
  | `app.installed` | Hub API | Wer hat wann was installiert |
  | `app.uninstalled` | Hub API | Vollständiger Lifecycle-Trail |
  | `hook.error` | Bot `app-hooks.ts` | Buggy App frühzeitig erkennen |
  | `hook.timeout` | Bot `app-hooks.ts` | Wichtigster neuer Event — Performance-Probleme |
  | `route.error` | Hub `[...path].ts` | Equivalent zu hook.error für HTTP-Handler |
  | `route.timeout` | Hub `[...path].ts` | Timeout-Hit im Nitro-Worker |
  - Hinweis: `hook.error` im Bot ist heute teilweise implementiert (logger.error in emit()), aber ohne strukturiertes Format — vereinheitlichen.

### Execution-Sites-Scope

- **D-10:** Beide server-seitigen Execution-Sites sind in Phase 2 enthalten. Browser-Site (`platform/apps/hub/app/plugins/vue3-sfc-loader.client.ts`) ist **explizit out of scope** — anderes Threat Model (kein Server-Prozess, kein DB-Zugriff), Frontend-Security-Thema (CSP, DOMPurify), eigene Phase falls nötig.

### Kompatibilitätstest

- **D-11:** `voice-rooms` ist die Referenz-App für den Kompatibilitätstest (ausgereifteste App). Nach der Umstellung muss voice-rooms unverändert laufen.
- **D-12:** Falls die Phase 2-Änderungen dennoch eine Anpassung der App-API-Surface erfordern (nicht erwartet, da Timeout/Cap Infrastructure-Level sind), müssen **sowohl `voice-rooms` als auch `app-template`** aktualisiert werden — app-template ist die Referenzbasis für alle weiteren Apps.

### Context-Passing

- **D-13:** Context-Passing (DB, Bot-API, h3-Helpers in App-Code) ist durch den Rescope auf minimal hardening **hinfällig** — `new Function()` bleibt, keine Sandbox-Grenze, keine IPC/Proxy-Bridge nötig. App-API-Surface bleibt unverändert.

### Claude's Discretion

- Genaue Stelle für `--max-old-space-size`-Flag (package.json NODE_OPTIONS vs. Docker ENTRYPOINT vs. shell script) — Planner entscheidet nach bestehendem Docker-Setup
- Timeout-Wrapper-Implementierung (generische Helper-Funktion vs. inline) — Planner entscheidet
- Log-Level für Timeout/Error-Events (warn vs. error) — Claude's Judgement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security Audit (Pflicht)
- `.planning/research/01-security-audit.md` §4 "Findings — Critical" [F-01] — vollständige Beschreibung der drei Execution-Sites + h3-Whitelist-Surface
- `.planning/research/01-security-audit.md` §6 "Findings — Medium" [F-06] — Sideload-Integrity/TOCTOU (deferred, zum Verständnis warum es nicht in Phase 2 ist)
- `.planning/codebase/CONCERNS.md` §"No Sandboxing for Plugin Code Execution" — Original-Finding mit Current-Mitigation-Detail

### Execution-Sites (beide müssen angefasst werden)
- `platform/apps/bot/src/utils/app-hooks.ts` — Bot-Execution-Site (new Function bei :128, emit() bei Hook-Invocation)
- `platform/apps/hub/server/api/apps/[...path].ts` — Hub-Execution-Site (new Function bei :86, Handler-Invocation)

### Existing Logging Pattern
- `platform/apps/bot/src/utils/logger.ts` — consola-Logger-Setup; Audit-Log soll dieses Pattern verwenden

### Anforderungen
- `.planning/REQUIREMENTS.md` §SEC-02 — Requirement wird durch diese Phase erfüllt (angepasste Interpretation: minimale Härtung statt echter Sandbox)
- `.planning/ROADMAP.md` §"Phase 2: Apps-Plugin-Sandbox" — Originale Success Criteria (Planner muss diese gegen den Rescope abgleichen und anpassen)

### App-Template-Referenz (für Kompatibilitäts-Kontext)
- `app-template/` (Workspace-Root, nicht in platform/) — Referenz-Basis für App-Entwickler; bei API-Änderungen (nicht erwartet) muss es synchron gehalten werden

### Nicht-Ziele explizit dokumentiert
- `platform/apps/hub/app/plugins/vue3-sfc-loader.client.ts` — Browser-seitige Execution-Site, explizit out of scope für Phase 2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/apps/bot/src/utils/logger.ts` — consola-Logger, direkt verwendbar für Audit-Log-Events
- `platform/apps/bot/src/utils/app-hooks.ts:emit()` — bestehende Fehlerbehandlung (logger.error) muss auf strukturiertes Format vereinheitlicht werden

### Established Patterns
- Bestehende Mitigation in beiden Sites: `require()` ist geblockt, whitelisted Helpers/Context, App muss aktiv+valid-manifest sein
- Bot-Prozess: Node.js-Prozess mit eigenem Startup-Script — Memory-Flag gut integrierbar
- Hub-Prozess: Nuxt/Nitro — Memory-Flag via NODE_OPTIONS in nuxt.config.ts oder package.json script

### Integration Points
- `apps/bot/src/utils/app-hooks.ts` → BotAppHookRegistry.emit() — Timeout-Wrapper hier einbauen
- `apps/hub/server/api/apps/[...path].ts` → Handler-Invocation-Block — Timeout-Wrapper hier einbauen
- App-Installation-Events: bestehende Install/Uninstall-API-Routes im Hub finden und dort Audit-Log aufrufen

</code_context>

<specifics>
## Specific Ideas

- **Promise.race()-Pattern:** `Promise.race([handler(event), new Promise((_, reject) => setTimeout(() => reject(new Error('App timeout')), timeout))])`
- **Consola-Format-Ziel:** `logger.info({ appId, event: 'hook.timeout', durationMs: timeout })` — damit `docker logs | grep appId` sofort funktioniert
- **voice-rooms als Kompatibilitäts-Referenz:** Läuft nach der Umstellung ohne Code-Änderung weiter — verifiziert in einem dedizierten Test oder manuell im Dev-Setup

</specifics>

<deferred>
## Deferred Ideas

- **isolated-vm / echter Sandbox-Mechanismus** — Nicht dem Threat Model entsprechend für den aktuellen Einsatz. Kann in einer späteren Milestone überdacht werden falls sich das Deployment-Modell ändert (z.B. Multi-Tenant-Hosting).
- **F-06: Sideload-Integrity-Check / TOCTOU** — Commit-SHA pinnen beim Sideload-Fetch. Sideloading ist in Prod deaktiviert, Risiko marginal. Deferred zu v2.
- **Browser-Site (vue3-sfc-loader.client.ts)** — Frontend-Security-Thema (CSP, DOMPurify, XSS-Audit). Eigene Phase falls nötig — nicht Teil einer Server-Execution-Härtung.
- **Worker-Thread-Isolation** — War als alternative zu isolated-vm diskutiert. Kein echter Memory-Limit pro Thread, schwächere Isolation als isolated-vm. Bei Revisit: isolated-vm wäre der bessere Ansatz.

</deferred>

---

*Phase: 02-apps-plugin-sandbox*
*Context gathered: 2026-04-17*
