# Skill: Extensions And App Manifests

## Purpose

Work with the repository's current extension seam: stored app manifests, app navigation, and bot hook declarations.

## When To Use

- changing app-manifest parsing
- editing installed app behavior
- touching app sideloading or app navigation
- documenting extension capabilities and limitations

## Relevant Project Areas

- `packages/shared/src/types/app-manifest.ts`
- `apps/hub/server/utils/apps.ts`
- `apps/hub/server/utils/app-sideload.ts`
- `apps/hub/server/api/admin/apps/*`
- `apps/hub/server/api/apps/[appId]/_page-source.get.ts`
- `apps/hub/server/api/apps/[appId]/_source.get.ts`
- `apps/hub/app/pages/apps/[appId]/[...slug].vue`
- `apps/bot/src/utils/app-hooks.ts`

## Rules And Constraints

- manifests are validated through the shared Zod schema
- active apps affect navigation and bot hook registration
- sideload install bundles manifest-declared API handlers and bot hooks for runtime execution
- sideload runtime supports relative in-repo imports for bundled entrypoints, not arbitrary external package resolution
- **Vue SFC pages support relative imports** for `.vue`, `.ts`, `.js`, and `.json` files — files under `src/components/`, `src/composables/`, and `src/utils/` are auto-collected into the code bundle during sideloading
- the optional `includes` manifest field (array of repo-relative paths, max 50) allows apps to explicitly declare additional source files beyond auto-discovered directories
- client-side `.ts` imports are transpiled by vue3-sfc-loader's Babel pipeline — complex TypeScript features (const enums, namespace merging) are not supported
- the `_source` endpoint serves raw files from the code bundle with path traversal protection; it does not perform page-level role checks
- marketplace submission storage exists, but local marketplace review is not a complete product flow

## Step-By-Step Orientation

1. Read `docs/workflows/app-lifecycle.md`.
2. Read `docs/workflows/marketplace-submissions.md`.
3. Read `docs/subsystems/shared-package.md`.
4. Inspect the manifest parser and installed-app utility code.

## Docs References

- `docs/workflows/app-lifecycle.md`
- `docs/workflows/marketplace-submissions.md`
- `docs/subsystems/shared-package.md`

## Common Mistakes To Avoid

- assuming sideloaded runtime can resolve external package imports at execution time
- assuming all marketplace concepts are active product features
- forgetting to refresh the app registry after install-state changes
- using complex TypeScript features (const enums, namespace merging, decorators) in app source files loaded client-side — Babel transpilation does not support these
- forgetting that `.vue` sub-components also receive auto-imports (`useI18n`, `useAuth`, etc.) and `<NuxtLink>` → `<RouterLink>` replacement automatically
- assuming the `_source` endpoint only serves `.vue` files — it serves any file present in the code bundle
