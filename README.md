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
