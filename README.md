# Guildora

![CI](https://github.com/guildora/guildora/actions/workflows/ci.yml/badge.svg)
![Test](https://github.com/guildora/guildora/actions/workflows/test.yml/badge.svg)

> **Status: Experimental / Active Development**
> Guildora is under active development. APIs, database schema, and features may change without notice. Not recommended for production use yet.

Guildora is a monorepo for a Discord-centered community platform. It combines:

- **`apps/web`** — Nuxt 4 public landing page
- **`apps/hub`** — Nuxt 4 internal hub for members, moderation, admin, auth, and APIs
- **`apps/bot`** — Discord bot for voice tracking, guild sync, and setup helpers
- **`packages/shared`** — Shared TypeScript package with Drizzle schema, DB client, and cross-service types
- **`packages/app-sdk`** — TypeScript SDK types for sideloaded community apps

### App Extension System

Guildora supports community-built apps that extend the hub with custom pages, API routes, bot hooks, and slash commands. Apps are installed via sideloading (GitHub URL or local path) and run sandboxed within the platform. Vue SFC pages support relative imports for components, composables, and utilities. See the [developer docs](https://github.com/guildora/docs/tree/main/for-developers) for details.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Useful workspace scripts:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm bot:deploy-commands`

## Deployment

For self-hosting, Guildora currently supports two paths: `Coolify` (recommended for non-technical admins) and `Docker Compose` (for technical operators who manage their own Linux host). Full-stack deployment on `Vercel` is not supported; see the note below.

<!-- Coolify subsection added in T02 -->

### Docker Compose (self-managed)

#### Prerequisites

- A Linux host with `Docker` and `Docker Compose v2`
- A domain where `APP_HOST` and `HUB_HOST` DNS records (`A`/`AAAA`) point to your host IP

#### Runbook

1. Clone the repository.
2. Copy environment defaults:

```bash
cp .env.example .env
```

3. Fill required values in `.env`.
4. Start the stack:

```bash
docker compose up -d --build
```

5. Verify services are healthy:

```bash
docker compose ps
```

All services (including `guildora-db`, `web`, `hub`, `bot`, and `caddy`) should show healthy/running state.

6. Tail hub logs when needed:

```bash
docker compose logs -f hub
```

7. Open your hub URL and complete the `/setup` wizard.

> [!IMPORTANT]
> **Hard required for hub startup**
> The hub validates exactly these two env vars on boot: `DATABASE_URL` and `NUXT_SESSION_PASSWORD`.
> If either is missing/empty, the env validation plugin throws and the `hub` process exits non-zero.

#### Operationally required for a usable platform

- `APP_HOST`
- `HUB_HOST`
- `NUXT_PUBLIC_APP_URL`
- `NUXT_PUBLIC_HUB_URL`
- `POSTGRES_PASSWORD`
- `NUXT_OAUTH_DISCORD_CLIENT_ID`
- `NUXT_OAUTH_DISCORD_CLIENT_SECRET`
- `NUXT_OAUTH_DISCORD_REDIRECT_URI`
- `SUPERADMIN_DISCORD_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `BOT_INTERNAL_TOKEN`
- `APPLICATION_TOKEN_SECRET`

Migrations run automatically on `hub` startup, so no manual `pnpm db:migrate` is needed in production.

`caddy` is built into the compose stack (no external reverse proxy required) and handles TLS via Let's Encrypt once DNS points to your host.

#### Updating

```bash
git pull && docker compose up -d --build
```

#### Persistence

Named volumes `db_data`, `caddy_data`, and `caddy_config` persist state across `docker compose down` / `docker compose up` cycles. Use `docker compose down -v` only when you intentionally want to wipe persisted data.

### Vercel (not supported for full stack)

Guildora requires a long-running PostgreSQL database, a continuously running Discord bot process, and compose-based internal service networking between `web`, `hub`, `bot`, and `guildora-db`.
`Vercel` does not provide this full runtime model for a single deployment.
The public landing app in `apps/web` could be hosted on `Vercel` in isolation.
The full platform (`hub` + `bot` + `db`) must run on a self-hosted environment.

## Contributing

`main` is protected — no direct pushes. Development flow:

```
Feature branch → PR on dev → PR on main → Tag → Release
```

To create a release:

```bash
git tag v0.1.0-alpha && git push --tags
```

The release pipeline validates, publishes a GitHub Pre-release, and pushes Docker images automatically.

## Local Testing

### Hub unit tests (also run in CI)

```bash
pnpm --filter @guildora/hub test
```

### Landing integration tests (local only)

Requires web app on port 3000 and CMS on port 3002.

```bash
pnpm dev
node --test apps/web/tests/landing.test.mjs
```

### Hub E2E tests (local only)

Requires all services running, PostgreSQL, and Discord credentials.

```bash
pnpm dev
# see apps/hub/e2e/README.md for setup
```

## Documentation

All documentation lives in the central docs repository: **[guildora/docs](https://github.com/guildora/docs)**

- [Architecture](https://github.com/guildora/docs/blob/main/architecture-systems/guildora/index.md)
- [Developer Guide (Apps)](https://github.com/guildora/docs/tree/main/for-developers)
- [Design System](https://github.com/guildora/docs/blob/main/DESIGN_SYSTEM.md)
- [Workflows](https://github.com/guildora/docs/blob/main/architecture-systems/guildora/workflows/)
- [AI Working Context](./ai/README.md)

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for non-commercial use (self-hosting, modification, and forking allowed; commercial use prohibited)
