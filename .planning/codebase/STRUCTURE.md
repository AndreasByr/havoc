# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```
guildora/
├── package.json                    # Root orchestrator (concurrently runs platform + marketplace)
├── pnpm-lock.yaml                  # Root lockfile
├── scripts/                        # Root-level scripts (predev)
├── CLAUDE.md                       # Agent instructions
├── SOUL.md                         # Project identity/philosophy
│
├── platform/                       # Turborepo monorepo (core platform)
│   ├── package.json                # Workspace root with turbo scripts
│   ├── pnpm-workspace.yaml         # Defines apps/* + packages/*
│   ├── turbo.json                  # Task pipeline config
│   ├── apps/
│   │   ├── web/                    # Public landing page (Nuxt)
│   │   ├── hub/                    # Community management dashboard (Nuxt full-stack)
│   │   ├── bot/                    # Discord bot (discord.js + tsx)
│   │   └── matrix-bot/             # Matrix bot (matrix-bot-sdk)
│   ├── packages/
│   │   ├── shared/                 # Shared DB schema, types, utils
│   │   ├── app-sdk/                # App extension type definitions
│   │   ├── motion/                 # Animation composables
│   │   └── mcp-server/             # MCP server for AI agents
│   └── scripts/                    # Platform-level scripts
│
├── marketplace/                    # Standalone Nuxt app (app marketplace)
│   ├── app/                        # Nuxt app directory
│   ├── server/                     # Nitro server (API, DB, middleware)
│   ├── apps/web/                   # Nested sub-app (marketplace web)
│   └── nuxt.config.ts              # Nuxt configuration
│
├── app-template/                   # Starter template for building Guildora apps
├── guildai/                        # Example app: AI integration
├── voice-rooms/                    # Example app: Voice room tracking
│
├── docs/                           # Documentation repository
│   ├── ai/                         # AI-related docs
│   ├── architecture-systems/       # Architecture documentation
│   ├── for-developers/             # Developer guides
│   ├── for-hosters/                # Self-hosting guides
│   └── for-users/                  # User guides
│
├── .alice/                         # Alice bot workspace files
├── .github/                        # GitHub org profile + workflows
└── .planning/                      # Planning and analysis docs
```

## Directory Purposes

**platform/apps/hub/ (Core Hub App):**
- Purpose: Full-stack community management dashboard
- Contains: Nuxt app with extensive server-side API
- Key files:
  - `nuxt.config.ts`: App configuration with auth, i18n, color-mode
  - `app/pages/`: Vue page routes (dashboard, members, applications, settings, apps, profile, dev, landing)
  - `app/components/`: Vue components organized by feature (applications, landing, layout, members, profile, sidebar, ui, dev, shared)
  - `app/composables/`: Vue composables (auth, theme, profile, flow-builder, sidebar-nav, CSRF fetch, etc.)
  - `app/middleware/`: Client-side route guards (auth, admin, moderator, superadmin, dev, settings, landing, mandatory-fields, setup, locale)
  - `server/api/`: Nitro API routes organized by domain (admin/, applications/, apply/, apps/, auth/, dashboard/, dev/, internal/, members/, mod/, profile/, public/, settings/, setup/)
  - `server/middleware/`: Server middleware chain (01-rate-limit, 02-csrf-check, 03-session)
  - `server/plugins/`: Server startup plugins (db-migrate, roles-init, app-loader, app-auto-updater, membership-auto-sync, membership-auto-cleanup, archive-cleanup)
  - `server/utils/`: Server utility modules (~50 files covering auth, DB, Discord, apps, communities, moderation, etc.)
  - `server/routes/`: Special routes ([locale]/api/auth/, uploads/)
  - `i18n/locales/`: Translation files (en.json, de.json)
  - `tests/`: Playwright E2E tests

**platform/apps/web/ (Landing Page):**
- Purpose: Public-facing landing page for a community instance
- Contains: Lightweight Nuxt app focused on presentation
- Key files:
  - `app/pages/index.vue`: Main landing page
  - `app/pages/login.vue`: Login redirect page
  - `app/pages/[slug].vue`: Dynamic footer pages
  - `app/components/landing/blocks/`: Reusable landing section block components
  - `app/components/layout/`: Layout components (navbar, footer)
  - `server/api/auth/`: Auth callback routes

**platform/apps/bot/ (Discord Bot):**
- Purpose: Discord bot handling guild events, commands, app hooks
- Contains: TypeScript bot application
- Key files:
  - `src/index.ts`: Bot entry point (client setup, event registration, shutdown)
  - `src/commands/`: Slash command definitions (setup)
  - `src/events/`: Event handlers (ready, interactionCreate, guildMemberAdd, voiceStateUpdate, messageCreate)
  - `src/interactions/`: Interaction handlers (button clicks, modals)
  - `src/utils/`: Utilities (app-hooks, community, deploy-commands, internal-sync-server, logger, voice-reconcile)
  - `src/i18n/`: Bot i18n strings

**platform/apps/matrix-bot/ (Matrix Bot):**
- Purpose: Matrix platform connector with same internal API contract as Discord bot
- Contains: TypeScript bot application
- Key files:
  - `src/index.ts`: Bot entry point (Matrix client setup, event registration)
  - `src/events/`: Event handlers (roomMessage, roomMember)
  - `src/utils/`: Utilities (internal-sync-server)

**platform/packages/shared/:**
- Purpose: Shared code consumed by all platform apps
- Contains: DB schema, client, migrations, types, utilities
- Key files:
  - `src/index.ts`: Barrel export (schema, types, utils)
  - `src/db/schema.ts`: Complete Drizzle ORM schema (~960 lines, 30+ tables)
  - `src/db/client.ts`: Database connection factory (`createDb()`)
  - `src/db/migrate.ts`: Migration runner
  - `src/db/seeds/`: Seed data scripts
  - `src/types/`: Shared TypeScript types (app-manifest, application-flow, locale, profile, roles, user)
  - `src/utils/`: Shared utilities (flow-linearize, flow-simple-convert, profile-name)
  - `drizzle/migrations/`: SQL migration files
  - `drizzle/migrations/meta/`: Migration metadata

**platform/packages/app-sdk/:**
- Purpose: Type definitions for the Guildora app/extension plugin API
- Contains: Single `src/index.ts` with all interface definitions
- Key types: `VoiceActivityPayload`, `RoleChangePayload`, `MemberJoinPayload`, `MessagePayload`, `AppDb`, `GuildoraPlatform`

**platform/packages/motion/:**
- Purpose: Animation system for Vue components
- Contains: Composables and design tokens
- Key files:
  - `src/index.ts`: Barrel export
  - `src/composables/`: Animation composables
  - `src/tokens.ts`: Animation design tokens
  - `src/types.ts`: Type definitions

**platform/packages/mcp-server/:**
- Purpose: MCP server exposing landing page management tools for AI agents
- Contains: Single `src/index.ts` with tool registrations
- Key pattern: Proxies all requests to Hub internal API with bearer token auth

**marketplace/:**
- Purpose: Standalone app marketplace with developer portal
- Contains: Complete Nuxt application with its own database
- Key files:
  - `server/db/schema.ts`: Marketplace-specific DB schema (developers, app_registry, submissions, reviews, notifications)
  - `server/db/index.ts`: DB connection
  - `server/api/admin/`: Admin API routes (stats, submissions management)
  - `server/api/developer/`: Developer API routes (apps, submissions, profile, notifications)
  - `server/api/marketplace/`: Public marketplace API
  - `server/api/hub/`: API consumed by Hub instances to list/install apps
  - `server/api/auth/`: GitHub OAuth
  - `server/api/webhooks/`: GitHub webhook handler
  - `server/utils/ai-review.ts`: AI-powered code review (Anthropic Claude)
  - `server/utils/github.ts`: GitHub API integration
  - `server/utils/linear.ts`: Linear issue tracking integration
  - `app/pages/`: Pages (index, apps/, developer/, admin/, docs/, legal pages)
  - `app/components/`: Components (landing, marketplace, developer, content, docs, layout)
  - `app/composables/`: Composables (auth, GSAP animations, cookie consent, card tilt, reduced motion)

**app-template/:**
- Purpose: Boilerplate for developers creating new Guildora apps
- Contains: Minimal app structure with example bot hooks, API, i18n, pages
- Key dirs: `src/api/`, `src/bot/`, `src/i18n/`, `src/pages/`

**guildai/:**
- Purpose: Example app demonstrating AI integration capabilities
- Contains: App with API, bot hooks, components, i18n, pages, utils, tests
- Key dirs: `src/api/`, `src/bot/`, `src/components/`, `src/pages/`, `src/utils/`

**voice-rooms/:**
- Purpose: Example app for voice room activity tracking
- Contains: Minimal app with bot hooks, API, i18n, pages
- Key dirs: `src/api/`, `src/bot/`, `src/i18n/`, `src/pages/`

## Key File Locations

**Entry Points:**
- `package.json`: Root dev orchestration
- `platform/package.json`: Platform monorepo scripts (build, dev, test, db:migrate, etc.)
- `platform/apps/hub/nuxt.config.ts`: Hub app configuration
- `platform/apps/web/nuxt.config.ts`: Web landing configuration
- `platform/apps/bot/src/index.ts`: Discord bot entry
- `platform/apps/matrix-bot/src/index.ts`: Matrix bot entry
- `marketplace/nuxt.config.ts`: Marketplace configuration

**Configuration:**
- `platform/turbo.json`: Turborepo task pipeline
- `platform/pnpm-workspace.yaml`: Workspace package definitions
- `platform/apps/hub/nuxt.config.ts`: Hub runtime config (auth, session, Discord, bot URL, MCP token, feature flags)
- `marketplace/nuxt.config.ts`: Marketplace runtime config (GitHub OAuth, AI review, Linear, session)

**Database:**
- `platform/packages/shared/src/db/schema.ts`: Platform DB schema (all tables)
- `platform/packages/shared/src/db/client.ts`: DB connection factory
- `platform/packages/shared/drizzle/migrations/`: Platform migration files
- `marketplace/server/db/schema.ts`: Marketplace DB schema
- `marketplace/server/db/index.ts`: Marketplace DB connection

**Core Logic:**
- `platform/apps/hub/server/utils/auth.ts`: Auth helpers and role guards
- `platform/apps/hub/server/utils/platformBridge.ts`: Hub-to-bot communication
- `platform/apps/hub/server/utils/platformConfig.ts`: Platform connection config resolution
- `platform/apps/hub/server/plugins/app-loader.ts`: App extension loader
- `platform/apps/bot/src/utils/app-hooks.ts`: Bot-side app hook executor
- `platform/apps/bot/src/utils/internal-sync-server.ts`: Bot internal HTTP API
- `platform/apps/hub/server/utils/community.ts`: Community management logic
- `platform/apps/hub/server/utils/membership-sync.ts`: Member synchronization
- `platform/apps/hub/server/utils/membership-cleanup.ts`: Member cleanup logic

**Testing:**
- `platform/apps/hub/tests/`: Playwright E2E tests
- `platform/apps/hub/server/utils/__tests__/`: Server utility unit tests
- `platform/apps/hub/server/api/__tests__/`: API endpoint tests
- `platform/apps/hub/app/composables/__tests__/`: Composable unit tests
- `platform/apps/bot/src/events/__tests__/`: Bot event handler tests
- `platform/apps/bot/src/interactions/__tests__/`: Bot interaction tests
- `platform/apps/bot/src/utils/__tests__/`: Bot utility tests
- `platform/packages/shared/src/__tests__/`: Shared package tests
- `platform/packages/shared/src/utils/__tests__/`: Shared utility tests
- `guildai/src/api/__tests__/`, `guildai/src/utils/__tests__/`: Example app tests

## Naming Conventions

**Files:**
- Vue components: PascalCase (`DevLoginBanner.vue`, `FlowBuilder.vue`)
- Composables: camelCase with `use` prefix (`useAuth.ts`, `useThemeColors.ts`)
- Server API routes: kebab-case with HTTP method suffix (`stats.get.ts`, `dev-login.post.ts`, `[id].delete.ts`)
- Server middleware: numbered prefix for ordering (`01-rate-limit.ts`, `02-csrf-check.ts`, `03-session.ts`)
- Server plugins: numbered prefix or descriptive name (`00-db-migrate.ts`, `app-loader.ts`, `membership-auto-sync.ts`)
- Utilities: kebab-case (`platform-bridge.ts`, `auth-session.ts`, `bot-bridge-error.ts`)
- Client middleware: kebab-case or camelCase (`auth.ts`, `mandatory-fields.global.ts`)

**Directories:**
- Feature-based grouping in components (`applications/`, `landing/`, `members/`, `profile/`, `sidebar/`)
- Domain-based grouping in API routes (`admin/`, `applications/`, `auth/`, `dashboard/`, `members/`)
- Dynamic route params: bracket notation (`[appId]/`, `[flowId]/`, `[locale]/`)

## Where to Add New Code

**New Hub Feature (e.g., new admin section):**
- API routes: `platform/apps/hub/server/api/admin/{feature-name}/`
- Server utils: `platform/apps/hub/server/utils/{feature-name}.ts`
- Pages: `platform/apps/hub/app/pages/{feature-name}/`
- Components: `platform/apps/hub/app/components/{feature-name}/`
- Composables: `platform/apps/hub/app/composables/use{FeatureName}.ts`
- Client middleware: `platform/apps/hub/app/middleware/{feature-name}.ts`
- Tests: Co-located `__tests__/` directories next to source files

**New Database Table:**
- Schema: Add table + relations to `platform/packages/shared/src/db/schema.ts`
- Types: Add type exports to `platform/packages/shared/src/types/` if needed
- Re-export from `platform/packages/shared/src/index.ts` if public
- Migration: Run `pnpm db:generate` then `pnpm db:migrate` from platform root

**New Shared Utility:**
- Implementation: `platform/packages/shared/src/utils/{utility-name}.ts`
- Export: Add to `platform/packages/shared/src/index.ts`
- Tests: `platform/packages/shared/src/utils/__tests__/{utility-name}.test.ts`

**New Bot Command:**
- Command: `platform/apps/bot/src/commands/{command-name}.ts`
- Register in `platform/apps/bot/src/index.ts` commands collection
- Deploy: `pnpm bot:deploy-commands`

**New Bot Event Handler:**
- Handler: `platform/apps/bot/src/events/{eventName}.ts`
- Register in `platform/apps/bot/src/index.ts`
- Tests: `platform/apps/bot/src/events/__tests__/`

**New Guildora App Extension:**
- Copy `app-template/` as starting point
- Implement bot hooks in `src/bot/`
- Add API endpoints in `src/api/`
- Add pages in `src/pages/`
- Add i18n in `src/i18n/`

**New Marketplace Feature:**
- API routes: `marketplace/server/api/{domain}/`
- Pages: `marketplace/app/pages/{feature}/`
- Components: `marketplace/app/components/{feature}/`
- Composables: `marketplace/app/composables/use{Feature}.ts`
- Server utils: `marketplace/server/utils/{feature}.ts`

**New Platform Package:**
- Create directory: `platform/packages/{package-name}/`
- Add `package.json` with `"name": "@guildora/{package-name}"`
- Automatically included via `pnpm-workspace.yaml` glob `packages/*`

## Special Directories

**platform/packages/shared/drizzle/migrations/:**
- Purpose: Auto-generated SQL migration files from Drizzle Kit
- Generated: Yes (via `pnpm db:generate`)
- Committed: Yes

**.alice/:**
- Purpose: Alice bot workspace files (plans, reports)
- Generated: Yes (by Alice bot agent)
- Committed: Varies

**platform/apps/hub/.nuxt/:**
- Purpose: Nuxt build cache and generated types
- Generated: Yes
- Committed: No

**platform/apps/hub/.output/:**
- Purpose: Nuxt production build output
- Generated: Yes
- Committed: No

**platform/.turbo/:**
- Purpose: Turborepo cache
- Generated: Yes
- Committed: No

**platform/.pw-browsers/:**
- Purpose: Playwright browser binaries for E2E testing
- Generated: Yes (downloaded)
- Committed: No

**platform/apps/hub/media/uploads/:**
- Purpose: User-uploaded files (avatars)
- Generated: Yes (user uploads)
- Committed: No

---

*Structure analysis: 2026-04-15*
