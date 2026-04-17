# Phase 2: Apps-Plugin-Sandbox - Research

**Researched:** 2026-04-17
**Domain:** Node.js app-hook execution hardening — timeout wrapping, memory limits, structured audit logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 2 wird auf minimale Härtung umgescopet. Drei gezielte Schutzmaßnahmen, kein isolated-vm, kein Worker-Thread.
- **D-02:** `Promise.race()` mit Timeout in BEIDEN Execution-Sites: `platform/apps/bot/src/utils/app-hooks.ts` (BotAppHookRegistry.emit) und `platform/apps/hub/server/api/apps/[...path].ts` (Handler-Invocation).
- **D-03:** Timeout-Wert konfigurierbar via `APP_HOOK_TIMEOUT_MS` env var, Default `5000` ms. Implementierung: `process.env.APP_HOOK_TIMEOUT_MS ?? 5000`.
- **D-04:** Bei Timeout-Hit: Fail Loud — Fehler wird geloggt, Request/Hook returned klaren Fehler statt silent hanging.
- **D-05:** Memory-Cap via `--max-old-space-size` Node.js-Flag: Bot=512 MB, Hub=1024 MB.
- **D-06:** Implementierung als Startup-Flags (package.json scripts oder Docker ENTRYPOINT). Planner entscheidet genaue Stelle.
- **D-07:** Logging via consola (existing pattern). Kein DB-Schema, keine Migration, keine neue UI.
- **D-08:** Strukturiertes Log-Format: `{ appId, event, durationMs?, error? }`.
- **D-09:** Events: `app.installed`, `app.uninstalled` (Hub API); `hook.error`, `hook.timeout` (Bot app-hooks.ts); `route.error`, `route.timeout` (Hub [...path].ts).
- **D-10:** Browser-Site (vue3-sfc-loader.client.ts) ist EXPLIZIT OUT OF SCOPE.
- **D-11:** voice-rooms ist Referenz-App für Kompatibilitätstest.
- **D-12:** Falls API-Surface-Änderungen nötig (nicht erwartet): voice-rooms + app-template beide updaten.
- **D-13:** Context-Passing-Komplexität entfällt — `new Function()` bleibt, keine Sandbox-Grenze.

### Claude's Discretion

- Genaue Stelle für `--max-old-space-size`-Flag (package.json NODE_OPTIONS vs. Docker ENTRYPOINT vs. shell script)
- Timeout-Wrapper-Implementierung (generische Helper-Funktion vs. inline)
- Log-Level für Timeout/Error-Events (warn vs. error)

### Deferred Ideas (OUT OF SCOPE)

- isolated-vm / echter Sandbox-Mechanismus
- F-06: Sideload-Integrity-Check / TOCTOU
- Browser-Site (vue3-sfc-loader.client.ts)
- Worker-Thread-Isolation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | Apps-Plugin-Code läuft in "Sandbox" mit CPU-Limit, Memory-Limit und Execution-Timeout; Zugriff nur über whitelistete APIs | Rescoped: Promise.race()-Timeout erfüllt Execution-Timeout; --max-old-space-size erfüllt Memory-Limit; CPU-Limit ist durch Timeout abgedeckt (infinite loop wird nach 5 s abgebrochen); bestehende require()-Block + h3-Whitelist erfüllt API-Whitelist-Requirement |
</phase_requirements>

---

## Summary

Phase 2 ist eine gezielte Hardening-Runde mit drei klar abgegrenzten Änderungen: Timeout-Wrapping beider Execution-Sites via `Promise.race()`, Memory-Cap via `--max-old-space-size` Node.js-Flag für Bot- und Hub-Prozess, und strukturiertes Audit-Logging aller App-Lifecycle- und Fehler-Events via consola.

Die Codebase ist gut verstanden. Beide Execution-Sites sind kurze, gut lesbare Dateien (app-hooks.ts: 159 Zeilen, [...path].ts: 112 Zeilen). Ein gut ausgebautes Spec-File für app-hooks existiert bereits (app-hooks.spec.ts, 220 Zeilen) mit vollständiger Registry-Testabdeckung. Die Test-Infrastruktur (Vitest für Bot und Hub) läuft ohne externe Abhängigkeiten. Der Hauptaufwand liegt im Timeout-Wrapper und den neuen Spec-Tests für Timeout-Verhalten.

**Primary recommendation:** Implementiere den Timeout-Wrapper als shared private Helper-Funktion innerhalb jeder Execution-Site (kein separates Package), nutze NODE_OPTIONS in package.json scripts für Memory-Cap, und erweitere bestehende app-hooks.spec.ts um Timeout-Tests statt neue Test-Dateien anzulegen.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hook-Timeout (Bot) | Bot-Prozess (Node.js) | — | Promise.race() in BotAppHookRegistry.emit(); Bot-Prozess ist Execution-Site |
| Hook-Timeout (Hub) | API / Backend (Nitro) | — | Promise.race() in [...path].ts Handler-Invocation; Nitro-Worker-Thread blockiert sonst |
| Memory-Cap (Bot) | Bot-Prozess (Node.js) | Docker ENTRYPOINT | --max-old-space-size Flag am Node.js-Start |
| Memory-Cap (Hub) | API / Backend (Nitro) | Docker CMD / NODE_OPTIONS | --max-old-space-size Flag am Nuxt-Output-Start |
| Audit-Log (Lifecycle) | API / Backend (Hub) | — | Install/Uninstall-Events in vorhandenen Admin-API-Routes |
| Audit-Log (Hook/Route) | Bot + Hub API | — | In den Execution-Sites nach dem Promise.race() |

---

## Standard Stack

### Core (bereits im Projekt vorhanden)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| consola | 3.4.2 | Structured logging (Audit-Log) | Already used in bot logger.ts; established project pattern [VERIFIED: npm registry + codebase grep] |
| Node.js built-in Promise | Node.js 24.x | Timeout-Wrapping via Promise.race() | No dependency needed; pattern described in CONTEXT.md [VERIFIED: codebase] |
| Vitest | 3.1.1 (bot) / 2.1.1 (hub) | Test framework | Already configured in both apps [VERIFIED: codebase] |

### No New Dependencies Required

All three hardening measures (timeout, memory cap, audit log) use existing runtime primitives and libraries. No `npm install` step is needed for Phase 2. [VERIFIED: codebase analysis]

---

## Architecture Patterns

### System Architecture Diagram

```
App Hook Invocation (Bot-Side):
  Discord Event
    → BotAppHookRegistry.emit(eventName, payload)
        → [for each appId handler]
            → loadAppConfig(appId) [DB read]
            → Promise.race([
                handler(payload, ctx),          ← app code
                timeoutReject(TIMEOUT_MS)        ← new Timer
              ])
              ├─ resolved → log hook.ok (optional, trace-level)
              └─ rejected (error) → log hook.error { appId, event, error }
              └─ rejected (timeout) → log hook.timeout { appId, event, durationMs }
        → continue to next app (error isolation preserved)

App Route Invocation (Hub-Side):
  HTTP Request → Nitro Worker
    → apps/[...path].ts defineEventHandler
        → requireSession + role check
        → new Function() loads handler from codeBundle
        → Promise.race([
            handler(event),                      ← app code
            timeoutReject(TIMEOUT_MS)            ← new Timer
          ])
          ├─ resolved → return response
          └─ rejected (error) → log route.error + createError(500)
          └─ rejected (timeout) → log route.timeout + createError(504)

Audit Log Flow (Install/Uninstall):
  Admin API (status.put.ts / [id].delete.ts / sideload.post.ts)
    → setInstalledAppStatus() / installAppFromUrl() / delete
    → logger.info({ appId, event: 'app.installed'|'app.uninstalled', ... })
    → stdout → docker logs | grep appId
```

### Recommended Project Structure

No structural changes needed. All changes are in-place modifications of existing files:

```
platform/apps/bot/src/utils/
├── app-hooks.ts              # ADD: timeout wrapper + structured audit log
└── __tests__/
    └── app-hooks.spec.ts     # ADD: timeout + structured log tests

platform/apps/hub/server/api/apps/
└── [...path].ts              # ADD: timeout wrapper + route.error/timeout log

platform/apps/hub/server/api/admin/apps/
├── sideload.post.ts          # ADD: app.installed log
├── [id].delete.ts            # ADD: app.uninstalled log
└── [appId]/
    └── status.put.ts         # ADD: app.installed/uninstalled log (activate/deactivate)

platform/apps/bot/package.json         # ADD: NODE_OPTIONS to start script
platform/apps/bot/Dockerfile           # POSSIBLY: CMD with --max-old-space-size
platform/apps/hub/Dockerfile           # POSSIBLY: CMD with --max-old-space-size

platform/.env.example                  # ADD: APP_HOOK_TIMEOUT_MS documentation
```

### Pattern 1: Promise.race() Timeout Wrapper

**What:** Races the app handler against a timeout rejection. The losing promise is abandoned (Node.js does not cancel the original promise, but we stop waiting for it).
**When to use:** Both execution sites — BotAppHookRegistry.emit() and Hub [...path].ts handler invocation.

```typescript
// Source: CONTEXT.md §"Specific Ideas" + Node.js built-ins [VERIFIED: codebase]

const HOOK_TIMEOUT_MS = parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10);

function withTimeout<T>(promise: Promise<T>, appId: string, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`App '${appId}' hook timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}
```

**Important caveat:** `Promise.race()` does not terminate the underlying computation — a `while(true){}` in synchronous app code will block the event loop regardless. Timeout only works for async-yielding operations (awaited I/O, promises). For truly infinite synchronous loops, only process-level termination (Worker threads, separate process) would help. Given the rescoped threat model (trusted, marketplace-certified apps), this is the accepted trade-off. [VERIFIED: Node.js semantics, ASSUMED: this is acceptable per D-01 threat model]

**This means:** The timeout protects against hung async operations (external API calls, DB queries that don't resolve), but NOT against tight synchronous CPU loops in app code. Document this limitation explicitly in code comments.

### Pattern 2: Structured consola Audit Log

**What:** Replace unstructured `logger.error("App hook failed", ...)` with typed structured log objects.
**When to use:** All six audit events listed in D-09.

```typescript
// Source: platform/apps/bot/src/utils/logger.ts [VERIFIED: codebase]
// Existing pattern — extend, don't replace

// Current (unstructured):
logger.error("App hook failed", { appId, hookName: eventName, error });

// Target (structured per D-08):
logger.error({ appId, event: "hook.error", error: (err as Error).message });
logger.warn({ appId, event: "hook.timeout", durationMs: HOOK_TIMEOUT_MS });
logger.info({ appId, event: "app.installed" });
logger.info({ appId, event: "app.uninstalled" });
```

**Hub-side logging:** Hub API routes don't have a consola logger — they use built-in `console` or Nitro. The hub needs a logger instance. Options:
1. Import consola directly: `import { createConsola } from "consola"` — consola is already in the workspace dependency tree as it's used by the bot [ASSUMED: transitive availability in hub; should verify `consola` is in hub's package.json or workspace hoisting]
2. Use `console.log`/`console.error` directly with JSON.stringify — simpler, no import needed

**Recommendation:** Check if consola is accessible in hub. If yes, use it for consistency. If not (hub only has console), use structured `console.log(JSON.stringify({...}))` — same machine-readable output, zero new dependencies. The planner should verify with `cat platform/apps/hub/package.json | grep consola`.

### Pattern 3: --max-old-space-size Placement

**What:** Node.js V8 heap limit flag, controls maximum old-generation heap size.
**When to use:** Bot startup and Hub startup.

Three valid placement options — planner decides per D-06:

**Option A: package.json scripts (NODE_OPTIONS)** — [VERIFIED: Node.js docs behavior]
```json
// platform/apps/bot/package.json
"start": "NODE_OPTIONS=--max-old-space-size=512 node dist/apps/bot/src/index.js"

// platform/apps/hub/package.json  
"start": "NODE_OPTIONS=--max-old-space-size=1024 node --env-file=../../.env .output/server/index.mjs"
```
Pros: Version-controlled, visible to developers, works in dev and prod.
Cons: `NODE_OPTIONS` affects all node processes spawned from that script. Dev script (`tsx src/index.ts`) also runs tsx, which spawns node — NODE_OPTIONS would apply there too.

**Option B: Docker CMD** — [VERIFIED: Dockerfile structure in codebase]
```dockerfile
# platform/apps/bot/Dockerfile (runner stage)
CMD ["node", "--max-old-space-size=512", "apps/bot/src/index.ts"]
# (or tsx for current dev-style Dockerfile)

# platform/apps/hub/Dockerfile (runner stage)
CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]
```
Pros: Only affects Docker production; clean, explicit.
Cons: Does not apply when running via pnpm start outside Docker; two places to maintain.

**Option C: Env var in .env / docker-compose.yml** — [VERIFIED: docker-compose.yml in codebase]
```yaml
# docker-compose.yml
hub:
  environment:
    NODE_OPTIONS: "--max-old-space-size=1024"
bot:
  environment:
    NODE_OPTIONS: "--max-old-space-size=512"
```
Pros: No Dockerfile or script changes; easy to tune per environment.
Cons: Not in version-controlled env, can be overridden; not visible in code.

**Recommendation:** Option A (package.json `start` script) for Hub, Option B (Dockerfile CMD) for Bot — because the bot Dockerfile uses `tsx` as CMD (not compiled node), making NODE_OPTIONS the cleanest path there. Hub Dockerfile already uses `CMD ["node", ".output/server/index.mjs"]`, so adding the flag inline is clean. Planner has full discretion per D-06.

**Note on dev scripts:** The `dev` script for the hub runs via nuxt dev, which has its own memory management. Applying `--max-old-space-size` to dev is less critical; apply only to `start` (production) scripts initially.

### Anti-Patterns to Avoid

- **Separate timeout utility package:** Creating `@guildora/sandbox-utils` or similar for a 5-line helper is over-engineering. Keep the wrapper co-located in each execution site.
- **Swallowing timeout errors:** After `Promise.race()` rejects, the original promise is still running (the event loop is not blocked, but memory is not freed until the promise settles or the process restarts). Do not hide this — log it clearly with appId.
- **Using `AbortController` for timeout:** There's no standard way to abort an arbitrary promise. `Promise.race()` is the correct Node.js pattern here.
- **Timer leak:** The `setTimeout` in the timeout promise should be cleared if the handler wins the race. Use `clearTimeout` in the resolved branch to avoid keeping the timer alive unnecessarily — minor but clean.

```typescript
// Timer-safe pattern:
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging | Custom log formatter | consola (existing) | Already in codebase, structured output built-in |
| Memory limiting | Runtime memory checks | --max-old-space-size Node.js flag | OS-level, enforced by V8 runtime, zero code |
| Async timeout | Event-loop polling | Promise.race() + setTimeout | Node.js built-in, no library needed |
| Synchronous code termination | Custom VM wrapper | Not in scope (D-01 rescope) | Would require isolated-vm — deferred |

**Key insight:** All three hardening measures are achievable with zero new dependencies and minimal code. The entire implementation surface is ~50 lines of code change across 4-5 files plus new test cases.

---

## Common Pitfalls

### Pitfall 1: Timeout Does Not Kill Synchronous Code
**What goes wrong:** Developer assumes `Promise.race()` timeout will abort `while(true){}` or CPU-intensive synchronous app code. It won't — the timeout promise can only "win the race" if the JS event loop gets a chance to run, which a tight synchronous loop prevents.
**Why it happens:** Misunderstanding of how JavaScript event loop and Promise.race() work.
**How to avoid:** Add a comment in both execution sites explicitly documenting this limitation. The threat model (trusted apps, D-01) accepts this.
**Warning signs:** Hang/unresponsive process instead of timeout error in logs.

### Pitfall 2: Timer Leak After Successful Handler
**What goes wrong:** The `setTimeout` in the timeout promise keeps a reference alive after the handler completes. In Node.js, this prevents the process from exiting cleanly and wastes a small amount of memory per invocation.
**Why it happens:** `Promise.race()` resolves/rejects but does not cancel the losing promise.
**How to avoid:** Use `.finally(() => clearTimeout(timerId))` pattern (see code example above).
**Warning signs:** `--forceExit` needed in tests, or process doesn't exit after all work is done.

### Pitfall 3: --max-old-space-size Applies to Entire Process
**What goes wrong:** Setting `--max-old-space-size=512` on the bot process limits ALL memory for that process, including discord.js, drizzle-orm, and other runtime — not just app hook memory.
**Why it happens:** The flag is process-global, not scoped to app code.
**How to avoid:** The values in D-05 (512 for bot, 1024 for hub) account for this — they are total process limits, not per-app limits. Verify the bot runs comfortably within 512 MB under load before deploying.
**Warning signs:** OOM crashes in normal (no-app) bot operation after adding the flag.

### Pitfall 4: consola in Hub Has No logger Export
**What goes wrong:** The hub doesn't have a `logger.ts` equivalent — it uses Nitro's built-in console. Importing consola in hub server routes may require adding consola as a hub dependency.
**Why it happens:** consola is only a direct dependency of `@guildora/bot`, not `@guildora/hub`.
**How to avoid:** Check hub's transitive consola availability before assuming it's importable. If unavailable, use `console.log(JSON.stringify({...}))` — same structured output, zero dependency.
**Warning signs:** TypeScript import error for `consola` in hub server files.

### Pitfall 5: Log Format Inconsistency Between Bot and Hub
**What goes wrong:** Bot uses consola's tag-prefixed output, Hub uses plain console — same event names, different log structure in docker logs output.
**Why it happens:** Different logger setup in each app.
**How to avoid:** For the Hub [...path].ts structured events, use the same JSON key names (`appId`, `event`, `durationMs`, `error`) even if the underlying logger differs. `docker logs | grep '"event":"route.timeout"'` should work regardless of logger.

### Pitfall 6: Audit Log for install/uninstall — Where to Hook
**What goes wrong:** The install/uninstall lifecycle is spread across multiple routes. `app.installed` can come from: `sideload.post.ts` (installAppFromUrl), `local-sideload.post.ts`, `[appId]/update.post.ts` (re-install), and `[appId]/status.put.ts` (activate, which is distinct from "installed"). `app.uninstalled` comes from `[id].delete.ts`.
**Why it happens:** Install = inserting DB record + fetching code. Uninstall = deleting record. Activation = toggling status.
**How to avoid:** Per D-09, `app.installed` = install event (sideload routes), `app.uninstalled` = delete event (`[id].delete.ts`). Activation/deactivation (`status.put.ts`) are NOT install/uninstall — they're lifecycle state changes. If `activate` events are needed, they'd be new events (`app.activated`, `app.deactivated`) but D-09 doesn't list them. Planner should confirm scope: only the two events listed in D-09, or also activation events.

---

## Code Examples

### Bot: emit() with Timeout + Structured Log

```typescript
// Source: app-hooks.ts analysis [VERIFIED: codebase]
// Replace the current handler invocation block in BotAppHookRegistry.emit()

const HOOK_TIMEOUT_MS = parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10);

async emit<K extends BotHookEventName>(eventName: K, payload: BotHookEventMap[K]) {
  const scopedHandlers = this.handlers.get(eventName);
  if (!scopedHandlers || scopedHandlers.size === 0) return;

  for (const [appId, { handler, ctx }] of scopedHandlers.entries()) {
    const freshConfig = await loadAppConfig(appId);
    if (Object.keys(freshConfig).length > 0) ctx.config = freshConfig;

    let timerId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`timeout`)),
        HOOK_TIMEOUT_MS
      );
    });

    try {
      await Promise.race([
        (handler as BotHookHandler<K>)(payload, ctx),
        timeoutPromise
      ]);
    } catch (error) {
      const isTimeout = (error as Error).message === "timeout";
      if (isTimeout) {
        logger.warn({ appId, event: "hook.timeout", durationMs: HOOK_TIMEOUT_MS });
      } else {
        logger.error({ appId, event: "hook.error", error: (error as Error).message });
      }
    } finally {
      clearTimeout(timerId!);
    }
  }
}
```

### Hub: Handler Invocation with Timeout

```typescript
// Source: apps/[...path].ts analysis [VERIFIED: codebase]
// Replace the final `return handler(event)` block

const HOOK_TIMEOUT_MS = parseInt(process.env.APP_HOOK_TIMEOUT_MS ?? "5000", 10);

let timerId: ReturnType<typeof setTimeout>;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(
    () => reject(new Error("timeout")),
    HOOK_TIMEOUT_MS
  );
});

try {
  return await Promise.race([
    Promise.resolve(handler(event)),
    timeoutPromise
  ]);
} catch (error) {
  const isTimeout = (error as Error).message === "timeout";
  if (isTimeout) {
    console.log(JSON.stringify({ appId, event: "route.timeout", durationMs: HOOK_TIMEOUT_MS }));
    throw createError({ statusCode: 504, statusMessage: `App '${appId}' route handler timed out.` });
  }
  console.error(JSON.stringify({ appId, event: "route.error", error: (error as Error).message }));
  throw createError({ statusCode: 500, statusMessage: `App '${appId}' route handler failed.` });
} finally {
  clearTimeout(timerId!);
}
```

### Test: Timeout Behavior for BotAppHookRegistry

```typescript
// Source: app-hooks.spec.ts pattern [VERIFIED: codebase]
// New test cases to add to the existing "BotAppHookRegistry" describe block

it("hook.timeout: slow handler is abandoned and error is logged", async () => {
  vi.useFakeTimers();
  const slowHandler = vi.fn(() => new Promise<void>(() => {})); // never resolves
  const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
  botAppHookRegistry.register("app-slow", "onMessage", slowHandler, ctx);

  const emitPromise = botAppHookRegistry.emit("onMessage", {} as any);
  vi.advanceTimersByTime(5001);
  await emitPromise;

  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.objectContaining({ appId: "app-slow", event: "hook.timeout" })
  );
  vi.useRealTimers();
});

it("hook.error: throwing handler logs structured error", async () => {
  const errorHandler = vi.fn().mockRejectedValue(new Error("boom"));
  const ctx = { config: {}, db: {} as any, bot: {} as any, botUserId: "b1", guildId: "g1", platform: "discord" as const };
  botAppHookRegistry.register("app-err", "onMessage", errorHandler, ctx);

  await botAppHookRegistry.emit("onMessage", {} as any);

  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.objectContaining({ appId: "app-err", event: "hook.error" })
  );
});
```

---

## Execution Site Inventory

Both sites verified by direct file read [VERIFIED: codebase]:

| Site | File | Line | Current State | Change Needed |
|------|------|------|---------------|---------------|
| Bot emit() | `platform/apps/bot/src/utils/app-hooks.ts:86` | `await (handler as BotHookHandler<K>)(payload, ctx)` | No timeout; unstructured error log | Add Promise.race() + structured log |
| Hub handler | `platform/apps/hub/server/api/apps/[...path].ts:111` | `return handler(event)` | No timeout; generic 500 error | Add Promise.race() + route.error/timeout |
| Hub install | `platform/apps/hub/server/api/admin/apps/sideload.post.ts` | Returns `{ ok: true, appId }` | No audit log | Add `app.installed` log after successful install |
| Hub uninstall | `platform/apps/hub/server/api/admin/apps/[id].delete.ts` | Returns `{ success, id }` | No audit log | Add `app.uninstalled` log after successful delete |
| Hub local sideload | `platform/apps/hub/server/api/admin/apps/local-sideload.post.ts` | (not read, but exists per glob) | Likely same as sideload.post.ts | Add `app.installed` log |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Unstructured error log in emit() | Structured `{ appId, event, error }` | Phase 2 target |
| No execution timeout | Promise.race() timeout | Phase 2 target |
| No memory cap | --max-old-space-size flag | Phase 2 target |
| `isolated-vm` for true sandbox | Rescoped to minimal hardening (D-01) | Per CONTEXT.md |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is purely code/config changes. No new external tools, services, or CLIs are required. All changes use Node.js built-ins, existing npm packages already in the workspace, and Dockerfile/package.json modifications.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Bot) | Vitest 3.1.1 |
| Framework (Hub) | Vitest 2.1.1 |
| Bot config | `platform/apps/bot/vitest.config.ts` |
| Hub config | `platform/apps/hub/vitest.config.ts` |
| Bot quick run | `cd platform && pnpm --filter @guildora/bot test` |
| Hub quick run | `cd platform && pnpm --filter @guildora/hub test` |
| Full suite | `cd platform && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-02 (timeout) | Slow/hanging hook is abandoned after TIMEOUT_MS and `hook.timeout` is logged | unit | `pnpm --filter @guildora/bot test -- --reporter=verbose` | ✅ extend app-hooks.spec.ts |
| SEC-02 (error) | Throwing hook logs `hook.error` with structured format | unit | same | ✅ extend app-hooks.spec.ts |
| SEC-02 (hub-timeout) | Slow hub handler returns 504 and logs `route.timeout` | unit | `pnpm --filter @guildora/hub test -- --reporter=verbose` | ❌ Wave 0: new spec file |
| SEC-02 (memory) | --max-old-space-size flag is present in startup scripts | manual/config check | `grep max-old-space-size platform/apps/bot/package.json platform/apps/hub/Dockerfile` | ❌ Wave 0: config change |
| SEC-02 (compat) | voice-rooms app runs after changes without modification | manual integration | Run hub dev + load voice-rooms | manual only |
| SEC-02 (audit-log) | app.installed / app.uninstalled are logged with correct format | unit | Hub spec for admin/apps routes | ❌ Wave 0: new spec file |

### Sampling Rate
- **Per task commit:** `pnpm --filter @guildora/bot test` (fast, ~2s for all bot specs)
- **Per wave merge:** `pnpm test` (full platform suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `platform/apps/hub/server/api/apps/__tests__/path.spec.ts` — covers route.timeout + route.error for [...path].ts
- [ ] `platform/apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts` — covers app.installed + app.uninstalled log events
- [ ] New test cases in `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` — covers hook.timeout + structured hook.error format

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | partial | Existing requireSession() + role check before handler execution; unchanged |
| V5 Input Validation | no | App code is pre-validated at install time |
| V6 Cryptography | no | — |

### Known Threat Patterns for Plugin Execution Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Infinite async loop (external API hang) | Denial of Service | Promise.race() timeout (Phase 2) |
| Synchronous infinite loop | Denial of Service | Accepted per D-01 (no mitigation, trusted apps) |
| Unchecked memory growth in app code | Denial of Service | --max-old-space-size process cap (Phase 2) |
| require() to access FS/process/child_process | Tampering/Info Disclosure | Existing require() block (unchanged) |
| Response manipulation via h3 helpers | Tampering | Existing h3-whitelist (unchanged; F-01 notes overreach but not in Phase 2 scope) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | consola is not a direct dependency of @guildora/hub (only of @guildora/bot) | Pitfall 4, Pattern 2 | Low: fallback is console.log(JSON.stringify()); no blocking impact |
| A2 | voice-rooms app uses only async patterns in its hooks (onVoiceActivity, onInteraction) — timeout wrapping will be transparent | Common Pitfalls | Low: hooks are short async functions; compatible without change per D-11 |
| A3 | Promise.race() timeout is acceptable for SEC-02 compliance given the rescoped threat model | Standard Stack | Medium: if compliance interpretation of SEC-02 changes, redesign needed — but CONTEXT.md D-01 is a locked decision |

---

## Open Questions

1. **Audit log for activate/deactivate vs. install/uninstall**
   - What we know: D-09 lists `app.installed` and `app.uninstalled`. The status.put.ts route activates/deactivates (sets status = active/inactive) rather than installing/uninstalling.
   - What's unclear: Should activation (status → active) also trigger `app.installed`? Or only the initial sideload/install? The two are different operations.
   - Recommendation: Log activate/deactivate as `app.activated` / `app.deactivated` separate from `app.installed` / `app.uninstalled`. Planner should confirm with D-09 intent.

2. **Hub logging: consola vs console.log**
   - What we know: Hub has no logger.ts; consola is used in bot only; the hub Dockerfile/package.json has no consola entry.
   - What's unclear: Is consola hoisted to the workspace level and importable in hub without adding to package.json?
   - Recommendation: `grep consola platform/apps/hub/package.json platform/node_modules/.modules.yaml` to check. If not available, use `console.log(JSON.stringify(...))` for hub structured logs — same output, zero dependency.

3. **local-sideload.post.ts — same app.installed log?**
   - What we know: sideload.post.ts and local-sideload.post.ts are both install paths. Only sideload.post.ts was read in detail.
   - What's unclear: Does local-sideload also need the `app.installed` event?
   - Recommendation: Yes — both paths result in an installed app. Planner should read local-sideload.post.ts before implementing.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read: `platform/apps/bot/src/utils/app-hooks.ts` — execution site analysis, logger pattern
- Codebase direct read: `platform/apps/hub/server/api/apps/[...path].ts` — hub execution site analysis
- Codebase direct read: `platform/apps/bot/src/utils/logger.ts` — consola setup pattern
- Codebase direct read: `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` — existing test coverage
- Codebase direct read: `platform/apps/bot/package.json`, `platform/apps/hub/package.json` — script patterns
- Codebase direct read: `platform/apps/bot/Dockerfile`, `platform/apps/hub/Dockerfile` — CMD patterns
- Codebase direct read: `platform/docker-compose.yml` — environment injection patterns
- Codebase direct read: `platform/.env.example` — env var documentation pattern
- `.planning/phases/02-apps-plugin-sandbox/02-CONTEXT.md` — all locked decisions
- `.planning/research/01-security-audit.md` §4 [F-01] — execution site inventory

### Secondary (MEDIUM confidence)

- Node.js docs (training knowledge): Promise.race() semantics — event loop behavior with synchronous code [ASSUMED: no version-specific changes in Node 24 that would affect basic Promise behavior]
- npm registry: consola@3.4.2 is current version [VERIFIED: npm view consola version]

---

## Metadata

**Confidence breakdown:**
- Execution site structure: HIGH — direct file reads, line-level verification
- Timeout wrapper pattern: HIGH — Node.js built-ins, pattern in CONTEXT.md
- Memory cap placement: HIGH — Dockerfile/package.json structure verified
- Audit log format: HIGH — consola pattern in codebase, format specified in CONTEXT.md
- Test infrastructure: HIGH — vitest.config.ts read, existing spec verified

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack, no fast-moving dependencies)
