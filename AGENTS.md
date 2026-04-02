# Guildora – Context for AI and Agents

Guildora is a community platform with a public landing page, internal hub, Discord bot, MCP server, and a shared Postgres database with a Drizzle schema.

## Structure

- **apps/web** – Nuxt 4, public landing page with block-component rendering from Hub API, login CTA, and OAuth redirect shim at `server/api/auth/discord.get.ts`.
- **apps/hub** – Nuxt 4, internal user UI with unified `/settings` section; Nitro API at `server/api/`; real Discord OAuth session logic; landing page admin editor at `/settings/landing`.
- **apps/bot** – Discord bot; voice tracking, guild sync, slash command setup, and internal sync server.
- **packages/shared** – Drizzle schema, types, Zod app manifest, DB client, migrations, seeds, and shared utilities.
- **packages/mcp-server** – MCP server for AI-driven landing page editing; communicates with Hub API via internal token auth.

## Roles (Permissions)

- **temporary**, **user**, **moderator**, **admin**, **superadmin**.
- Sessions canonically contain `permissionRoles`.
- `roles` is legacy compatibility only and not the primary source.
- Community roles (e.g. applicant, candidate, member) are domain-level; each maps to exactly one permission role.

## Key Conventions

- **API:** Method via file suffix (`.get`, `.post`, `.put`, `.delete`).
- **Auth:** Server-side via `requireSession`, `requireModeratorSession`, `requireAdminSession`, or `requireRole(...)`.
- **Landing vs. Hub:** `apps/web` stays public; internal workflows and operational APIs belong in `apps/hub`.
- **OAuth:** The real Discord OAuth callback logic lives in `apps/hub/server/api/auth/discord.get.ts`. The landing route at `apps/web/server/api/auth/discord.get.ts` only redirects.
- **Application Flows** = node-based application system (`applicationFlows`, `applications` tables). Flow builder at `/applications/flows`, public form at `/apply/:flowId/:token`, review at `/applications/open`, archive at `/applications/archive`. Two editor modes: **Simple Mode** (default for new flows) is a linear section-based form builder; **Advanced Mode** uses Vue Flow for a visual graph editor with conditional branching. The `editor_mode` column tracks which mode a flow uses. Bidirectional switching is possible (Advanced→Simple only when no branches/aborts). Both modes produce the same `flow_json` (ApplicationFlowGraph). DB-backed tokens for security, `linearizeFlowGraph()` from `packages/shared` for isomorphic flow traversal.
- **Legacy Applications** = old mod-area `profiles.custom_fields.applicationStatus` system (deprecated, will be removed once all communities migrate).
- **Submissions** = marketplace app submissions (`app_marketplace_submissions`); local full-review flow is not active yet.
- **App Component Imports** = sideloaded app pages (Vue SFCs) support relative imports for `.vue`, `.ts`, `.js`, and `.json` files. Files under `src/components/`, `src/composables/`, and `src/utils/` are auto-collected during sideloading. Apps can declare additional files via the `includes` manifest field. Client-side TypeScript is transpiled via Babel (no const enums or namespace merging).
- **Documentation:** Canonical docs live at https://github.com/guildora/docs — see references below.

## Documentation

All platform documentation: https://github.com/guildora/docs

Key references for this repo:

- Architecture: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/architecture.md
- Domain model: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/domain-model.md
- API contracts: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/api-contracts.md
- Permissions matrix: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/permissions-matrix.md
- Routing: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/routing-and-navigation.md
- Development workflow: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/development-workflow.md
- i18n architecture: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/i18n-architecture.md
- Design system: https://github.com/guildora/docs/blob/main/DESIGN_SYSTEM.md
- Workflows: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/workflows/

Deployed docs (accessible from any system): https://guildora.github.io/docs — Claude Code agents can fetch any page directly via WebFetch.

## Design System

- **Global reference:** https://github.com/guildora/docs/blob/main/DESIGN_SYSTEM.md — single source of truth for all design tokens.
- **Hub-specific docs:** https://github.com/guildora/docs/blob/main/architecture-systems/guildora/design-system.md
- **Themes:** `guildora-dark` (default) and `guildora-light` (Hub only). Landing is dark-only.
- **Appearance preference:** `appearancePreference` lives in `profiles.custom_fields`.
- **Font:** DM Sans (400, 500, 600, 700). Not Nunito (deprecated).
- **Default accent:** `#7C3AED` (Violet). Hub users can customize their community colors via the dynamic theme system in `apps/hub/utils/theme-colors.ts`.
- **Landing accent:** `#7C3AED` (Violet, matching hub default).
- **Component path:** `apps/hub/app/components/ui/` — `Ui*` prefixed components (UiButton, UiInput, etc.).
- **Buttons (required, internal):** All buttons in the internal hub must use the UI components from `apps/hub/app/components/ui/`.
- **Buttons (exception, external):** Public landing page layouts are exempt from this button requirement.
- **Shadows:** Subtle only (`--shadow-sm/md/lg`). No neuomorphism.
- **Surfaces must NOT have visible borders.** Cards, panels, and container surfaces rely solely on background color differences (`--color-surface-0` through `--color-surface-5`) and `box-shadow` for depth and separation. Do not add `border: 1px solid var(--color-line)` or similar to any surface/card/panel. The only allowed uses of `border` with `var(--color-line)` are **internal section dividers** inside a surface (e.g., `border-bottom` between list items or header/body/footer sections within a panel). Outer container borders are never used.
- **Border radius:** 8px buttons, 12px cards, 16px modals. No sharp corners (0px) or pill buttons (9999px).
- **Rule:** No functional changes in styling PRs unless explicitly approved.

## i18n Rules (Required)

- All new UI texts, labels, buttons, hints, status messages, and ARIA texts must go through the translation system.
- New keys must be maintained in at least `de` and `en`.
- Community default locale (`community_settings.default_locale`) is the fallback for users without their own preference.
- User preference (`profiles.locale_preference`) takes precedence once saved.
- Language switching in the hub only after successful persistence of the preference (`PUT /api/profile/locale`).
- Landing (`/`) stays public and manages locale routing separately from the hub.
- Reference: https://github.com/guildora/docs/blob/main/architecture-systems/guildora/i18n-architecture.md

## Commit Recommendations for AI Agents (Required)

- AI agents should actively recommend commits, even if the user does not explicitly ask.
- A recommendation should be made when a meaningful intermediate state is reached (completed mini-task, bug fix, refactor block, i18n block, styling block without functional change).
- A recommendation should be made before risky changes (larger refactor, data model/schema change, routing/auth restructure).
- A recommendation should be made after approximately 30–90 minutes of continuous work at the latest.
- A recommendation should be made before a break or end of thread.
- No commit recommendation for purely experimental or obviously incomplete states, except as an explicit `wip:` commit.
- Always phrase the recommendation concretely: `Commit now`, `Wait a bit longer`, or `WIP commit makes sense`.
- With a commit recommendation always suggest an appropriate commit message (Conventional Commits, e.g. `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `style:`, `test:`).
- When multiple topics have been changed, the AI should recommend split commits (by logically related blocks).
