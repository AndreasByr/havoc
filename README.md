# Guildora (Self-Hosting)

## Requirements

- Docker + Docker Compose
- Node.js `>=20`
- pnpm `>=10`
- A Discord application (OAuth + bot token)
- A reverse proxy setup using a Docker network (default network name: `caddy`)

## 1) Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- `APP_HOST`
- `HUB_HOST`
- `NUXT_PUBLIC_APP_URL`
- `NUXT_PUBLIC_HUB_URL`
- `NUXT_SESSION_PASSWORD` (strong, 32+ chars)
- `NUXT_OAUTH_DISCORD_CLIENT_ID`
- `NUXT_OAUTH_DISCORD_CLIENT_SECRET`
- `NUXT_OAUTH_DISCORD_REDIRECT_URI` (must be `https://<hub-domain>/api/auth/discord`)
- `SUPERADMIN_DISCORD_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `BOT_INTERNAL_TOKEN`
- `APPLICATION_TOKEN_SECRET`

Optional:

- `MCP_INTERNAL_TOKEN` (only needed if you run MCP integration)
- S3/R2/MinIO bucket vars (only needed for object storage)

## 2) Create Reverse-Proxy Docker Network

`docker-compose.yml` expects an external Docker network (default: `caddy`):

```bash
docker network create caddy
```

If you use another name, set `CADDY_NETWORK` in `.env`.

## 3) Start Database

```bash
docker compose up -d db
```

## 4) Initialize Schema and Seed Data

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
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

### Coolify (recommended for non-technical admins)

If you want the easiest path, use Coolify to run this repository as a managed Docker Compose app. You do not need to manually install a reverse proxy or write Docker commands.

#### 1) Before you start

- A running Coolify instance. If you still need one, follow the official install docs: https://coolify.io/docs
- A domain you control, plus two subdomains you can point to your server:
  - `community.example.com` (public landing page)
  - `hub.example.com` (member/admin hub)
- A Discord application and bot token from https://discord.com/developers/applications:
  1. Create an application.
  2. Add a bot user to that application.
  3. Copy the bot token for `DISCORD_BOT_TOKEN`.
  4. Configure OAuth redirect URL with this pattern from `.env.example`:
     `https://<HUB_HOST>/api/auth/discord` (example: `https://hub.example.com/api/auth/discord`)

#### 2) Create the project in Coolify

1. Create a new Coolify project for Guildora.
2. Add a new resource that deploys **Docker Compose from a Git repository**.
3. Set the repository URL to this repo and use branch `main`.
4. Set the compose file path to `docker-compose.yml`.

> Tip: Coolify UI wording can vary by version. Focus on the deployment intent above instead of exact button names.

#### 3) Configure environment variables

Add variables in Coolify grouped by purpose:

- **Hostnames + URLs** (where users access web + hub)
  - `APP_HOST`
  - `HUB_HOST`
  - `NUXT_PUBLIC_APP_URL`
  - `NUXT_PUBLIC_HUB_URL`

- **Database** (how services connect to PostgreSQL)
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL`

  Use `guildora-db:5432` as host inside `DATABASE_URL` (container-internal DNS), and make sure the password in `DATABASE_URL` exactly matches `POSTGRES_PASSWORD`.

- **Sessions (hard required)** (encrypts login sessions)
  - `NUXT_SESSION_PASSWORD`

  Use a random string with at least 32 characters. The hub refuses to start without this value.

- **Discord OAuth (for hub login)**
  - `NUXT_OAUTH_DISCORD_CLIENT_ID`
  - `NUXT_OAUTH_DISCORD_CLIENT_SECRET`
  - `NUXT_OAUTH_DISCORD_REDIRECT_URI`
  - `SUPERADMIN_DISCORD_ID`

- **Discord Bot** (bot login + internal auth)
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_GUILD_ID`
  - `BOT_INTERNAL_TOKEN`
  - `APPLICATION_TOKEN_SECRET`

The remaining variables in `.env.example` (for example S3/media storage, MCP token, sideloading toggles) are optional and can be added later.

#### 4) Deploy

Start the deployment in Coolify and wait until all services report healthy. On first deploy, this usually takes about 2–5 minutes because Docker images must be built.

#### 5) Point DNS at your server

Create `A` and/or `AAAA` records for `APP_HOST` and `HUB_HOST` so both names resolve to your Coolify host public IP.

After DNS resolves, the built-in `caddy` service automatically requests Let's Encrypt certificates.

#### 6) Complete the setup wizard

Open `https://<HUB_HOST>/setup` and complete the 3-step wizard:

1. Community Info
2. Platform Config
3. Admin Login

After successful admin login, the dashboard loads and the bot reconnects automatically (no container restart needed).

> Hot-reload path details were implemented in S01 (`POST /internal/bot/reload-credentials`).

> [!TIP]
> ### Troubleshooting
> - **Hub container exits immediately:** check logs for `[env-validate] FATAL` and add the missing required variable.
> - **`docker compose ps` shows bot as `(unhealthy)`:** verify `DISCORD_BOT_TOKEN` is valid and the bot is invited to `DISCORD_GUILD_ID`.
> - **TLS certificates are not issued:** confirm DNS records for `APP_HOST` and `HUB_HOST` already resolve to your Coolify host before first deploy.

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


## 5) Start Application Services

```bash
docker compose up -d --build web hub bot
```

## 6) Verify

- Web: `https://<APP_HOST>`
- Hub: `https://<HUB_HOST>`
- Bot internal API: port `3050` (internal, not public)

## Operations

### Update to latest code

```bash
git pull
docker compose up -d --build web hub bot
pnpm db:migrate
```

### Check logs

```bash
docker compose logs -f hub
docker compose logs -f web
docker compose logs -f bot
docker compose logs -f db
```

### Restart services

```bash
docker compose restart web hub bot
```

## Troubleshooting

### `Cannot connect to the Docker daemon`

Docker is not running. Start Docker Desktop/daemon and retry.

### `network caddy declared as external, but could not be found`

Create the network or set `CADDY_NETWORK` to your existing reverse-proxy network.

### Hub/Bot show `Failed query` or `ECONNREFUSED`

Database is unreachable or not initialized:

```bash
docker compose up -d db
pnpm db:migrate
pnpm db:seed
```

### Discord OAuth login fails

Verify:

- `NUXT_OAUTH_DISCORD_REDIRECT_URI` exactly matches Discord app settings
- Hub is reachable at `NUXT_PUBLIC_HUB_URL`
- Client ID/secret are correct

### Port already in use

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3003 -sTCP:LISTEN
lsof -nP -iTCP:3050 -sTCP:LISTEN
lsof -nP -iTCP:5433 -sTCP:LISTEN
```

Stop conflicting processes and restart.

## Documentation

- https://github.com/guildora/docs
- Self-hosting guide: https://github.com/guildora/docs/blob/main/for-hosters/setup.md

## License

[PolyForm Noncommercial 1.0.0](LICENSE)
