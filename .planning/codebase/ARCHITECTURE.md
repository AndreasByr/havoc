# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Multi-project monorepo with a Turborepo-managed platform workspace and a standalone Nuxt marketplace app. The platform follows a modular monorepo pattern (apps + shared packages). Each web app uses Nuxt's full-stack architecture (SSR frontend + Nitro API server).

**Key Characteristics:**
- Two independent project roots: `platform/` (Turborepo pnpm workspace) and `marketplace/` (standalone Nuxt app)
- Root `package.json` orchestrates both via `concurrently`
- Platform apps share code through internal packages (`@guildora/shared`, `@guildora/app-sdk`, `@guildora/motion`)
- Hub communicates with bots (Discord, Matrix) via internal HTTP bridge ("Platform Bridge")
- Marketplace has its own separate PostgreSQL schema and database
- Plugin/extension system: community apps can be installed (sideloaded or from marketplace), with code bundles stored in DB and executed at runtime

## Layers

**Web Landing (platform/apps/web):**
- Purpose: Public-facing landing page and marketing site for a Guildora community instance
- Location: `platform/apps/web/`
- Contains: Nuxt pages, landing block components, i18n, minimal server API (auth only)
- Depends on: `@nuxtjs/i18n`, `@nuxtjs/tailwindcss`
- Used by: End users visiting the community landing page

**Hub (platform/apps/hub):**
- Purpose: Core community management dashboard — admin, moderator, and member UI with full API backend
- Location: `platform/apps/hub/`
- Contains: Nuxt frontend (pages, components, composables, middleware), Nitro server (API routes, middleware, plugins, utils)
- Depends on: `@guildora/shared` (schema, types, utils), `@guildora/app-sdk` (type definitions), `nuxt-auth-utils`, `drizzle-orm`
- Used by: Community admins, moderators, and members

**Discord Bot (platform/apps/bot):**
- Purpose: Discord bot connector — handles Discord events, slash commands, role management, voice tracking, app hooks
- Location: `platform/apps/bot/`
- Contains: Bot entry point, event handlers, slash commands, internal HTTP sync server, app hook executor
- Depends on: `discord.js`, `@guildora/shared`, `@guildora/app-sdk`
- Used by: Hub (via Platform Bridge HTTP calls), Discord users

**Matrix Bot (platform/apps/matrix-bot):**
- Purpose: Matrix bot connector — mirrors Discord bot contract for Matrix platform
- Location: `platform/apps/matrix-bot/`
- Contains: Bot entry point, event handlers (roomMessage, roomMember), internal HTTP sync server
- Depends on: `matrix-bot-sdk`, `dotenv`
- Used by: Hub (via Platform Bridge HTTP calls)

**Shared Package (platform/packages/shared):**
- Purpose: Shared database schema, types, and utility functions used across all platform apps
- Location: `platform/packages/shared/`
- Contains: Drizzle ORM schema (`src/db/schema.ts`), database client factory (`src/db/client.ts`), migrations (`drizzle/migrations/`), seeds (`src/db/seeds/`), shared types (`src/types/`), utility functions (`src/utils/`)
- Depends on: `drizzle-orm`, `postgres`
- Used by: Hub, Bot, Matrix Bot, MCP Server

**App SDK (platform/packages/app-sdk):**
- Purpose: Type definitions for the Guildora app/extension plugin system
- Location: `platform/packages/app-sdk/`
- Contains: TypeScript interfaces for bot hook payloads (voice, role, member, message events), App KV store API, platform types
- Used by: Bot (to execute app hooks), Hub (to manage installed apps), app developers (to build extensions)

**Motion Package (platform/packages/motion):**
- Purpose: Animation composables and design tokens for Vue components
- Location: `platform/packages/motion/`
- Contains: Vue composables (`src/composables/`), animation tokens, type definitions
- Used by: Hub frontend

**MCP Server (platform/packages/mcp-server):**
- Purpose: Model Context Protocol server for AI agents to interact with landing page configuration
- Location: `platform/packages/mcp-server/`
- Contains: MCP tool registrations that proxy to Hub internal API endpoints
- Depends on: `@modelcontextprotocol/sdk`, Hub internal API
- Used by: AI agents (Claude) managing landing page content

**Marketplace (standalone):**
- Purpose: Public app marketplace where developers submit and users discover Guildora extensions
- Location: `marketplace/`
- Contains: Full Nuxt app with its own DB schema, GitHub OAuth, AI-powered code review, developer portal, admin panel
- Depends on: `drizzle-orm`, `pg`, `nuxt-auth-utils`, `@anthropic-ai/sdk`, `gsap`
- Used by: App developers, community admins browsing apps

**App Templates (standalone, not deployed):**
- Purpose: Starter templates for building Guildora app extensions
- Location: `app-template/`, `guildai/`, `voice-rooms/`
- Contains: Example bot hooks, API handlers, i18n, pages
- Used by: App developers as reference implementations

## Data Flow

**User Authentication (Hub - Discord OAuth):**

1. User visits Hub login page → redirected to Discord OAuth
2. Discord callback hits `platform/apps/hub/server/routes/[locale]/api/auth/` handler
3. Session created via `nuxt-auth-utils` with user data stored in `platform/apps/hub/server/utils/auth-session.ts`
4. Server middleware (`server/middleware/03-session.ts`) attaches session to every request context
5. Client-side `app/middleware/auth.ts` guards authenticated routes

**Hub-to-Bot Communication (Platform Bridge):**

1. Hub server code calls `requestPlatform("discord", "/internal/...")` via `platform/apps/hub/server/utils/platformBridge.ts`
2. Platform config resolved from DB `platform_connections` table or ENV fallback (`platform/apps/hub/server/utils/platformConfig.ts`)
3. HTTP request sent to bot's internal sync server (port 3050 for Discord, 3051 for Matrix) with bearer token auth
4. Bot processes request and returns response

**App Installation & Execution:**

1. Admin installs app via Hub UI or sideloading → code bundle transpiled and stored in `installed_apps.code_bundle` (JSONB)
2. On Hub server startup, `server/plugins/app-loader.ts` loads all active installed apps into `H3EventContext`
3. Bot loads app hooks on startup via `src/utils/app-hooks.ts`, executing registered event handlers
4. Apps use `AppDb` KV store interface backed by `app_kv` table for persistent data

**Marketplace App Submission:**

1. Developer registers via GitHub OAuth on marketplace
2. Developer submits app with repository URL
3. AI review triggered via `marketplace/server/utils/ai-review.ts` (Anthropic Claude)
4. Admin reviews submission in `marketplace/app/pages/admin/submissions/`
5. Approved apps available for hub instances to install

**State Management:**
- Server state: PostgreSQL via Drizzle ORM (singleton DB instance per process via `getDb()`)
- Client state: Vue reactivity + Nuxt composables (no external state management library)
- Session state: Cookie-based sessions via `nuxt-auth-utils` (7-day max age)
- Bot state: In-memory Discord.js `Client` / Matrix `MatrixClient` + DB for persistence

## Key Abstractions

**Platform Bridge:**
- Purpose: Abstracts communication between Hub and platform-specific bots (Discord, Matrix)
- Files: `platform/apps/hub/server/utils/platformBridge.ts`, `platform/apps/hub/server/utils/platformConfig.ts`, `platform/apps/hub/server/utils/botSync.ts`
- Pattern: HTTP bridge with platform-aware routing, token auth, timeout handling, typed error codes

**Drizzle Schema (Single Source of Truth):**
- Purpose: Defines all database tables, enums, relations for the platform
- Files: `platform/packages/shared/src/db/schema.ts` (platform), `marketplace/server/db/schema.ts` (marketplace)
- Pattern: Drizzle ORM `pgTable()` definitions with typed JSONB columns, relations, and indexes

**Auth Guards (Hub):**
- Purpose: Role-based access control at API and page level
- Files: `platform/apps/hub/server/utils/auth.ts` (server-side `requireSession`, `requireRole`, `requireAdminSession`, `requireModeratorSession`), `platform/apps/hub/app/middleware/auth.ts` (client-side route guards)
- Pattern: Permission roles hierarchy: `superadmin` > `admin` > `moderator` > member

**Installed App Runtime:**
- Purpose: Execute community-developed app extensions within the platform
- Files: `platform/apps/hub/server/plugins/app-loader.ts`, `platform/apps/bot/src/utils/app-hooks.ts`, `platform/packages/app-sdk/src/index.ts`
- Pattern: Apps stored as transpiled CJS bundles in DB JSONB, loaded at boot, executed with sandboxed KV store

**Application Flow System:**
- Purpose: Configurable application/recruitment workflows with visual flow builder
- Files: `platform/apps/hub/app/components/applications/flow-builder/`, `platform/apps/hub/server/api/applications/`, `platform/packages/shared/src/types/application-flow.ts`
- Pattern: Graph-based flow definition stored as JSONB, with draft/active states and Discord embed integration

## Entry Points

**Platform Dev (all apps):**
- Location: `platform/package.json` → `pnpm dev` (runs Turborepo)
- Triggers: `turbo run dev --parallel`
- Responsibilities: Starts all platform apps concurrently

**Root Dev (everything):**
- Location: `package.json` → `pnpm dev`
- Triggers: `concurrently` running platform + marketplace dev servers
- Responsibilities: Runs entire system

**Hub Web Server:**
- Location: `platform/apps/hub/nuxt.config.ts` (Nuxt entry)
- Triggers: HTTP requests on port 3003 (dev) / 4003 (preview)
- Responsibilities: Serves Hub UI and API

**Web Landing Server:**
- Location: `platform/apps/web/nuxt.config.ts`
- Triggers: HTTP requests on port 3000 (dev) / 4000 (preview)
- Responsibilities: Serves public landing page

**Discord Bot:**
- Location: `platform/apps/bot/src/index.ts`
- Triggers: Discord gateway events + internal HTTP API on port 3050
- Responsibilities: Discord integration, slash commands, event processing, app hook execution

**Matrix Bot:**
- Location: `platform/apps/matrix-bot/src/index.ts`
- Triggers: Matrix sync events + internal HTTP API on port 3051
- Responsibilities: Matrix integration, message/member event processing

**Marketplace:**
- Location: `marketplace/nuxt.config.ts`
- Triggers: HTTP requests on port 3004 (dev) / 4004 (preview)
- Responsibilities: App marketplace for developers and admins

**MCP Server:**
- Location: `platform/packages/mcp-server/src/index.ts`
- Triggers: stdio transport (invoked by AI agent)
- Responsibilities: Exposes landing page tools for AI agents

## Error Handling

**Strategy:** Nuxt/H3 `createError()` for server API errors with HTTP status codes. Bot processes use `consola` logger for structured logging.

**Patterns:**
- Server API: `createError({ statusCode: 401, statusMessage: "Authentication required." })` — thrown from utility functions like `requireSession()`
- Platform Bridge: Custom `BotBridgeError` class with typed error codes (`platform/apps/hub/server/utils/bot-bridge-error.ts`)
- Bot: Try/catch with `logger.error()` and graceful shutdown handlers (SIGTERM/SIGINT)
- Client-side: Nuxt error boundaries, middleware redirects on auth failures

## Cross-Cutting Concerns

**Logging:**
- Hub: Nuxt default `console` + `consola` in server plugins
- Bot: Custom `logger` via `consola` (`platform/apps/bot/src/utils/logger.ts`)
- Matrix Bot: `console.log`/`console.error`

**Validation:**
- Server API: `zod` schemas for query/body validation (see `platform/apps/hub/server/api/dashboard/stats.get.ts`)
- DB: Drizzle typed schema with constraints (unique, not null, references)
- App manifests: `safeParseAppManifest()` from `@guildora/shared`

**Authentication:**
- Hub: Discord OAuth via `nuxt-auth-utils` with cookie sessions
- Marketplace: GitHub OAuth via `nuxt-auth-utils`
- Internal APIs: Bearer token auth (bot-to-hub and MCP-to-hub)
- CSRF: Server middleware at `platform/apps/hub/server/middleware/02-csrf-check.ts`

**Internationalization:**
- Hub + Web: `@nuxtjs/i18n` with `prefix_except_default` strategy, lazy-loaded locale files (en, de)
- Locale files: `platform/apps/hub/i18n/locales/`, `platform/apps/web/i18n/locales/`
- Server routes: `platform/apps/hub/server/routes/[locale]/` for locale-prefixed auth callbacks

**Rate Limiting:**
- Hub: `platform/apps/hub/server/middleware/01-rate-limit.ts`
- Marketplace: `marketplace/server/middleware/rate-limit.ts`

---

*Architecture analysis: 2026-04-15*
