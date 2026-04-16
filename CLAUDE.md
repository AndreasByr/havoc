<!-- GSD:project-start source:PROJECT.md -->
## Project

**Guildora Platform — Stabilisierung**

Die Guildora Platform ist ein self-hostable Community-Management-Stack (Hub-Dashboard, öffentliche Landing Page, Discord- und Matrix-Bot) mit einem Apps-/Plugin-System, über das Community-Hoster eigene oder aus dem Marketplace bezogene Erweiterungen installieren können. Dieses GSD-Projekt ist **keine Feature-Initiative**, sondern eine fokussierte Stabilisierungsrunde für den `platform/`-Teil des Guildora-Workspaces — die übrigen Repos (marketplace, guildai, voice-rooms, app-template, docs) stehen daneben und laufen nicht in diesem Projekt.

**Core Value:** **Die Platform läuft sicher und stabil genug, dass Andi sie ohne Bauchschmerzen weiterbauen, zeigen und produktiv betreiben kann.** Heißt konkret: kein unsandboxed Fremd-Code, Auth gehärtet, CI vertrauenswürdig, Preview-Lifecycle zuverlässig, Matrix-Bot nicht mehr nur halb da. Alles andere ist sekundär.

### Constraints

- **Tech-Stack**: Bestehender Stack bleibt (Nuxt 4, Vue 3, discord.js, matrix-bot-sdk, drizzle-orm, Postgres) — keine Migrations zu neuen Frameworks in diesem Projekt
- **Timeline**: ASAP für den Security-Kern (Sandbox + Auth + Deps); der Rest läuft in normalem Arbeitsrhythmus nach
- **Budget**: Solo Andi; keine externen Reviewer/Dienste bezahlt in Anspruch nehmen
- **Compatibility**: Hub ↔ Bot Internal-HTTP-Sync-Contract darf nicht brechen (auch Matrix-Bot muss den Vertrag einhalten); Drizzle-Schema-Änderungen immer als richtige Migration, keine neuen Fixups in `run-migrations.ts`
- **Security**: "Fail Loud, Never Fake" — keine stillen Sec-Fallbacks; jede Mitigation muss sichtbar, testbar und dokumentiert sein
- **Apps-Freigabe**: Apps/Plugin-System wird in diesem Projekt angefasst — ausdrücklich entgegen der SOUL.md-Default-Regel, weil der User die Freigabe explizit erteilt hat
- **Runtime**: Dev-/Build-Befehle laufen bereits im alice-bot-Container; Agents starten keine Docker-Container und ändern keine festen Ports
- **Multi-Repo**: Änderungen außerhalb `platform/` sind nicht Teil dieses Projekts — gilt für alle Agents
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ^5.8.2 - Used across all apps and packages
- Vue 3 SFC (`.vue` files) - Frontend components in web, hub, marketplace
- SQL - Database migrations via Drizzle Kit
## Runtime
- Node.js >=20.0.0 (currently v24.14.1)
- pnpm 10.6.2 (declared in `platform/package.json` `packageManager` field; currently v10.33.0 installed)
- Lockfiles: `platform/pnpm-lock.yaml`, `marketplace/pnpm-lock.yaml`, root `pnpm-lock.yaml`
## Monorepo Structure
- Lightweight root that runs `platform` and `marketplace` concurrently via `concurrently`
- Root devDependency: `concurrently@^9.1.2`
- Managed by **Turborepo** (`turbo@^2.5.0`)
- Config: `platform/turbo.json`
- Workspace packages: `apps/*` and `packages/*`
- Standalone Nuxt 4 app with its own `pnpm-lock.yaml`
## Frameworks
- Nuxt ^4.1.3 (platform web, hub) / ^4.4.2 (marketplace) - Full-stack Vue framework (SSR + API routes via Nitro)
- Vue ^3.5.0 - Frontend reactivity and components
- discord.js ^14.25.1 - Discord bot (`platform/apps/bot`)
- matrix-bot-sdk ^0.7.1 - Matrix bot (`platform/apps/matrix-bot`)
- Vitest ^2.1.0 / ^3.1.1 - Unit and integration tests across platform packages
- Playwright ^1.59.1 - E2E/smoke tests in web, hub, marketplace
- `@nuxt/test-utils` ^3.14.0 - Nuxt-aware testing in hub
- Turborepo ^2.5.0 - Orchestrates build/dev/lint/test across platform workspace (`platform/turbo.json`)
- tsx ^4.19.3 - TypeScript execution for scripts and bot dev mode
- esbuild ^0.24.2 - Used by hub and bot for fast builds
- vue-tsc ^2.2.8 - Vue type checking
## Key Dependencies
- `drizzle-orm` ^0.44.5 / ^0.45.2 - ORM for all database access (platform shared package + marketplace)
- `drizzle-kit` ^0.31.4 / ^0.31.10 - Migration generation and DB studio
- `nuxt-auth-utils` ^0.5.0 / ^0.5.29 - Session management and OAuth helpers (hub + marketplace)
- `zod` ^3.24.2 / ^3.25.0 - Schema validation (shared, hub, mcp-server)
- `postgres` ^3.4.7 - PostgreSQL client for platform shared (`drizzle-orm/postgres-js` driver)
- `pg` ^8.16.0 - PostgreSQL client for marketplace (`drizzle-orm/node-postgres` driver)
- `@aws-sdk/client-s3` ^3.1018.0 - S3-compatible media storage (hub)
- `@aws-sdk/s3-request-presigner` ^3.1018.0 - Presigned URLs for media uploads
- `@anthropic-ai/sdk` ^0.39.0 - AI code review for marketplace app submissions
- `@modelcontextprotocol/sdk` ^1.29.0 - MCP server for AI agent access to landing page config
- `sharp` ^0.33.5 - Image processing (hub)
- `consola` ^3.4.2 - Structured logging (bot)
- `@nuxtjs/tailwindcss` ^6.13.2 - Tailwind CSS integration
- `tailwindcss` ^3.4.17 - Utility-first CSS framework
- `@tailwindcss/typography` ^0.5.19 - Prose styling (marketplace)
- `gsap` ^3.14.2 - Animation library (motion package + marketplace)
- `lenis` ^1.3.21 - Smooth scroll (web + marketplace)
- `chart.js` ^4.5.1 + `vue-chartjs` ^5.3.3 - Charts (hub dashboard)
- `@vue-flow/core` ^1.48.2 - Flow/node graph editor (hub, application flow builder)
- `vuedraggable` ^4.1.0 - Drag-and-drop (hub)
- `@nuxtjs/i18n` ^9.4.1 - Internationalization (web, hub)
- `@nuxtjs/color-mode` ^3.5.2 - Dark/light mode (hub)
- `@nuxtjs/seo` ^5.1.2 - SEO meta/sitemap/robots (marketplace)
- `@nuxt/image` ^2.0.0 - Optimized images (marketplace)
- `@nuxt/icon` ^2.2.1 - Icon sets (web, hub, marketplace)
- `isomorphic-dompurify` ^3.7.1 / ^3.8.0 - HTML sanitization (web, hub, marketplace)
- `marked` ^17.0.5 - Markdown parsing (marketplace)
- `shiki` ^4.0.0 - Code syntax highlighting (marketplace docs)
- `vue3-sfc-loader` ^0.9.5 - Runtime SFC loading for apps (hub)
- ESLint ^10.0.3 via `@nuxt/eslint` ^1.15.0 - Linting (web, hub)
- Prettier ^3.4.2 - Code formatting (web, hub)
## Configuration
- `.env.example` at `platform/.env.example` - Reference for all required/optional env vars
- `.env`, `.env.local`, `.env.test`, `.env.tunnel` present in `platform/`
- Nuxt apps load env via `--dotenv ../../.env.local` (dev) or `--env-file` (production)
- Bot loads env via `dotenv` package
- `platform/turbo.json` - Turborepo task pipeline
- `platform/apps/web/nuxt.config.ts` - Web app Nuxt config
- `platform/apps/hub/nuxt.config.ts` - Hub app Nuxt config (most complex, includes auth, color mode, i18n)
- `marketplace/nuxt.config.ts` - Marketplace Nuxt config
- `platform/packages/shared/drizzle.config.ts` - Platform DB migration config
- `marketplace/drizzle.config.ts` - Marketplace DB migration config
## Platform Requirements
- Node.js >=20
- pnpm >=10
- PostgreSQL 16 (via Docker: `docker compose up db` from `platform/`)
- Dev server binds to `0.0.0.0` for Docker port forwarding
- Docker Compose (`platform/docker-compose.yml`) with services: db, web, hub, bot
- Caddy reverse proxy (external network)
- Cloudflare Tunnel for external access
## Workspace Packages
| Package | Path | Purpose |
|---------|------|---------|
| `@guildora/web` | `platform/apps/web` | Landing page / public site (Nuxt SSR) |
| `@guildora/hub` | `platform/apps/hub` | Community dashboard (Nuxt SSR + API) |
| `@guildora/bot` | `platform/apps/bot` | Discord bot (discord.js) |
| `@guildora/matrix-bot` | `platform/apps/matrix-bot` | Matrix bot (matrix-bot-sdk) |
| `@guildora/shared` | `platform/packages/shared` | DB schema, migrations, types, utils |
| `@guildora/app-sdk` | `platform/packages/app-sdk` | SDK for building Guildora apps |
| `@guildora/motion` | `platform/packages/motion` | Shared animation composables (GSAP + Vue) |
| `@guildora/mcp-server` | `platform/packages/mcp-server` | MCP server for AI agent access |
| `marketplace` | `marketplace/` | App marketplace (standalone Nuxt) |
| `guildai` | `guildai/` | AI utilities library (standalone) |
## Port Schema
| App | Dev Port | Preview Port |
|-----|----------|-------------|
| Web | 3000 | 4000 |
| Hub | 3003 | 4003 |
| Marketplace | 3004 | 4004 |
| Bot | 3050 | - |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Vue components: PascalCase with category prefix -- `UiButton.vue`, `LandingPreview.vue`, `DevLoginBanner.vue`
- Vue pages: kebab-case or single-word lowercase -- `login.vue`, `setup.vue`; nested via directory structure (`pages/profile/customize.vue`)
- Composables: `use` prefix, camelCase -- `useAuth.ts`, `useThemeColors.ts`, `useFlowBuilder.ts`
- Server utils: camelCase -- `auth.ts`, `jsonResponse.ts`, `botSync.ts`, `community-settings.ts` (some use kebab-case)
- API routes: Nuxt file-based routing with HTTP method suffix -- `community-settings.get.ts`, `community-settings.put.ts`, `csrf-token.get.ts`
- Test files: `*.spec.ts` (preferred), `*.test.ts` (also accepted), `*.test.mjs` (rare)
- DB schema enums: camelCase with `Enum` suffix -- `platformTypeEnum`, `applicationStatusEnum`
- Shared types: PascalCase interfaces -- `AppSessionUser`, `ModerationRightsSession`, `ApplicationFlowGraph`
- camelCase for all functions -- `requireSession`, `buildSessionUser`, `sanitizeForJson`
- Factory functions use `build` prefix -- `buildUser`, `buildSession`, `buildSessionUser`, `buildMinimalFlowGraph`
- Guard/validation functions use `require` prefix -- `requireRole`, `requireSession`, `requireAdminSession`, `requireRouterParam`
- Normalizer functions use `normalize` prefix -- `normalizeCommunityDefaultLocale`
- Parser functions use `parse` prefix -- `parseProfileName`, `parsePaginationQuery`
- camelCase for all variables and constants
- Uppercase for constant arrays/configs -- `IMAGE_TYPES`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `COMMUNITY_SETTINGS_SINGLETON_ID`
- DB schema tables are camelCase exports -- `users`, `communitySettings`, `applicationFlows`
- PascalCase for interfaces and type aliases -- `AppSession`, `PermissionRole`, `MockEventOptions`
- Generic type params single uppercase letter -- `<T>`, `<TSchema>`
- Zod schemas are lowercase camelCase -- `const schema = z.object({...})`
## Code Style
- Prettier with config at `platform/.prettierrc`
- Semicolons: enabled (`"semi": true`)
- Quotes: double quotes (`"singleQuote": false`)
- Tab width: 2 spaces (`"tabWidth": 2`)
- Trailing commas: none (`"trailingComma": "none"`)
- Note: Marketplace does not have its own Prettier config (may follow different style)
- ESLint via `@nuxt/eslint` module (Nuxt apps auto-generate ESLint config)
- Config files: `platform/apps/web/eslint.config.mjs`, `platform/apps/hub/eslint.config.mjs`
- Both extend the auto-generated `.nuxt/eslint.config.mjs` with no custom overrides
- TypeScript strict mode enabled in `tsconfig.json` (`"strict": true`)
## Import Organization
- `@guildora/shared` -> `platform/packages/shared/src`
- `@guildora/shared/*` -> `platform/packages/shared/src/*`
- `@guildora/app-sdk` -> `platform/packages/app-sdk/src`
- `@guildora/app-sdk/*` -> `platform/packages/app-sdk/src/*`
- `~/` -> Nuxt auto-resolved app root (standard Nuxt alias)
- Nuxt auto-imports are used extensively in server routes and components: `defineEventHandler`, `createError`, `readBody`, `getRouterParam`, `useRuntimeConfig`, `navigateTo`, `useUserSession`, `requireUserSession`, `useRoute`, `useI18n`, `computed`, `definePageMeta`
- These do NOT appear as explicit imports in source code
- In tests, auto-imports must be stubbed via `vi.stubGlobal()` -- see `platform/apps/hub/server/utils/__tests__/test-helpers.ts`
## Error Handling
- Use `createError({ statusCode, statusMessage })` (Nuxt/h3 auto-import) to throw HTTP errors
- Common status codes: 400 (validation), 401 (auth required), 403 (forbidden), 429 (rate limit)
- Validation via Zod with `readBodyWithSchema()` helper at `platform/apps/hub/server/utils/http.ts`
- Guard pattern: call `requireSession(event)` or `requireAdminSession(event)` at top of handler; throws 401/403 on failure
- Try/catch with rethrow pattern for wrapping external calls
- `$fetch` for API calls (Nuxt built-in, returns typed responses)
- `useCsrfFetch` composable wraps `$fetch` with CSRF token injection
- Error display handled in page/component layer
- Top-level try/catch in event handlers with `logger.error()` fallback
- Silent catch for non-critical operations (e.g., fetching reply context)
## Logging
- Bot uses a tagged logger: `createConsola({ defaults: { tag: "bot" } })` at `platform/apps/bot/src/utils/logger.ts`
- Log levels: `logger.info()`, `logger.warn()`, `logger.error()`
- Production mode reduces log level and uses compact format
- Server-side Nuxt uses built-in `console` or Nitro logging (no custom logger observed in hub)
## Comments
- Section dividers using box-drawing characters: `// --- Section Name ---` or `// ─── Section Name ───`
- JSDoc comments on exported utility functions and interfaces
- `@deprecated` tags for legacy fields (e.g., `/** @deprecated Use permissionRoles. */`)
- Inline comments for non-obvious logic (e.g., "Ignore bot messages to prevent loops")
- Used on public-facing utility functions and test helpers
- Interface fields use JSDoc for deprecation notices
- Not required on Vue components or API route handlers
## Function Design
## Module Design
## Vue Component Conventions
## API Route Conventions
## Database Conventions
- Tables: camelCase JS export, snake_case SQL name -- `communitySettings` -> `"community_settings"`
- Columns: camelCase JS, snake_case SQL -- `discordId` -> `"discord_id"`
- Enums: camelCase with `Enum` suffix -- `platformTypeEnum`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Two independent project roots: `platform/` (Turborepo pnpm workspace) and `marketplace/` (standalone Nuxt app)
- Root `package.json` orchestrates both via `concurrently`
- Platform apps share code through internal packages (`@guildora/shared`, `@guildora/app-sdk`, `@guildora/motion`)
- Hub communicates with bots (Discord, Matrix) via internal HTTP bridge ("Platform Bridge")
- Marketplace has its own separate PostgreSQL schema and database
- Plugin/extension system: community apps can be installed (sideloaded or from marketplace), with code bundles stored in DB and executed at runtime
## Layers
- Purpose: Public-facing landing page and marketing site for a Guildora community instance
- Location: `platform/apps/web/`
- Contains: Nuxt pages, landing block components, i18n, minimal server API (auth only)
- Depends on: `@nuxtjs/i18n`, `@nuxtjs/tailwindcss`
- Used by: End users visiting the community landing page
- Purpose: Core community management dashboard — admin, moderator, and member UI with full API backend
- Location: `platform/apps/hub/`
- Contains: Nuxt frontend (pages, components, composables, middleware), Nitro server (API routes, middleware, plugins, utils)
- Depends on: `@guildora/shared` (schema, types, utils), `@guildora/app-sdk` (type definitions), `nuxt-auth-utils`, `drizzle-orm`
- Used by: Community admins, moderators, and members
- Purpose: Discord bot connector — handles Discord events, slash commands, role management, voice tracking, app hooks
- Location: `platform/apps/bot/`
- Contains: Bot entry point, event handlers, slash commands, internal HTTP sync server, app hook executor
- Depends on: `discord.js`, `@guildora/shared`, `@guildora/app-sdk`
- Used by: Hub (via Platform Bridge HTTP calls), Discord users
- Purpose: Matrix bot connector — mirrors Discord bot contract for Matrix platform
- Location: `platform/apps/matrix-bot/`
- Contains: Bot entry point, event handlers (roomMessage, roomMember), internal HTTP sync server
- Depends on: `matrix-bot-sdk`, `dotenv`
- Used by: Hub (via Platform Bridge HTTP calls)
- Purpose: Shared database schema, types, and utility functions used across all platform apps
- Location: `platform/packages/shared/`
- Contains: Drizzle ORM schema (`src/db/schema.ts`), database client factory (`src/db/client.ts`), migrations (`drizzle/migrations/`), seeds (`src/db/seeds/`), shared types (`src/types/`), utility functions (`src/utils/`)
- Depends on: `drizzle-orm`, `postgres`
- Used by: Hub, Bot, Matrix Bot, MCP Server
- Purpose: Type definitions for the Guildora app/extension plugin system
- Location: `platform/packages/app-sdk/`
- Contains: TypeScript interfaces for bot hook payloads (voice, role, member, message events), App KV store API, platform types
- Used by: Bot (to execute app hooks), Hub (to manage installed apps), app developers (to build extensions)
- Purpose: Animation composables and design tokens for Vue components
- Location: `platform/packages/motion/`
- Contains: Vue composables (`src/composables/`), animation tokens, type definitions
- Used by: Hub frontend
- Purpose: Model Context Protocol server for AI agents to interact with landing page configuration
- Location: `platform/packages/mcp-server/`
- Contains: MCP tool registrations that proxy to Hub internal API endpoints
- Depends on: `@modelcontextprotocol/sdk`, Hub internal API
- Used by: AI agents (Claude) managing landing page content
- Purpose: Public app marketplace where developers submit and users discover Guildora extensions
- Location: `marketplace/`
- Contains: Full Nuxt app with its own DB schema, GitHub OAuth, AI-powered code review, developer portal, admin panel
- Depends on: `drizzle-orm`, `pg`, `nuxt-auth-utils`, `@anthropic-ai/sdk`, `gsap`
- Used by: App developers, community admins browsing apps
- Purpose: Starter templates for building Guildora app extensions
- Location: `app-template/`, `guildai/`, `voice-rooms/`
- Contains: Example bot hooks, API handlers, i18n, pages
- Used by: App developers as reference implementations
## Data Flow
- Server state: PostgreSQL via Drizzle ORM (singleton DB instance per process via `getDb()`)
- Client state: Vue reactivity + Nuxt composables (no external state management library)
- Session state: Cookie-based sessions via `nuxt-auth-utils` (7-day max age)
- Bot state: In-memory Discord.js `Client` / Matrix `MatrixClient` + DB for persistence
## Key Abstractions
- Purpose: Abstracts communication between Hub and platform-specific bots (Discord, Matrix)
- Files: `platform/apps/hub/server/utils/platformBridge.ts`, `platform/apps/hub/server/utils/platformConfig.ts`, `platform/apps/hub/server/utils/botSync.ts`
- Pattern: HTTP bridge with platform-aware routing, token auth, timeout handling, typed error codes
- Purpose: Defines all database tables, enums, relations for the platform
- Files: `platform/packages/shared/src/db/schema.ts` (platform), `marketplace/server/db/schema.ts` (marketplace)
- Pattern: Drizzle ORM `pgTable()` definitions with typed JSONB columns, relations, and indexes
- Purpose: Role-based access control at API and page level
- Files: `platform/apps/hub/server/utils/auth.ts` (server-side `requireSession`, `requireRole`, `requireAdminSession`, `requireModeratorSession`), `platform/apps/hub/app/middleware/auth.ts` (client-side route guards)
- Pattern: Permission roles hierarchy: `superadmin` > `admin` > `moderator` > member
- Purpose: Execute community-developed app extensions within the platform
- Files: `platform/apps/hub/server/plugins/app-loader.ts`, `platform/apps/bot/src/utils/app-hooks.ts`, `platform/packages/app-sdk/src/index.ts`
- Pattern: Apps stored as transpiled CJS bundles in DB JSONB, loaded at boot, executed with sandboxed KV store
- Purpose: Configurable application/recruitment workflows with visual flow builder
- Files: `platform/apps/hub/app/components/applications/flow-builder/`, `platform/apps/hub/server/api/applications/`, `platform/packages/shared/src/types/application-flow.ts`
- Pattern: Graph-based flow definition stored as JSONB, with draft/active states and Discord embed integration
## Entry Points
- Location: `platform/package.json` → `pnpm dev` (runs Turborepo)
- Triggers: `turbo run dev --parallel`
- Responsibilities: Starts all platform apps concurrently
- Location: `package.json` → `pnpm dev`
- Triggers: `concurrently` running platform + marketplace dev servers
- Responsibilities: Runs entire system
- Location: `platform/apps/hub/nuxt.config.ts` (Nuxt entry)
- Triggers: HTTP requests on port 3003 (dev) / 4003 (preview)
- Responsibilities: Serves Hub UI and API
- Location: `platform/apps/web/nuxt.config.ts`
- Triggers: HTTP requests on port 3000 (dev) / 4000 (preview)
- Responsibilities: Serves public landing page
- Location: `platform/apps/bot/src/index.ts`
- Triggers: Discord gateway events + internal HTTP API on port 3050
- Responsibilities: Discord integration, slash commands, event processing, app hook execution
- Location: `platform/apps/matrix-bot/src/index.ts`
- Triggers: Matrix sync events + internal HTTP API on port 3051
- Responsibilities: Matrix integration, message/member event processing
- Location: `marketplace/nuxt.config.ts`
- Triggers: HTTP requests on port 3004 (dev) / 4004 (preview)
- Responsibilities: App marketplace for developers and admins
- Location: `platform/packages/mcp-server/src/index.ts`
- Triggers: stdio transport (invoked by AI agent)
- Responsibilities: Exposes landing page tools for AI agents
## Error Handling
- Server API: `createError({ statusCode: 401, statusMessage: "Authentication required." })` — thrown from utility functions like `requireSession()`
- Platform Bridge: Custom `BotBridgeError` class with typed error codes (`platform/apps/hub/server/utils/bot-bridge-error.ts`)
- Bot: Try/catch with `logger.error()` and graceful shutdown handlers (SIGTERM/SIGINT)
- Client-side: Nuxt error boundaries, middleware redirects on auth failures
## Cross-Cutting Concerns
- Hub: Nuxt default `console` + `consola` in server plugins
- Bot: Custom `logger` via `consola` (`platform/apps/bot/src/utils/logger.ts`)
- Matrix Bot: `console.log`/`console.error`
- Server API: `zod` schemas for query/body validation (see `platform/apps/hub/server/api/dashboard/stats.get.ts`)
- DB: Drizzle typed schema with constraints (unique, not null, references)
- App manifests: `safeParseAppManifest()` from `@guildora/shared`
- Hub: Discord OAuth via `nuxt-auth-utils` with cookie sessions
- Marketplace: GitHub OAuth via `nuxt-auth-utils`
- Internal APIs: Bearer token auth (bot-to-hub and MCP-to-hub)
- CSRF: Server middleware at `platform/apps/hub/server/middleware/02-csrf-check.ts`
- Hub + Web: `@nuxtjs/i18n` with `prefix_except_default` strategy, lazy-loaded locale files (en, de)
- Locale files: `platform/apps/hub/i18n/locales/`, `platform/apps/web/i18n/locales/`
- Server routes: `platform/apps/hub/server/routes/[locale]/` for locale-prefixed auth callbacks
- Hub: `platform/apps/hub/server/middleware/01-rate-limit.ts`
- Marketplace: `marketplace/server/middleware/rate-limit.ts`
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
