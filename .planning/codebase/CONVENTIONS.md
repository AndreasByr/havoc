# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- Vue components: PascalCase with category prefix -- `UiButton.vue`, `LandingPreview.vue`, `DevLoginBanner.vue`
- Vue pages: kebab-case or single-word lowercase -- `login.vue`, `setup.vue`; nested via directory structure (`pages/profile/customize.vue`)
- Composables: `use` prefix, camelCase -- `useAuth.ts`, `useThemeColors.ts`, `useFlowBuilder.ts`
- Server utils: camelCase -- `auth.ts`, `jsonResponse.ts`, `botSync.ts`, `community-settings.ts` (some use kebab-case)
- API routes: Nuxt file-based routing with HTTP method suffix -- `community-settings.get.ts`, `community-settings.put.ts`, `csrf-token.get.ts`
- Test files: `*.spec.ts` (preferred), `*.test.ts` (also accepted), `*.test.mjs` (rare)
- DB schema enums: camelCase with `Enum` suffix -- `platformTypeEnum`, `applicationStatusEnum`
- Shared types: PascalCase interfaces -- `AppSessionUser`, `ModerationRightsSession`, `ApplicationFlowGraph`

**Functions:**
- camelCase for all functions -- `requireSession`, `buildSessionUser`, `sanitizeForJson`
- Factory functions use `build` prefix -- `buildUser`, `buildSession`, `buildSessionUser`, `buildMinimalFlowGraph`
- Guard/validation functions use `require` prefix -- `requireRole`, `requireSession`, `requireAdminSession`, `requireRouterParam`
- Normalizer functions use `normalize` prefix -- `normalizeCommunityDefaultLocale`
- Parser functions use `parse` prefix -- `parseProfileName`, `parsePaginationQuery`

**Variables:**
- camelCase for all variables and constants
- Uppercase for constant arrays/configs -- `IMAGE_TYPES`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `COMMUNITY_SETTINGS_SINGLETON_ID`
- DB schema tables are camelCase exports -- `users`, `communitySettings`, `applicationFlows`

**Types:**
- PascalCase for interfaces and type aliases -- `AppSession`, `PermissionRole`, `MockEventOptions`
- Generic type params single uppercase letter -- `<T>`, `<TSchema>`
- Zod schemas are lowercase camelCase -- `const schema = z.object({...})`

## Code Style

**Formatting:**
- Prettier with config at `platform/.prettierrc`
- Semicolons: enabled (`"semi": true`)
- Quotes: double quotes (`"singleQuote": false`)
- Tab width: 2 spaces (`"tabWidth": 2`)
- Trailing commas: none (`"trailingComma": "none"`)
- Note: Marketplace does not have its own Prettier config (may follow different style)

**Linting:**
- ESLint via `@nuxt/eslint` module (Nuxt apps auto-generate ESLint config)
- Config files: `platform/apps/web/eslint.config.mjs`, `platform/apps/hub/eslint.config.mjs`
- Both extend the auto-generated `.nuxt/eslint.config.mjs` with no custom overrides
- TypeScript strict mode enabled in `tsconfig.json` (`"strict": true`)

## Import Organization

**Order:**
1. Node.js built-in modules -- `import { resolve } from "node:path"`
2. External packages -- `import { z } from "zod"`, `import { eq } from "drizzle-orm"`
3. Workspace packages -- `import { communitySettings } from "@guildora/shared"`
4. Relative imports -- `import { getDb } from "../../utils/db"`

**Path Aliases:**
- `@guildora/shared` -> `platform/packages/shared/src`
- `@guildora/shared/*` -> `platform/packages/shared/src/*`
- `@guildora/app-sdk` -> `platform/packages/app-sdk/src`
- `@guildora/app-sdk/*` -> `platform/packages/app-sdk/src/*`
- `~/` -> Nuxt auto-resolved app root (standard Nuxt alias)

**Nuxt Auto-Imports:**
- Nuxt auto-imports are used extensively in server routes and components: `defineEventHandler`, `createError`, `readBody`, `getRouterParam`, `useRuntimeConfig`, `navigateTo`, `useUserSession`, `requireUserSession`, `useRoute`, `useI18n`, `computed`, `definePageMeta`
- These do NOT appear as explicit imports in source code
- In tests, auto-imports must be stubbed via `vi.stubGlobal()` -- see `platform/apps/hub/server/utils/__tests__/test-helpers.ts`

## Error Handling

**Server-side (API routes):**
- Use `createError({ statusCode, statusMessage })` (Nuxt/h3 auto-import) to throw HTTP errors
- Common status codes: 400 (validation), 401 (auth required), 403 (forbidden), 429 (rate limit)
- Validation via Zod with `readBodyWithSchema()` helper at `platform/apps/hub/server/utils/http.ts`
- Guard pattern: call `requireSession(event)` or `requireAdminSession(event)` at top of handler; throws 401/403 on failure
- Try/catch with rethrow pattern for wrapping external calls

**Client-side (Vue):**
- `$fetch` for API calls (Nuxt built-in, returns typed responses)
- `useCsrfFetch` composable wraps `$fetch` with CSRF token injection
- Error display handled in page/component layer

**Bot (Discord.js):**
- Top-level try/catch in event handlers with `logger.error()` fallback
- Silent catch for non-critical operations (e.g., fetching reply context)

## Logging

**Framework:** `consola` (via `createConsola`)

**Patterns:**
- Bot uses a tagged logger: `createConsola({ defaults: { tag: "bot" } })` at `platform/apps/bot/src/utils/logger.ts`
- Log levels: `logger.info()`, `logger.warn()`, `logger.error()`
- Production mode reduces log level and uses compact format
- Server-side Nuxt uses built-in `console` or Nitro logging (no custom logger observed in hub)

## Comments

**When to Comment:**
- Section dividers using box-drawing characters: `// --- Section Name ---` or `// ─── Section Name ───`
- JSDoc comments on exported utility functions and interfaces
- `@deprecated` tags for legacy fields (e.g., `/** @deprecated Use permissionRoles. */`)
- Inline comments for non-obvious logic (e.g., "Ignore bot messages to prevent loops")

**JSDoc/TSDoc:**
- Used on public-facing utility functions and test helpers
- Interface fields use JSDoc for deprecation notices
- Not required on Vue components or API route handlers

## Function Design

**Size:** Functions are generally short (10-30 lines). Complex logic is extracted into utility functions in `server/utils/` or `packages/shared/src/utils/`.

**Parameters:** Use typed objects for multi-param functions. Single required params are positional. Optional config via trailing options object.

**Return Values:** API handlers return plain objects (auto-serialized by Nitro). Utility functions return typed values. Guard functions throw on failure (no return value).

## Module Design

**Exports:** Named exports preferred throughout. No default exports except for Nuxt convention files (`defineEventHandler`, `defineNuxtRouteMiddleware`, `defineNuxtConfig`).

**Barrel Files:** `platform/packages/shared/src/index.ts` re-exports from sub-modules. Packages use barrel files for public API.

## Vue Component Conventions

**Script Setup:** All components use `<script setup lang="ts">`. No Options API.

**Props:** Use `defineProps<{...}>()` with TypeScript generics. Use `withDefaults()` for default values.

**Component Naming:** PascalCase with category prefix matching directory: `Ui` prefix for `components/ui/`, `Landing` prefix for `components/landing/`.

**CSS:** Tailwind CSS utility classes. DaisyUI component classes (`btn`, `btn-primary`, `btn-sm`). Custom CSS in `assets/css/` files.

## API Route Conventions

**File naming:** `[resource].[method].ts` (e.g., `community-settings.get.ts`, `community-settings.put.ts`)

**Handler pattern:**
```typescript
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);  // auth guard
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");  // validation
  const db = getDb();  // db access
  // ... business logic ...
  return { /* response */ };
});
```

**Zod schemas** are defined as `const schema = z.object({...})` at module scope, above the handler.

## Database Conventions

**ORM:** Drizzle ORM with PostgreSQL

**Schema location:** `platform/packages/shared/src/db/schema.ts` (single file, ~960 lines)

**Naming:**
- Tables: camelCase JS export, snake_case SQL name -- `communitySettings` -> `"community_settings"`
- Columns: camelCase JS, snake_case SQL -- `discordId` -> `"discord_id"`
- Enums: camelCase with `Enum` suffix -- `platformTypeEnum`

**Query pattern:** Drizzle query builder chaining:
```typescript
const [row] = await db
  .select({ field: table.field })
  .from(table)
  .where(eq(table.id, id))
  .limit(1);
```

---

*Convention analysis: 2026-04-15*
