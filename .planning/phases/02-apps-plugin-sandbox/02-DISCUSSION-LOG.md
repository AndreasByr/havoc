# Phase 2: Apps-Plugin-Sandbox - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 02-apps-plugin-sandbox
**Areas discussed:** Sandbox-Technologie (Rescope), Execution-Sites-Scope, Context-Passing nach Sandbox, Real-App-Kompatibilität

---

## Sandbox-Technologie → Rescope auf minimale Härtung

| Option | Description | Selected |
|--------|-------------|----------|
| isolated-vm | Echter V8-Isolate, CPU/Memory-Limits built-in, Native Addon | |
| Worker Threads | Node built-in, schwächere Isolation, kein echter Memory-Limit | |
| Minimal Hardening (Timeout + Memory-Cap + Audit-Log) | Kein echter Sandbox-Mechanismus, gezielte Schutzmaßnahmen | ✓ |

**User's choice:** Minimale Härtung — kein isolated-vm
**Notes:** Das isolated-vm-Konzept passt nicht zum Threat Model. Guildora ist ein closed, admin-controlled System: Marketplace-Zertifizierung mit AI Code Review, Sideloading in Prod deaktiviert, nur Admins können Apps installieren. Aufwand (Native Addon kompilieren, Bridge-API für DB/Bot-Context, App-Migration) steht in keinem Verhältnis. Die drei Maßnahmen schützen gegen reale Risiken (unbeabsichtigte Bugs in zertifizierten Apps).

---

## Timeout-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nur Bot-Hooks | Promise.race() nur in app-hooks.ts | |
| Beide Sites (Bot + Hub) | Promise.race() in app-hooks.ts UND [...path].ts | ✓ |

**User's choice:** Beide Sites
**Notes:** Hub-Fall ist sogar kritischer — ein hängender Handler blockiert den gesamten Nitro-Worker für den Request. Timeout-Wert: env var `APP_HOOK_TIMEOUT_MS` mit Default 5000ms. Begründung: Self-Hosting-Admins kontrollieren die .env; eine legitime App mit externem API-Call bräuchte sonst einen Code-Change.

---

## Memory-Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Nur Bot-Prozess | --max-old-space-size=512 nur für Bot | |
| Bot + Hub (unterschiedliche Werte) | Bot: 512MB, Hub: 1024MB | ✓ |

**User's choice:** Beide Prozesse, unterschiedliche Werte
**Notes:** Hub braucht mehr Headroom für Nuxt/SSR/Sharp → 1024MB. Bot ist leichtgewichtig → 512MB.

---

## Audit-Log

| Option | Description | Selected |
|--------|-------------|----------|
| Nur consola (strukturiert) | { appId, event, durationMs?, error? } via consola | ✓ |
| DB-Tabelle | Eigenes Schema, Migrations, UI | |

**User's choice:** consola mit strukturiertem Format
**Notes:** docker logs | grep appId reicht für Solo-Admin-Usecase. DB-Tabelle wäre Overengineering aus demselben Grund wie isolated-vm. Events: app.installed, app.uninstalled, hook.error, hook.timeout, route.error, route.timeout. Hinweis: hook.error ist im Bot heute teilweise implementiert (logger.error in emit()), aber ohne strukturiertes Format — vereinheitlichen.

---

## F-06 (Sideload-Integrity / TOCTOU)

| Option | Description | Selected |
|--------|-------------|----------|
| Deferred | Sideloading in Prod deaktiviert — Risiko marginal | ✓ |
| In Phase 2 mitnehmen | Commit-SHA pinnen, kleiner 1h-Task | |

**User's choice:** Deferred

---

## Execution-Sites-Scope (Browser-Site)

| Option | Description | Selected |
|--------|-------------|----------|
| Nur server-seitige Sites | Bot + Hub, Browser explizit out of scope | ✓ |
| Alle drei Sites inkl. Browser | vue3-sfc-loader auch in Phase 2 | |

**User's choice:** Nur server-seitige Sites
**Notes:** vue3-sfc-loader läuft im User-Browser, nicht auf dem Server. Kein Server-Prozess gefährdet, kein DB-Zugriff möglich. Frontend-Security-Thema (CSP, DOMPurify) — eigene Phase falls nötig. Explizit dokumentieren damit es nicht vergessen wird.

---

## Real-App-Kompatibilität

**User's choice:** voice-rooms als Referenz-App
**Notes:** voice-rooms ist die ausgereifteste App. Falls die Phase 2-Änderungen eine Anpassung der App-API-Surface erfordern (nicht erwartet), müssen voice-rooms UND app-template synchron aktualisiert werden — app-template ist die Referenzbasis für andere App-Entwickler.

---

## Context-Passing nach Sandbox

**Notes:** Durch den Rescope auf minimale Härtung hinfällig — new Function() bleibt, keine Sandbox-Grenze, kein IPC/Proxy-Bridge nötig. App-API-Surface (BotContext, h3-Helpers) bleibt unverändert.

---

## Claude's Discretion

- Genaue Stelle für --max-old-space-size-Flag (package.json NODE_OPTIONS vs. Docker ENTRYPOINT)
- Timeout-Wrapper-Implementierung (generische Helper-Funktion vs. inline)
- Log-Level für Timeout/Error-Events

## Deferred Ideas

- isolated-vm / Worker-Thread-Sandbox — falls Deployment-Modell sich ändert
- F-06 Sideload-Integrity (TOCTOU) — v2
- Browser-Site (vue3-sfc-loader) — Frontend-Security-Phase
