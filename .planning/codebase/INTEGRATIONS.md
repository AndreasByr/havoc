# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

**Discord:**
- Discord OAuth2 - User authentication for hub login
  - SDK/Client: Manual OAuth2 flow via `$fetch` to `https://discord.com/api/oauth2/*`
  - Auth: `NUXT_OAUTH_DISCORD_CLIENT_ID`, `NUXT_OAUTH_DISCORD_CLIENT_SECRET`
  - Redirect URI: `NUXT_OAUTH_DISCORD_REDIRECT_URI`
  - Scopes: `identify email`
  - Implementation: `platform/apps/hub/server/api/auth/discord.get.ts`

- Discord Bot API - Guild management, member lookups, slash commands, voice state tracking
  - SDK/Client: `discord.js` ^14.25.1
  - Auth: `DISCORD_BOT_TOKEN`
  - Config: `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
  - Intents: Guilds, GuildMembers, GuildVoiceStates, GuildMessages, MessageContent
  - Implementation: `platform/apps/bot/src/index.ts`

**Matrix:**
- Matrix Client-Server API - User authentication via SSO/token login
  - SDK/Client: Manual `$fetch` to homeserver `/_matrix/client/v3/*` endpoints
  - Auth: Homeserver URL stored in `platform_connections` DB table
  - Implementation: `platform/apps/hub/server/api/auth/matrix.get.ts`

- Matrix Bot - Room messaging and member sync
  - SDK/Client: `matrix-bot-sdk` ^0.7.1
  - Implementation: `platform/apps/matrix-bot/src/`

**Anthropic Claude:**
- AI Code Review - Automated review of marketplace app submissions
  - SDK/Client: `@anthropic-ai/sdk` ^0.39.0
  - Auth: `NUXT_AI_REVIEW_API_KEY`
  - Model: Configurable via `NUXT_AI_REVIEW_MODEL` (default: `claude-sonnet-4-20250514`)
  - Implementation: `marketplace/server/utils/ai-review.ts`

**GitHub:**
- GitHub API - Repository inspection, org membership checks, file fetching for app reviews
  - SDK/Client: Manual `$fetch` to `https://api.github.com/*`
  - Auth: `NUXT_GITHUB_TOKEN` (PAT)
  - Config: `NUXT_GITHUB_ORG_NAME`
  - Implementation: `marketplace/server/utils/github.ts`

- GitHub OAuth - Developer authentication for marketplace
  - Auth: `NUXT_OAUTH_GITHUB_CLIENT_ID`, `NUXT_OAUTH_GITHUB_CLIENT_SECRET`
  - Implementation: Via `nuxt-auth-utils` OAuth handler

**Linear:**
- Linear GraphQL API - Issue tracking for marketplace app submissions
  - SDK/Client: Manual GraphQL via `$fetch` to `https://api.linear.app/graphql`
  - Auth: `NUXT_LINEAR_API_KEY`
  - Operations: Create issues, add comments, update issue status
  - Implementation: `marketplace/server/utils/linear.ts`, `marketplace/server/utils/linear-constants.ts`

**Google Analytics:**
- GA4 tracking on marketplace
  - Config: `NUXT_PUBLIC_GA_ID` (default: `G-HESH2839SV`)
  - Implementation: `marketplace/app/plugins/analytics.client.ts`

## Data Storage

**Databases:**
- PostgreSQL 16
  - Platform DB: Single `guildora` database for all platform apps
    - Connection: `DATABASE_URL` env var
    - Client: `drizzle-orm/postgres-js` with `postgres` driver
    - Schema: `platform/packages/shared/src/db/schema.ts`
    - Migrations: `pnpm db:generate` + `pnpm db:migrate` (via `platform/packages/shared`)
    - Config: `platform/packages/shared/drizzle.config.ts`
    - SSL: Configurable via `DATABASE_SSL` (true/false)
    - DB client factory: `platform/packages/shared/src/db/client.ts`
  - Marketplace DB: Separate PostgreSQL database
    - Connection: `NUXT_DATABASE_URL` or `DATABASE_URL`
    - Client: `drizzle-orm/node-postgres` with `pg` pool
    - Schema: `marketplace/server/db/schema.ts`
    - Migrations: `pnpm db:generate` + `pnpm db:migrate` (via marketplace root)
    - Config: `marketplace/drizzle.config.ts`
    - DB singleton: `marketplace/server/db/index.ts`
  - Docker: `guildora-db` container, `postgres:16` image
    - Internal: `guildora-db:5432` (within Docker network `guildora_internal`)
    - Host-mapped: `localhost:5433`

**File Storage:**
- S3-compatible object storage (optional, for media uploads)
  - Providers: AWS S3, Cloudflare R2, MinIO
  - Config: `BUCKET_PROVIDER`, `BUCKET_ENDPOINT`, `BUCKET_REGION`, `BUCKET_NAME`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY`, `BUCKET_PUBLIC_URL`, `BUCKET_PATH_PREFIX`
  - Fallback: Local filesystem when S3 not configured
  - Implementation: `platform/apps/hub/server/utils/media.ts`

**Caching:**
- None (no Redis or dedicated cache layer detected)

## Authentication & Identity

**Hub (Platform):**
- Discord OAuth2 (primary login)
  - Session: `nuxt-auth-utils` cookie-based sessions
  - Session password: `NUXT_SESSION_PASSWORD` (32+ char random string)
  - Session max age: 7 days
  - Cookie config: httpOnly, sameSite=lax, secure auto-detected from hub URL
  - Dev bypass: `NUXT_AUTH_DEV_BYPASS=true` skips OAuth for superadmin
  - Superadmin: `SUPERADMIN_DISCORD_ID` grants admin role on first login
  - Implementation: `platform/apps/hub/server/api/auth/discord.get.ts`

- Matrix SSO (secondary login)
  - Flow: Redirects to Matrix homeserver SSO, exchanges login token
  - Account linking: Supports linking Matrix to existing Discord account
  - Implementation: `platform/apps/hub/server/api/auth/matrix.get.ts`

- Platform user system: `platform/apps/hub/server/utils/platformUser.ts` handles multi-platform identity

**Marketplace:**
- GitHub OAuth (developer login)
  - Session: `nuxt-auth-utils` cookie-based sessions
  - Org membership check gates admin access
  - Implementation: `marketplace/server/utils/auth.ts`

**Internal Auth:**
- Bot internal API: `BOT_INTERNAL_TOKEN` shared secret for hub-to-bot HTTP calls
- MCP internal API: `MCP_INTERNAL_TOKEN` shared secret for MCP server-to-hub calls
- Application tokens: `APPLICATION_TOKEN_SECRET` for signing app-to-hub tokens

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc. detected)

**Logs:**
- `consola` for structured logging in bot (`platform/apps/bot/src/utils/logger.ts`)
- `console.log` / `console.error` / `console.warn` elsewhere

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker on homeserver "Arctic"
- Caddy reverse proxy (external Docker network)
- Cloudflare Tunnel for HTTPS ingress

**CI Pipeline:**
- GitHub Actions: `.github/workflows/guildai-ci.yml` (for guildai package only)
- No CI detected for platform or marketplace

**Docker:**
- `platform/docker-compose.yml` defines production services: db, web, hub, bot
- `platform/docker-compose.override.yml` for local overrides
- Individual Dockerfiles: `platform/apps/web/Dockerfile`, `platform/apps/hub/Dockerfile`, `platform/apps/bot/Dockerfile`

## Environment Configuration

**Required env vars (platform):**
- `DATABASE_URL` - PostgreSQL connection string
- `NUXT_SESSION_PASSWORD` - Session encryption key
- `NUXT_OAUTH_DISCORD_CLIENT_ID` - Discord OAuth app ID
- `NUXT_OAUTH_DISCORD_CLIENT_SECRET` - Discord OAuth secret
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application ID
- `DISCORD_GUILD_ID` - Target Discord guild
- `BOT_INTERNAL_TOKEN` - Hub-to-bot auth token
- `NUXT_PUBLIC_APP_URL` - Public web URL
- `NUXT_PUBLIC_HUB_URL` - Public hub URL

**Required env vars (marketplace):**
- `NUXT_DATABASE_URL` or `DATABASE_URL` - PostgreSQL connection
- `NUXT_SESSION_PASSWORD` - Session encryption
- `NUXT_OAUTH_GITHUB_CLIENT_ID` - GitHub OAuth
- `NUXT_OAUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth

**Optional env vars:**
- `BUCKET_*` - S3-compatible storage (7 vars)
- `NUXT_LINEAR_API_KEY` - Linear issue tracking
- `NUXT_AI_REVIEW_API_KEY` - Anthropic API for code review
- `NUXT_GITHUB_TOKEN` - GitHub API access
- `MCP_INTERNAL_TOKEN` - MCP server auth
- `APPLICATION_TOKEN_SECRET` - App token signing
- `SUPERADMIN_DISCORD_ID` - Initial admin user
- `NUXT_PUBLIC_GA_ID` - Google Analytics

**Secrets location:**
- `.env` files in `platform/` directory (gitignored)
- Reference: `platform/.env.example`

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/github` (marketplace) - GitHub push/release events trigger app submission updates and AI reviews
  - Verifies `x-hub-signature-256` with per-app webhook secret
  - Implementation: `marketplace/server/api/webhooks/github.post.ts`

**Outgoing:**
- None detected

## Internal Service Communication

**Hub <-> Bot bridge:**
- Hub calls bot via HTTP at `BOT_INTERNAL_URL` (default `http://bot:3050`)
- Authenticated with `BOT_INTERNAL_TOKEN` bearer token
- Used for: fetching guild members, guild roles, deploying app commands
- Implementation: `platform/apps/hub/server/utils/botSync.ts`

**MCP Server <-> Hub:**
- MCP server calls hub internal API via HTTP at `MCP_HUB_URL`
- Authenticated with `MCP_INTERNAL_TOKEN` bearer token
- Used for: AI agent access to landing page configuration
- Implementation: `platform/packages/mcp-server/src/index.ts`

**Hub internal API:**
- `platform/apps/hub/server/api/internal/` - Endpoints for bot and MCP server

---

*Integration audit: 2026-04-15*
