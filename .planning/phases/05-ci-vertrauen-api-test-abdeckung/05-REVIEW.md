---
phase: 05-ci-vertrauen-api-test-abdeckung
reviewed: 2026-04-18T12:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - apps/matrix-bot/src/index.ts
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - apps/hub/eslint.config.mjs
  - apps/hub/package.json
  - apps/hub/vitest.config.ts
  - apps/hub/server/api/__tests__/auth-routes.spec.ts
  - apps/hub/server/api/__tests__/mod-routes.spec.ts
  - apps/hub/server/api/__tests__/admin-settings.spec.ts
  - apps/hub/server/api/__tests__/community-settings.spec.ts
  - apps/hub/app/components/applications/flow-builder/SimpleFormField.vue
  - apps/hub/app/pages/landing/editor.vue
  - apps/hub/app/pages/landing/footer.vue
  - apps/hub/app/pages/landing/settings.vue
  - apps/hub/server/utils/application-archive.ts
  - apps/hub/server/utils/application-flows.ts
  - apps/hub/server/utils/membership-sync.ts
  - apps/hub/server/utils/platformConfig.ts
  - apps/hub/server/api/apps/[...path].ts
  - apps/hub/server/api/apply/[flowId]/submit.post.ts
  - apps/hub/server/api/applications/flows/index.post.ts
  - apps/hub/server/api/settings/files/migrate.post.ts
  - apps/hub/server/api/members/index.get.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-18T12:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 5 added security-oriented ESLint plugins, made the lint gate blocking in CI, added four new test spec files covering auth, mod, admin-settings, and community-settings routes, and fixed several Vue reactivity patterns in landing page components. The overall direction is solid: the security plugin integration is correct, the test structure is consistent and the guard pattern coverage is meaningful.

Two critical issues were found: the ESLint security plugin integration generates false-positives for the `new Function()` code path in `[...path].ts` (the plugin flags it but the existing security comment may suppress linting — the reviewed version is fine), and more pressingly, `platformConfig.ts` calls `useRuntimeConfig()` (a Nuxt auto-import) from a plain `.ts` utility module that is also exercised in sync-startup paths where no Nuxt request context exists. Additionally, the `timerId` variable in `[...path].ts` is used with a non-null assertion in the `finally` block despite being potentially unassigned if `Promise.race` throws before `setTimeout` fires.

Six warnings cover: the CI workflow missing a test gate on the main `ci` job (tests only run on `release.yml`); the `no-unsanitized` plugin's `recommended` config flagging `v-html` usage in `LandingPreview` components it cannot see in this config scope; the footer page content textarea accepting raw HTML without DOMPurify sanitization at the input stage; the `_mockModRightOk` helper in `mod-routes.spec.ts` being declared but never called; `application-archive.ts` silently suppressing individual file deletion errors inside `Promise.all`; and `submit.post.ts` leaking the internal `application.id` in a structured error response before the application row is finalized.

---

## Critical Issues

### CR-01: `useRuntimeConfig()` called outside Nuxt request context in `platformConfig.ts`

**File:** `apps/hub/server/utils/platformConfig.ts:102`

**Issue:** `getDiscordEnvFallback()` calls `useRuntimeConfig()` (a Nuxt h3/Nitro auto-import) without an `event` argument. This auto-import is safe only inside a `defineEventHandler` — calling it from a plain utility function that may be invoked during module initialization or from the `runAutoSyncCycle` scheduler path will throw `"useRuntimeConfig is not defined"` at runtime in production builds, or silently return an empty object in some Nuxt versions depending on the Nitro async-storage context. The function is reachable from `getPlatformConnection("discord")` → `getDiscordEnvFallback()`, which is called from `loadConnections()` in module scope logic.

**Fix:** Pass the `event` (H3Event) down from the caller, or read the values directly from `process.env` / a module-level runtimeConfig snapshot that is eagerly loaded once at startup:

```typescript
// Option A — pass event from caller
export async function getPlatformConnection(
  platform: PlatformType,
  event?: Parameters<typeof useRuntimeConfig>[0]
): Promise<PlatformConnectionRow | null> {
  ...
  if (platform === "discord") {
    return getDiscordEnvFallback(event);
  }
}

function getDiscordEnvFallback(
  event?: Parameters<typeof useRuntimeConfig>[0]
): PlatformConnectionRow | null {
  const runtime = useRuntimeConfig(event);
  ...
}
```

```typescript
// Option B — read from process.env only (no Nuxt dependency)
function getDiscordEnvFallback(): PlatformConnectionRow | null {
  const clientId = process.env.NUXT_OAUTH_DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.NUXT_OAUTH_DISCORD_CLIENT_SECRET ?? "";
  ...
}
```

---

### CR-02: `timerId` used with non-null assertion in `finally` block after potentially uninitialized assignment in `[...path].ts`

**File:** `apps/hub/server/api/apps/[...path].ts:116-138`

**Issue:** `timerId` is declared with `let timerId: ReturnType<typeof setTimeout>` (no initializer) and assigned inside the `new Promise` callback. TypeScript and Node.js execute the `Promise` constructor synchronously, so `timerId` will always be assigned before `await Promise.race(...)` suspends — but this only holds because the `setTimeout` callback is passed synchronously. The `clearTimeout(timerId!)` on line 138 uses a non-null assertion that TypeScript strict mode would normally reject. If any future refactor wraps the timeout promise creation in an async helper, this becomes a real uninitialized-variable crash. This is a latent correctness bug.

**Fix:** Declare with a defined initial value:

```typescript
let timerId: ReturnType<typeof setTimeout> | undefined = undefined;
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(() => reject(new Error("timeout")), HOOK_TIMEOUT_MS);
});
...
} finally {
  clearTimeout(timerId); // No ! needed; clearTimeout(undefined) is safe
}
```

---

## Warnings

### WR-01: CI workflow missing a test step in the main `ci` job

**File:** `.github/workflows/ci.yml:20-23`

**Issue:** The `ci` job runs `pnpm lint`, `pnpm typecheck`, and `pnpm build` — but no `pnpm test`. Unit tests are only executed in `release.yml`. Regressions in API handler logic will be caught only at release time, not on every PR push. This defeats the purpose of adding the test suite in Phase 5.

**Fix:** Add a test step to the `ci` job:

```yaml
- run: pnpm install --frozen-lockfile
- name: Lint
  run: pnpm lint
- run: pnpm typecheck
- run: pnpm --filter @guildora/hub test
- run: pnpm build
```

Running tests before `build` is preferred so a slow build doesn't hide test failures.

---

### WR-02: `eslint-plugin-no-unsanitized` may flag `v-html` in Vue SFCs it cannot parse with current config

**File:** `apps/hub/eslint.config.mjs:1-9`

**Issue:** `nounsanitized.configs.recommended` is added globally. The `no-unsanitized/method` and `no-unsanitized/property` rules target `innerHTML` and `outerHTML` DOM property assignments. In `.vue` SFCs, `v-html` directives are compiled to `elm.innerHTML = ...` — but ESLint flat config must parse `.vue` files through `vue-eslint-parser` for the no-unsanitized plugin to see these assignments at the AST level. If the plugin rules run only on raw text (non-Vue-parsed) patterns, they will silently miss real `v-html` uses in components. The plugin is listed after `withNuxt(...)` so it depends on whether `@nuxt/eslint`'s base config already enables `vue-eslint-parser` for `.vue` files.

**Fix:** Verify `v-html` is actually caught by running `pnpm lint` against a component that uses `v-html` without DOMPurify. If not caught, restrict the no-unsanitized plugin to JS/TS files and use `vue/no-v-html` rule (already available via `@nuxt/eslint`) for `.vue` files:

```js
export default withNuxt(
  pluginSecurity.configs.recommended,
  // Restrict no-unsanitized to non-vue files
  {
    files: ["**/*.{js,ts,mjs,cjs}"],
    ...nounsanitized.configs.recommended,
  },
  // Vue files: use the built-in vue/no-v-html rule instead
  {
    files: ["**/*.vue"],
    rules: { "vue/no-v-html": "warn" }
  }
);
```

---

### WR-03: Footer page content textarea accepts and stores raw HTML without client-side sanitization

**File:** `apps/hub/app/pages/landing/footer.vue:314-318`

**Issue:** The content editing UI presents a raw `<UiTextarea>` for HTML page content (the `TEMPLATE_DISCLAIMER_*` strings are pre-populated HTML). Admins type or paste arbitrary HTML which is sent to the API and stored in the database, then later rendered on the public landing page. While stored-XSS is mitigated by DOMPurify at render time (assuming `LandingPreview` and the public web app apply it), the hub admin UI provides no feedback that the HTML will be sanitized on output, and there is no client-side validation of the content. If any render path ever omits DOMPurify, this becomes an XSS vector. The risk is currently contained to admin-only users, but stored HTML from this textarea deserves explicit sanitization before storage.

**Fix:** Run DOMPurify on the textarea value before the `savePage` POST, or add a server-side sanitization step in the footer-pages PUT handler. Alternatively, document clearly in the UI that the HTML is sanitized on output.

```typescript
// In setContent() or savePage():
import DOMPurify from "isomorphic-dompurify";
function setContent(val: string) {
  if (!editingPage.value) return;
  editingPage.value.content = {
    ...editingPage.value.content,
    [editLocale.value]: DOMPurify.sanitize(val)
  };
}
```

---

### WR-04: `_mockModRightOk` helper is declared but never called in `mod-routes.spec.ts`

**File:** `apps/hub/server/api/__tests__/mod-routes.spec.ts:163-168`

**Issue:** The function `_mockModRightOk` (prefixed with `_` to suppress unused warnings) is defined but not used in any test. This indicates planned tests for `GET /api/mod/tags` and `POST /api/mod/tags` happy-paths were not written. The auth-rejection tests are present (lines 327–364) but no happy-path coverage exists for those two routes. This is a test coverage gap for moderator-right-gated endpoints.

**Fix:** Either remove `_mockModRightOk` if the happy-path tests are intentionally deferred, or add happy-path tests for `GET /api/mod/tags` and `POST /api/mod/tags` similar to the pattern used for `GET /api/mod/users`.

---

### WR-05: File deletion errors silently swallowed in `application-archive.ts`

**File:** `apps/hub/server/utils/application-archive.ts:52-54`

**Issue:** Individual file deletions are swallowed with `.catch(() => {})` inside `Promise.all`. If a file cannot be deleted (e.g., wrong path, permissions issue), the archive cleanup proceeds and the DB records are deleted, leaving orphaned files on disk with no indication of the failure. The outer function returns `{ deletedApplications, deletedTokens }` with no error count for files.

**Fix:** Collect file deletion errors and include them in the return value, or at minimum log them:

```typescript
const fileResults = await Promise.allSettled(
  uploads.map((u) => rm(u.storagePath, { force: true }))
);
const failedFiles = fileResults.filter((r) => r.status === "rejected").length;
if (failedFiles > 0) {
  console.warn(`[application-archive] ${failedFiles} file(s) could not be deleted.`);
}
```

---

### WR-06: `submit.post.ts` exposes internal `application.id` in a partially-formed error path

**File:** `apps/hub/server/api/apply/[flowId]/submit.post.ts:162-177`

**Issue:** After the application row is inserted in the transaction (line 131–160), `application.id` is referenced in subsequent `postInsertOps` and `db.update` calls. If `markTokenUsed` or the file-upload link step throws (lines 162–177), the application row exists in the database with incomplete state (no `rolesAssigned` update has run yet), but the caller receives an uncaught error with no cleanup. The `applicationId` is then never returned to the client. This is not a security leak per se, but it creates ghost applications (status `pending`, `rolesAssigned: []`, no token marked used) that will not be cleaned up by the archive job since they are `pending` rather than approved/rejected.

**Fix:** Wrap the post-insert operations in the same transaction, or add cleanup on failure:

```typescript
try {
  await Promise.all(postInsertOps);
} catch (err) {
  // Application was inserted but post-insert ops failed — log and rethrow
  console.error("[submit] Post-insert ops failed for application", application.id, err);
  // Optionally: delete the application row to prevent ghost entries
  await db.delete(applications).where(eq(applications.id, application.id));
  throw createError({ statusCode: 500, statusMessage: "Submission failed. Please try again." });
}
```

---

## Info

### IN-01: `matrix-bot/src/index.ts` non-null assertions are safe but fragile

**File:** `apps/matrix-bot/src/index.ts:30,44`

**Issue:** `HOMESERVER_URL!` and `ACCESS_TOKEN!` use non-null assertions on lines 30 and 44 (`BOT_INTERNAL_TOKEN!`). The guard at lines 16–26 ensures these are set before `main()` executes, so the assertions are technically safe. However, `process.exit(1)` is called in the guard and TypeScript's control-flow analysis does not understand `process.exit` as a never-returning call when the variables are declared as `string | undefined`. This is a known TypeScript limitation. No action required, but a future improvement would be to type the validated values explicitly:

```typescript
const HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL as string; // after guard
```

---

### IN-02: `vitest.config.ts` h3 resolution uses `readdirSync` at config-load time

**File:** `apps/hub/vitest.config.ts:7-12`

**Issue:** `resolveH3()` calls `readdirSync` on the pnpm `.pnpm` directory every time vitest loads its config. If the `.pnpm` directory does not contain any `h3@1*` directory (e.g., after a lockfile change or on a clean CI cache), `h3Dir` is `undefined` and the function falls back to `"h3"` (the bare package name). In that case, if `h3` is not hoisted to `node_modules/h3`, imports will fail silently with a misleading "module not found" error rather than a clear config error. This makes CI failures harder to diagnose.

**Fix:** Add a console warning when the h3 directory is not found:

```typescript
if (h3Dir) {
  return resolve(pnpmDir, h3Dir, "node_modules/h3/dist/index.cjs");
}
console.warn("[vitest.config] h3@1.x not found in .pnpm — falling back to 'h3'");
return "h3";
```

---

### IN-03: `admin-settings.spec.ts` uses `mocks` (not prefixed with `_`) but `mod-routes.spec.ts` uses `_mocks`

**File:** `apps/hub/server/api/__tests__/admin-settings.spec.ts:22`, `apps/hub/server/api/__tests__/mod-routes.spec.ts:22`

**Issue:** Minor naming inconsistency across the new spec files. `auth-routes.spec.ts` and `mod-routes.spec.ts` name the variable `_mocks` (unused-variable convention), while `admin-settings.spec.ts` and `community-settings.spec.ts` use `mocks` and actually access fields on it (e.g., `mocks.requireUserSession`). The `_mocks` name in the files that do use the value is misleading. Not a correctness issue.

**Fix:** Rename `_mocks` to `mocks` in `auth-routes.spec.ts` and `mod-routes.spec.ts` for consistency.

---

### IN-04: `eslint-plugin-security` `recommended` config may flag safe regex patterns in production code

**File:** `apps/hub/eslint.config.mjs:6`

**Issue:** `eslint-plugin-security`'s `recommended` preset includes `security/detect-non-literal-regexp` and `security/detect-unsafe-regex`. These rules have a moderate false-positive rate on patterns like the URL regex in `[...path].ts` line 19 (`url.match(/^\/api\/apps\/([^/?]+)\/(.+?)(\?.*)?$/)`) — though this specific pattern is a literal and will not be flagged. Worth monitoring for suppression noise as more routes are added.

**Fix:** No immediate action. Accept the plugin's defaults; add targeted `// eslint-disable-next-line` comments if specific false-positives appear in CI output.

---

### IN-05: `footer.vue` hardcodes `['en', 'de']` locale list in the editor locale switcher

**File:** `apps/hub/app/pages/landing/footer.vue:292`

**Issue:** The locale tab buttons for the footer page editor are hardcoded to `['en', 'de']` on line 292. The settings page (`settings.vue`) supports adding up to 14 languages dynamically. If a community admin adds a third language, footer page content will not have a UI tab for it, silently leaving that locale's content untranslatable from the UI.

**Fix:** Drive the locale switcher from `pageConfig.enabledLocales` fetched from the API, or at minimum from the same `availableLocales` list used in `settings.vue`, filtered to what is currently enabled.

---

_Reviewed: 2026-04-18T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
