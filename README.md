# Guildora

> **Status: Experimental / Active Development**
> Guildora is under active development. APIs, database schema, and features may change without notice. Not recommended for production use yet.

Guildora is a monorepo for a Discord-centered community platform. It combines:

- **`apps/web`** — Nuxt 4 public landing page
- **`apps/hub`** — Nuxt 4 internal hub for members, moderation, admin, auth, and APIs
- **`apps/cms`** — Payload CMS 3 / Next.js for content authoring
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
- `pnpm --filter @guildora/cms seed` — seed CMS with community content

## Documentation

All documentation lives in the central docs repository: **[guildora/docs](https://github.com/guildora/docs)**

- [Architecture](https://github.com/guildora/docs/blob/main/architecture-systems/guildora/index.md)
- [Developer Guide (Apps)](https://github.com/guildora/docs/tree/main/for-developers)
- [Design System](https://github.com/guildora/docs/blob/main/DESIGN_SYSTEM.md)
- [Workflows](https://github.com/guildora/docs/blob/main/architecture-systems/guildora/workflows/)
- [AI Working Context](./ai/README.md)

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for non-commercial use (self-hosting, modification, and forking allowed; commercial use prohibited)
