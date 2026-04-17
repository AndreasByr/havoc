# Grep Scan Results — Phase 1 Security Audit (Wave 2)

**Scan-Datum:** 2026-04-17
**Commit-SHA beim Scan:** `bd5e7b79f1af965388471e61fd6c41e5b20d1650`
**Scope:** platform/apps/ + platform/packages/ (+ docker-compose*.yml + .env.example für P-3)
**Methode:** Roh-Output aus 5 ripgrep-Commands aus 01-RESEARCH.md §Grep Pattern Catalog.
**Zweck:** Input für Wave 4 (Finding-Consolidation). **Nicht bewerten** — nur sammeln.

---

## Pattern 1 — Token Comparisons (unsichere Gleichheit)

**Command:**
```bash
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/__tests__/**' -g '!**/*.spec.ts' '(token|secret|password|apiKey|signature|hash)\w*\s*(===|!==)\s*\w' apps/ packages/
```

**Raw output:**
```
apps/hub/server/utils/internal-auth.ts:16:  if (!token || token !== expectedToken) {
```

**Cross-check — timingSafeEqual sites:**
```bash
rg -n --type ts --type js 'timingSafeEqual' apps/ packages/
```
```
packages/shared/src/utils/application-tokens.ts:30:  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
apps/bot/src/utils/internal-sync-server.ts:70:function timingSafeEqualString(left: string, right: string) {
apps/bot/src/utils/internal-sync-server.ts:73:  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
apps/bot/src/utils/internal-sync-server.ts:86:  return timingSafeEqualString(incomingToken, configuredToken);
apps/hub/server/utils/csrf.ts:1:import { randomBytes, timingSafeEqual } from "node:crypto";
apps/hub/server/utils/csrf.ts:22:    !timingSafeEqual(sessionBuf, headerBuf)
apps/hub/server/api/auth/discord.get.ts:82:function timingSafeEqualString(input: string, expected: string) {
apps/hub/server/api/auth/discord.get.ts:88:  return crypto.timingSafeEqual(paddedInput, paddedExpected);
apps/hub/server/api/auth/discord.get.ts:199:  if (!statePayload || !storedStateNonce || !timingSafeEqualString(statePayload.nonce, storedStateNonce)) {
```

**Known-positive presence check (from 01-RESEARCH.md CF-02):**
- [x] `platform/apps/hub/server/utils/internal-auth.ts:16` appears in P-1 output → CONFIRMED (token !== expectedToken — timing-unsafe direct comparison)
- [x] `platform/apps/bot/src/utils/internal-sync-server.ts` appears in timingSafeEqual output → CONFIRMED (bot uses correct crypto.timingSafeEqual API)

**Observation:** Hub `internal-auth.ts:16` uses `!==` for token comparison (timing-attackable). Bot-side uses correct `timingSafeEqual`. Hub CSRF (`csrf.ts`) and Discord OAuth (`discord.get.ts`) also use `timingSafeEqual` correctly. Also: `packages/shared/src/utils/application-tokens.ts:30` uses `timingSafeEqual` correctly. Delta: only `internal-auth.ts` is the outlier.

---

## Pattern 2 — Code Execution (Runtime-Evaluation von externen Strings)

**Command:**
```bash
rg -n --type ts --type js -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/__tests__/**' -g '!**/*.spec.ts' 'new Function\(|[^a-zA-Z_.]eval\(|vm\.(createContext|runInContext|runInNewContext|runInThisContext|Script)' apps/ packages/
```

**Raw output:**
```
apps/bot/src/utils/app-hooks.ts:128:      new Function("module", "exports", "require", code)(
apps/hub/server/api/apps/[...path].ts:86:    new Function("module", "exports", "require", ...h3Names, handlerCode)(mod, mod.exports, restrictedRequire, ...h3Values);
```

**Known-positive presence check (from 01-RESEARCH.md CF-01):**
- [x] `platform/apps/bot/src/utils/app-hooks.ts:128` appears in output → CONFIRMED (new Function() Site 1: Bot app-hook executor)
- [x] `platform/apps/hub/server/api/apps/[...path].ts:86` appears in output → CONFIRMED (new Function() Site 2: Hub app route handler)

**Observation:** Exactly 2 hits, both the known sites (CF-01). No `eval()` or `vm.*` usage in scope. No unknown third site.

---

## Pattern 3 — Hardcoded Secrets

**Command:**
```bash
rg -n -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/.output/**' -g '!**/pnpm-lock.yaml' -g '!**/package-lock.json' -g '!**/playwright-report/**' '(password|secret|token|api[_-]?key|postgres:postgres)\s*[:=]\s*["'"'"'][^$\{\}][^"'"'"']{3,}' apps/ packages/ docker-compose.yml docker-compose.override.yml .env.example 2>/dev/null
```

**Raw output (playwright-report excluded — large minified HTML, not codebase):**
```
apps/hub/app/pages/apply/[flowId]/[token].vue:134:          :token="token"
apps/hub/app/components/applications/form/ApplicationForm.vue:107:          :token="token"
apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts:74:    const res = await fetch("/internal/health", { token: "" });
apps/matrix-bot/src/__tests__/internal-sync-server.spec.ts:79:    const res = await fetch("/internal/health", { token: "wrong" });
```

**Note:** The Vue hits are template prop-bindings (`:token="token"` = dynamic prop binding on a variable named `token`). The regex matches `:token="token"` as `token = "token"`. This is a false positive of the pattern (Vue attribute-binding syntax). The test hits use empty/wrong tokens for test stubs — also false positives.

**postgres:postgres in connection strings (supplementary):**
```bash
rg -n 'postgres:postgres@' apps/ packages/ docker-compose.yml 2>/dev/null
```
```
docker-compose.yml:60:      DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
docker-compose.yml:69:      NUXT_DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
docker-compose.yml:114:      DATABASE_URL: postgresql://postgres:postgres@db:5432/guildora
```

**POSTGRES_PASSWORD in docker-compose.yml (supplementary):**
```bash
rg -n 'POSTGRES_PASSWORD' docker-compose.yml
```
```
docker-compose.yml:8:      POSTGRES_PASSWORD: postgres
```

**DATABASE_URL in .env.example (supplementary):**
```bash
rg -n 'DATABASE_URL' .env.example
```
```
.env.example:29:# Production (docker compose up): DATABASE_URL is set per service in
.env.example:32:DATABASE_URL=postgresql://postgres:postgres@localhost:5433/guildora
```

**Known-positive presence check (from 01-RESEARCH.md CF-03, CF-08):**
- [x] `platform/docker-compose.yml:8` (`POSTGRES_PASSWORD: postgres`) appears → CONFIRMED
- [x] `platform/docker-compose.yml:60, 69, 114` (`postgres:postgres@db:...`) appears → CONFIRMED (all 3 lines visible)
- [x] `platform/.env.example:32` (`DATABASE_URL=postgresql://postgres:postgres@...`) appears → CONFIRMED (Wave 4 decides: finding vs documented-dev-default)

**Observation:** Main regex hits are exclusively false positives (Vue template bindings, test stubs). Relevant hardcoded credentials are visible in supplementary `postgres:postgres` scans (docker-compose.yml and .env.example). Wave 4 note: P-3 main regex produces only false positives; use supplementary scans for actual findings.

---

## Pattern 4 — API-Routen ohne Auth-Marker (Heuristik)

**Command:**
```bash
find apps/hub/server/api -type f -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' | while read -r f; do
  if ! rg -q 'requireSession|requireAdminSession|requireModeratorSession|requireSuperadminSession|requireRole|requireModeratorRight|requireInternalToken' "$f"; then
    echo "UNGUARDED-CANDIDATE: $f"
  fi
done
```

**Scan method note:** Pattern uses pipe-separated alternatives (not grouped parentheses) to avoid bash regex interpretation issues. Results cross-verified via `comm -23` diff of all-api-files vs guarded-api-files lists.

**Raw output:**
```
UNGUARDED-CANDIDATE: apps/hub/server/api/apply/[flowId]/upload.post.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/apply/[flowId]/validate-token.post.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/auth/dev-login.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/auth/discord.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/auth/logout.post.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/auth/matrix.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/auth/platforms.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/csrf-token.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/internal/locale-context.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/public/branding.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/public/footer-pages.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/public/landing.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/setup/platform.post.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/setup/status.get.ts
UNGUARDED-CANDIDATE: apps/hub/server/api/theme.get.ts
```

**Total count:** 15 candidates (from 162 total API route files)

**Expected-public routes (per ROADMAP §Phase 3 SC3 + 01-RESEARCH.md §Pattern 4):**
- `apps/hub/server/api/public/*` — public/branding.get.ts, public/footer-pages.get.ts, public/landing.get.ts (3 expected)
- `apps/hub/server/api/auth/*` — auth/dev-login.get.ts, auth/discord.get.ts, auth/logout.post.ts, auth/matrix.get.ts, auth/platforms.get.ts (5 expected)
- `apps/hub/server/api/theme.get.ts` (1 expected)
- `apps/hub/server/api/setup/*` — setup/platform.post.ts, setup/status.get.ts (2 expected)
- `apps/hub/server/api/csrf-token.get.ts` (1 expected)
- `apps/hub/server/api/apply/[flowId]/*` (token-based, nicht session-based) — apply/[flowId]/upload.post.ts, apply/[flowId]/validate-token.post.ts (2 expected)

**Delta-Analyse:**
- 15 UNGUARDED-CANDIDATES − 14 expected-public = **1 Delta-Kandidat**
- Delta: `apps/hub/server/api/internal/locale-context.get.ts` — NOT in expected-public list
- This candidate feeds into Wave 4 CF-04 ("Session-Middleware nicht deny-by-default") — not a separate finding

**Action for Wave 4:** `internal/locale-context.get.ts` must be checked per Read-Tool to verify if InternalToken-Auth is implemented via header check instead of `requireInternalToken()` (alternative auth pattern that escapes the heuristic). File content shows it reads `event.context.userSession` directly with graceful null fallback — no explicit auth guard.

---

## Pattern 5 — Unsafe HTML Rendering

**v-html command:**
```bash
rg -n 'v-html' apps/ packages/ -g '*.vue' -g '!**/node_modules/**' -g '!**/.nuxt/**'
```

**Raw output:**
```
apps/web/app/pages/index.vue:121:    <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
apps/web/app/pages/[slug].vue:25:      v-html="sanitizeHtml(page!.content)"
```

**Note on index.vue:121:** The hit is a comment (`<!-- ... -->`) containing the word `v-html` in an ESLint disable comment. Line 122 uses `v-text="activeCustomCss"` (XSS-safe), NOT `v-html`. No actual `v-html` usage in index.vue. Real `v-html` hits: 1 (only `[slug].vue:25`).

**innerHTML command:**
```bash
rg -n 'innerHTML\s*=' apps/ packages/ -g '!**/node_modules/**' -g '!**/.nuxt/**' -g '!**/playwright-report/**'
```

**Raw output:**
```
packages/motion/src/composables/useGsapTextReveal.ts:13:  element.innerHTML = words
packages/motion/src/composables/useGsapTextReveal.ts:36:  element.innerHTML = ''
packages/motion/src/composables/useGsapTextReveal.ts:63:  element.innerHTML = ''
```

**Already-verified safe (from 01-RESEARCH.md §P-5 Stichproben):**
- `apps/web/app/pages/[slug].vue:25` — `v-html="sanitizeHtml(...)"` → safe (DOMPurify wrapper)
- `packages/motion/src/composables/useGsapTextReveal.ts:13,36,63` — innerHTML with own state (GSAP text split animation), not user-controlled → safe

**Action for Wave 4:** Output contains ONLY already-known safe sites. No new unknown `v-html` or `innerHTML` sites found. P-5 produces no Critical/High/Medium finding; at most a Low "document central sanitize usage".

---

## Summary for Wave 4

| Pattern | Hits | Known-Positives Confirmed | Delta / Notes |
|---------|------|--------------------------|---------------|
| P-1 Token Comparisons | 1 (`internal-auth.ts:16`) | CF-02: YES | timingSafeEqual cross-check shows 5 additional CORRECT usages (bot, csrf, discord-oauth, application-tokens) |
| P-2 Code Execution | 2 (`app-hooks.ts:128`, `[...path].ts:86`) | CF-01: YES (both sites) | No additional new Function/eval/vm sites anywhere in scope |
| P-3 Hardcoded Secrets | 0 real hits in app code (4 FP); docker-compose.yml: 4 lines; .env.example: 1 line | CF-03+CF-08: YES | Vue template `:token="token"` and test stubs are false positives |
| P-4 Unguarded API Routes | 15 candidates; 1 delta (not in expected-public list) | N/A — heuristic | Delta: `internal/locale-context.get.ts` feeds into CF-04 |
| P-5 Unsafe HTML | 2 v-html hits (1 FP comment, 1 safe DOMPurify); 3 innerHTML hits (all GSAP own-state, safe) | P-5 stichprobe: YES | No new unsafe sites — no Critical/High finding expected |

**All 3 Known-Positive Anchors: CONFIRMED**
- CF-01 (`app-hooks.ts:128` + `[...path].ts:86`): present in P-2 output
- CF-02 (`internal-auth.ts:16`): present in P-1 output
- CF-03/CF-08 (`docker-compose.yml` postgres:postgres + POSTGRES_PASSWORD): present in P-3 supplementary output

**Next step:** Wave 4 (Plan 04) reads this file + kopf-review.md + CONCERNS.md and consolidates everything into Finding-Blocks in `.planning/research/01-security-audit.md`.
