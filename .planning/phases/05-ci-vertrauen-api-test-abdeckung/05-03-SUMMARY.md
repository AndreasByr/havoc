---
phase: "05"
plan: "03"
subsystem: hub-lint
tags: [eslint, typescript, vue, test-quality, ci]
dependency-graph:
  requires: []
  provides: [hub-lint-clean]
  affects: [hub-ci, hub-tests]
tech-stack:
  added: []
  patterns:
    - "catch (e: unknown) with typed cast instead of catch (e: any)"
    - "Record<string, unknown> for mock DB chains instead of any"
    - "(resolve: (v: unknown) => unknown) for thenable mock chains instead of Function type"
    - "as ReturnType<typeof getDb> cast for mock DB instances"
    - "local ref + watch pattern for vue/no-mutating-props"
    - "native <style> element instead of <component :is=\"'style'\"> for vue/no-v-text-v-html-on-component"
    - "rest spread destructuring instead of delete obj[key] for no-dynamic-delete"
key-files:
  created: []
  modified:
    - apps/hub/app/components/applications/flow-builder/FlowBuilderTour.vue
    - apps/hub/app/components/applications/flow-builder/FlowNodeSidebar.vue
    - apps/hub/app/components/applications/flow-builder/FlowToolbar.vue
    - apps/hub/app/components/applications/flow-builder/SimpleFormBuilder.vue
    - apps/hub/app/components/applications/flow-builder/SimpleFormSection.vue
    - apps/hub/app/components/landing/LandingPreview.vue
    - apps/hub/app/pages/landing/settings.vue
    - apps/hub/server/utils/__tests__/test-helpers.ts
    - apps/hub/server/api/__tests__/admin-apps.spec.ts
    - apps/hub/server/api/__tests__/admin-operations.spec.ts
    - apps/hub/server/api/__tests__/admin-platforms.spec.ts
    - apps/hub/server/api/__tests__/admin-users.spec.ts
    - apps/hub/server/api/__tests__/application-flow.spec.ts
    - apps/hub/server/api/__tests__/member-profile.spec.ts
    - apps/hub/server/api/admin/apps/__tests__/audit-log.spec.ts
    - apps/hub/server/utils/__tests__/auth-session.spec.ts
    - apps/hub/server/utils/__tests__/auth.spec.ts
    - apps/hub/server/utils/__tests__/internal-auth.spec.ts
    - apps/hub/server/utils/__tests__/permission-matrix.spec.ts
    - apps/hub/server/utils/__tests__/platformConfig.spec.ts
    - apps/hub/server/utils/__tests__/platformUser.spec.ts
    - apps/hub/server/utils/__tests__/rate-limit.spec.ts
    - apps/hub/server/utils/__tests__/session-rotation.spec.ts
decisions:
  - "Use (resolve: (v: unknown) => unknown) for Drizzle ORM mock chain then() callbacks — avoids Function ban-type while preserving mock thenable contract"
  - "Use Record<string,unknown> for mock chain objects — allows vi.fn() assignments without index signature errors"
  - "Use as ReturnType<typeof getDb> cast for mock DB return values — preserves type contract without introducing any"
  - "Prefix unused-but-required variables with _ (e.g. _mocks, _seoVisible) instead of deleting them — satisfies no-unused-vars while keeping semantic context"
  - "Use rest spread for no-dynamic-delete: const { [key]: _removed, ...rest } = obj pattern"
metrics:
  duration: "~90 minutes"
  completed: "2026-04-18"
  tasks: 1
  files: 83
---

# Phase 05 Plan 03: ESLint Zero-Error Cleanup Summary

Fixed all 257 ESLint errors in `@guildora/hub` so that `pnpm --filter @guildora/hub lint` exits 0. No file-level eslint-disable comments were used — every error was fixed in actual code.

## What Was Built

Fixed all ESLint errors across 83 files in the Hub app. `pnpm lint` now exits 0 (1 pre-existing warning remains: `vue/require-default-prop` in `ProfileEditor.vue` — not introduced by this plan). All 291 tests continue to pass.

## Error Categories Fixed

### @typescript-eslint/unified-signatures (Vue defineEmits)
Collapsed overloaded emit signatures into union types in 10 Vue components:
- `FlowBuilderTour`, `FlowToolbar`, `SimpleFormBuilder`, `SimpleFormSection`, `OnboardingTour`: `(e: "next"): void; (e: "skip"): void` → `(e: "next" | "skip"): void`
- `FlowNodeSidebar`: merged `delete-node` and `ungroup-node` overloads
- `BulkDeleteDialog`, `BulkDiscordRolesDialog`, `BulkRoleChangeDialog`: `(event: "close" | "done"): void`
- `MemberDetailsModal`: `(event: "close" | "saved"): void`

### vue/no-mutating-props
`SimpleFormSection.vue` line 107: introduced `const localTitle = ref(props.section.title)` + `watch(() => props.section.title, ...)` pattern so the input binds to a local reactive copy instead of directly mutating the prop.

### vue/no-v-text-v-html-on-component
`LandingPreview.vue`: changed `<component :is="'style'" v-text="...">` to `<style v-text="...">` — the rule only fires on Vue components, not native HTML elements.

### @typescript-eslint/no-dynamic-delete
`landing/settings.vue` `clearColorOverride` and `restoreDefaultColors`: replaced `delete obj[key]` with rest spread destructuring:
```typescript
const { [key]: _removed, ...rest } = obj;
return rest;
```

### @typescript-eslint/no-explicit-any (production code)
- `landing/editor.vue`: removed unused `LANDING_COLOR_KEYS`, `isValidHexColor`, `TEMPLATE_COLOR_DEFAULTS` imports and associated dead code
- `applications/flows/index.vue`: `catch (e: any)` → `catch (e: unknown)` with typed access
- Various server utils: removed unused imports (`eq`, `sql`, `isNotNull`, `coerceProfileNameFromRaw`, `PlatformCredentials`, `CleanupCondition`, `readFile`, `extname`, `relative`)

### @typescript-eslint/no-explicit-any (test files)
All 16 test spec files fixed:
- DB chain mocks: `const chain: any` → `const chain: Record<string, unknown>`
- Thenable chains: `(resolve: Function)` → `(resolve: (v: unknown) => unknown)`
- Mock return values: `mockReturnValue(db as any)` → `mockReturnValue(db as ReturnType<typeof getDb>)`
- Error access: `catch (e: any)` → `catch (e: unknown)` with `const err = e as { statusCode?: number }`
- `globalThis.readBody as any` → `globalThis.readBody as ReturnType<typeof vi.fn>`

### @typescript-eslint/no-unused-vars
Removed unused imports, variables, and destructures across ~40 files:
- Vue imports: `onMounted`, `onUnmounted`, `watch`, `LinearizedStep`, `hasOptions`, etc.
- Composable destructures: `logout`, `user`, `refresh`, `pending: fetchPending`
- Server imports: `eq`, `sql`, `isNotNull`, `coerceProfileNameFromRaw`
- Test imports: `buildSessionUser`, `AppSession`, `createAuthenticatedEvent`
- Renamed `mocks` → `_mocks` in `platformUser.spec.ts`, `seoVisible` → `_seoVisible` in `audit-landing.spec.ts`
- Removed unused `response` assignment in `dev-login.spec.ts`

### @typescript-eslint/ban-types (Function)
`test-helpers.ts` lines 121, 134: `(handler: Function)` → `(handler: (...args: unknown[]) => unknown)`

## Commits

| Hash | Description |
|------|-------------|
| f9ea9c9 | fix(05-03): resolve ESLint errors in Vue components |
| cc96161 | fix(05-03): resolve ESLint errors in composables and pages |
| 306e12c | fix(05-03): resolve remaining ESLint errors in Vue components and pages |
| 480705d | fix(05-03): resolve ESLint errors in server API routes and utils |
| 393043b | fix(05-03): resolve ESLint errors in all test spec files |

## Verification

- `pnpm --filter @guildora/hub lint` exits 0 (1 pre-existing warning, 0 errors)
- `pnpm --filter @guildora/hub test --run`: 291/291 tests pass, 36/36 test files pass

## Deviations from Plan

None — plan executed exactly as written. All errors fixed with actual code changes; no `/* eslint-disable */` comments used.

## Known Stubs

None introduced by this plan.

## Threat Flags

None — this plan only modified ESLint error patterns (type annotations, unused imports). No new network endpoints, auth paths, or schema changes were introduced.

## Self-Check: PASSED

All commits verified in git log. Lint exits 0. Tests pass 291/291.
