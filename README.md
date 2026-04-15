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
