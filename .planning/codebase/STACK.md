# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript ^5.8.2 - Used across all apps and packages

**Secondary:**
- Vue 3 SFC (`.vue` files) - Frontend components in web, hub, marketplace
- SQL - Database migrations via Drizzle Kit

## Runtime

**Environment:**
- Node.js >=20.0.0 (currently v24.14.1)

**Package Manager:**
- pnpm 10.6.2 (declared in `platform/package.json` `packageManager` field; currently v10.33.0 installed)
- Lockfiles: `platform/pnpm-lock.yaml`, `marketplace/pnpm-lock.yaml`, root `pnpm-lock.yaml`

## Monorepo Structure

The project has a **two-level monorepo** layout:

**Root level** (`/package.json`):
- Lightweight root that runs `platform` and `marketplace` concurrently via `concurrently`
- Root devDependency: `concurrently@^9.1.2`

**Platform workspace** (`platform/pnpm-workspace.yaml`):
- Managed by **Turborepo** (`turbo@^2.5.0`)
- Config: `platform/turbo.json`
- Workspace packages: `apps/*` and `packages/*`

**Marketplace** (`marketplace/package.json`):
- Standalone Nuxt 4 app with its own `pnpm-lock.yaml`

## Frameworks

**Core:**
- Nuxt ^4.1.3 (platform web, hub) / ^4.4.2 (marketplace) - Full-stack Vue framework (SSR + API routes via Nitro)
- Vue ^3.5.0 - Frontend reactivity and components
- discord.js ^14.25.1 - Discord bot (`platform/apps/bot`)
- matrix-bot-sdk ^0.7.1 - Matrix bot (`platform/apps/matrix-bot`)

**Testing:**
- Vitest ^2.1.0 / ^3.1.1 - Unit and integration tests across platform packages
- Playwright ^1.59.1 - E2E/smoke tests in web, hub, marketplace
- `@nuxt/test-utils` ^3.14.0 - Nuxt-aware testing in hub

**Build/Dev:**
- Turborepo ^2.5.0 - Orchestrates build/dev/lint/test across platform workspace (`platform/turbo.json`)
- tsx ^4.19.3 - TypeScript execution for scripts and bot dev mode
- esbuild ^0.24.2 - Used by hub and bot for fast builds
- vue-tsc ^2.2.8 - Vue type checking

## Key Dependencies

**Critical:**
- `drizzle-orm` ^0.44.5 / ^0.45.2 - ORM for all database access (platform shared package + marketplace)
- `drizzle-kit` ^0.31.4 / ^0.31.10 - Migration generation and DB studio
- `nuxt-auth-utils` ^0.5.0 / ^0.5.29 - Session management and OAuth helpers (hub + marketplace)
- `zod` ^3.24.2 / ^3.25.0 - Schema validation (shared, hub, mcp-server)
- `postgres` ^3.4.7 - PostgreSQL client for platform shared (`drizzle-orm/postgres-js` driver)
- `pg` ^8.16.0 - PostgreSQL client for marketplace (`drizzle-orm/node-postgres` driver)

**Infrastructure:**
- `@aws-sdk/client-s3` ^3.1018.0 - S3-compatible media storage (hub)
- `@aws-sdk/s3-request-presigner` ^3.1018.0 - Presigned URLs for media uploads
- `@anthropic-ai/sdk` ^0.39.0 - AI code review for marketplace app submissions
- `@modelcontextprotocol/sdk` ^1.29.0 - MCP server for AI agent access to landing page config
- `sharp` ^0.33.5 - Image processing (hub)
- `consola` ^3.4.2 - Structured logging (bot)

**Frontend:**
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

**Linting/Formatting:**
- ESLint ^10.0.3 via `@nuxt/eslint` ^1.15.0 - Linting (web, hub)
- Prettier ^3.4.2 - Code formatting (web, hub)

## Configuration

**Environment:**
- `.env.example` at `platform/.env.example` - Reference for all required/optional env vars
- `.env`, `.env.local`, `.env.test`, `.env.tunnel` present in `platform/`
- Nuxt apps load env via `--dotenv ../../.env.local` (dev) or `--env-file` (production)
- Bot loads env via `dotenv` package

**Build:**
- `platform/turbo.json` - Turborepo task pipeline
- `platform/apps/web/nuxt.config.ts` - Web app Nuxt config
- `platform/apps/hub/nuxt.config.ts` - Hub app Nuxt config (most complex, includes auth, color mode, i18n)
- `marketplace/nuxt.config.ts` - Marketplace Nuxt config
- `platform/packages/shared/drizzle.config.ts` - Platform DB migration config
- `marketplace/drizzle.config.ts` - Marketplace DB migration config

## Platform Requirements

**Development:**
- Node.js >=20
- pnpm >=10
- PostgreSQL 16 (via Docker: `docker compose up db` from `platform/`)
- Dev server binds to `0.0.0.0` for Docker port forwarding

**Production:**
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

---

*Stack analysis: 2026-04-15*
