# Codebase Concerns

**Analysis Date:** 2026-04-15

## Tech Debt

**Massive Migration Fixup File:**
- Issue: `run-migrations.ts` (447 lines) contains a growing collection of idempotent SQL fixups that run on every startup alongside Drizzle migrations. This is a parallel schema management system that bypasses the migration framework.
- Files: `platform/packages/shared/src/db/run-migrations.ts`
- Impact: Schema changes are split between Drizzle migrations (45 SQL files in `platform/packages/shared/drizzle/migrations/`) and inline fixups. Makes it impossible to reason about which schema state the DB is in. Fixups accumulate indefinitely, adding startup latency.
- Fix approach: Consolidate fixups into proper Drizzle migrations. Create a "baseline" migration that includes all current fixups, then remove the inline SQL. Add a versioning mechanism to skip already-applied fixups.

**Duplicate Migration Fixup in Nitro Plugin:**
- Issue: The `00-db-migrate.ts` Nitro plugin duplicates a "gaming" template cleanup that already exists in `run-migrations.ts`.
- Files: `platform/apps/hub/server/plugins/00-db-migrate.ts` (lines 93-106), `platform/packages/shared/src/db/run-migrations.ts` (lines 430-438)
- Impact: Redundant SQL on every startup. Confusing to maintainers about which file is authoritative.
- Fix approach: Remove the duplicate fixup from the Nitro plugin; let `run-migrations.ts` handle all fixups.

**GuildAI Bot Hooks Monolith:**
- Issue: `hooks.ts` is 1,588 lines of self-contained code with zero imports. It runs inside `new Function()` so all logic (AI calls, permission resolution, conversation management, media handling, roster building) must be inlined. This makes it the largest and most complex file in the codebase.
- Files: `guildai/src/bot/hooks.ts`
- Impact: Extremely difficult to test, maintain, or refactor. No type checking at runtime. Duplicates permission logic that exists in the platform. Any bug requires understanding the entire 1,588-line context.
- Fix approach: Long-term, consider an app SDK that allows structured imports. Short-term, break into clearly documented sections with consistent internal interfaces.

**In-Memory Rate Limiting (Not Horizontally Scalable):**
- Issue: Both the platform hub and the marketplace use in-memory `Map<string, WindowEntry>` for rate limiting. This is explicitly documented as a known limitation.
- Files: `platform/apps/hub/server/utils/rate-limit.ts`, `marketplace/server/middleware/rate-limit.ts`
- Impact: Rate limits are per-process. Horizontal scaling (multiple instances) makes rate limiting ineffective. Each instance has its own counter.
- Fix approach: Replace with Redis-backed rate limiting (as noted in the marketplace TODO). Share a single Redis store across the hub and marketplace.

**Incomplete Matrix Bot Integration:**
- Issue: Matrix bot event handlers contain TODO comments for emitting app hooks. Currently they only log messages to console.
- Files: `platform/apps/matrix-bot/src/events/roomMessage.ts` (line 28), `platform/apps/matrix-bot/src/events/roomMember.ts` (line 36)
- Impact: Matrix platform support is incomplete. The bot detects events but does not forward them to installed apps via the hook system, making Matrix a non-functional platform for app hooks.
- Fix approach: Implement hook emission following the Discord bot pattern in `platform/apps/bot/src/events/messageCreate.ts`.

**Large Vue Page Components:**
- Issue: Several page-level Vue components exceed 500 lines, mixing business logic, UI rendering, and API calls.
- Files: `platform/apps/hub/app/pages/settings/permissions.vue` (1,257 lines), `platform/apps/hub/app/pages/settings/community.vue` (1,194 lines), `platform/apps/hub/app/pages/landing/editor.vue` (839 lines), `platform/apps/hub/app/pages/applications/flows/[flowId]/settings.vue` (660 lines), `platform/apps/hub/app/components/applications/flow-builder/FlowNodeSidebar.vue` (602 lines)
- Impact: Hard to maintain, test, and review. Increases cognitive load. Makes it difficult to extract reusable logic.
- Fix approach: Extract composables for business logic (e.g., `usePermissionSettings`), break large forms into sub-components, and move API calls into dedicated composable or service layers.

**Bot Internal Sync Server Complexity:**
- Issue: `internal-sync-server.ts` (1,228 lines) implements an HTTP API server using raw `node:http` inside the bot process. It handles Discord role sync, member management, guild operations, and application tokens.
- Files: `platform/apps/bot/src/utils/internal-sync-server.ts`
- Impact: Raw HTTP handling lacks middleware abstractions. Error handling is manual. Adding new endpoints requires significant boilerplate. Hard to test individual routes.
- Fix approach: Consider migrating to a lightweight framework (Hono, Fastify) for structured routing and middleware.

## Security Considerations

**No Sandboxing for Plugin Code Execution:**
- Risk: Installed apps (sideloaded or marketplace) have their code executed via `new Function()` in the same Node.js process. A malicious app can access the full process, file system, network, and database.
- Files: `platform/apps/bot/src/utils/app-hooks.ts` (line 128), `platform/apps/hub/server/api/apps/[...path].ts` (line 86)
- Current mitigation: `require()` is blocked. Only whitelisted h3 helpers are injected for API routes. App must be "active" with a valid manifest. Role-based access is enforced before handler execution.
- Recommendations: Consider `isolated-vm` or worker threads for stricter isolation (acknowledged in code comments). At minimum, add CPU/memory limits and execution timeouts. For marketplace apps, implement a review/signing process before allowing execution.

**Non-Timing-Safe Token Comparison in Internal Auth:**
- Risk: `requireInternalToken()` uses `token !== expectedToken` (strict equality) for MCP internal token validation, which is vulnerable to timing attacks.
- Files: `platform/apps/hub/server/utils/internal-auth.ts` (line 16)
- Current mitigation: This endpoint is only accessible on the internal network (bot-to-hub communication). The bot sync server (`internal-sync-server.ts` line 70-73) correctly uses `timingSafeEqual`.
- Recommendations: Replace `!==` with `crypto.timingSafeEqual()` for consistency with the rest of the codebase. The fix is trivial and eliminates the concern entirely.

**Default Database Credentials in Docker Compose:**
- Risk: The `docker-compose.yml` hardcodes `POSTGRES_PASSWORD: postgres` and uses `postgres:postgres` in connection strings.
- Files: `platform/docker-compose.yml` (lines 7-9, 60, 69, 114)
- Current mitigation: Database is on an internal Docker network, not exposed to the internet. Only accessible from other containers in the `internal` network.
- Recommendations: Use environment variable substitution for the database password (like other secrets in the compose file). Document that production deployments must override this.

**Session Middleware Does Not Block Unauthenticated Requests:**
- Risk: The session middleware (`03-session.ts`) silently catches errors and sets `event.context.userSession = null`. Authentication enforcement is left entirely to individual API handlers.
- Files: `platform/apps/hub/server/middleware/03-session.ts`
- Current mitigation: Every sensitive endpoint calls `requireSession()`, `requireAdminSession()`, `requireModeratorSession()`, or `requireModeratorRight()` explicitly. Public endpoints (`/api/public/*`, `/api/auth/*`, `/api/theme.get`, `/api/setup/*`) intentionally skip auth.
- Recommendations: Consider a deny-by-default pattern where unauthenticated requests are blocked unless the route is explicitly marked as public. This prevents accidental exposure of new endpoints.

## Performance Bottlenecks

**App Registry Loaded on Every Request:**
- Problem: The app-loader plugin runs on every HTTP request to load installed apps from the database.
- Files: `platform/apps/hub/server/plugins/app-loader.ts` (line 67)
- Cause: Although there is a 15-second cache (`cacheUntil`), the cache check still runs on every request. With many concurrent requests, cache invalidation causes a thundering herd to the database.
- Improvement path: Add a mutex/lock so only one request refreshes the cache while others wait. Or use an event-driven invalidation (e.g., refresh only when apps are installed/updated).

**GuildAI Roster Building Issues N+1 Queries:**
- Problem: `buildRoster()` in `guildai/src/bot/hooks.ts` fetches all roles, then for each role makes a separate HTTP request to get members.
- Files: `guildai/src/bot/hooks.ts` (lines 145-183)
- Cause: No batch endpoint exists for fetching role-member mappings. Each role triggers a separate `/internal/guild/roles/:id/members` request.
- Improvement path: Add a bulk `/internal/guild/members-by-role` endpoint to the bot internal API. The 5-minute cache mitigates the impact but does not eliminate it during cache misses.

**DB Migration Fixups Run on Every Startup:**
- Problem: ~200 lines of idempotent SQL fixups execute on every server start, even when no schema changes are needed.
- Files: `platform/packages/shared/src/db/run-migrations.ts` (lines 101-444)
- Cause: No versioning/tracking for fixups. Each fixup uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` which hits the database regardless.
- Improvement path: Track applied fixups with a version number. Skip fixups that have already been applied.

## Fragile Areas

**App Code Execution Pipeline:**
- Files: `platform/apps/hub/server/api/apps/[...path].ts`, `platform/apps/bot/src/utils/app-hooks.ts`, `platform/apps/hub/server/utils/app-sideload.ts`
- Why fragile: Three components form a chain: sideload fetches and transpiles code from GitHub, the app-loader caches it, and the API handler/bot-hooks execute it. A change in any component (manifest format, bundling strategy, execution context) can break the entire pipeline silently.
- Safe modification: Always test with a real sideloaded app after changes. The esbuild transpilation in `app-sideload.ts` is particularly sensitive to import resolution changes.
- Test coverage: `platform/apps/hub/server/utils/__tests__/app-sideload.spec.ts` covers manifest parsing and URL resolution. `platform/apps/bot/src/utils/__tests__/app-hooks.spec.ts` covers hook registration and emission. No integration test covers the full sideload-to-execution pipeline.

**Voice Session Lifecycle:**
- Files: `platform/apps/bot/src/utils/voice-reconcile.ts`, `platform/apps/bot/src/utils/voice-session-lifecycle.ts`, `platform/apps/bot/src/events/voiceStateUpdate.ts`
- Why fragile: Voice sessions span multiple Discord events (join, move, disconnect, server crash). The reconciliation logic must handle orphaned sessions, duplicate open sessions (prevented by a unique partial index), and edge cases like AFK channel detection.
- Safe modification: The unique index `voice_sessions_one_open_per_user_idx` in the DB prevents data corruption. Always run the voice reconcile tests after changes.
- Test coverage: `platform/apps/bot/src/utils/__tests__/voice-reconcile.spec.ts` (530 lines), `platform/apps/bot/src/utils/__tests__/voice-session-lifecycle.spec.ts` - well covered.

**GuildAI Hooks (No Module System):**
- Files: `guildai/src/bot/hooks.ts`
- Why fragile: The entire 1,588-line file runs as a single `new Function()` invocation with no imports. Errors surface only at runtime. The file duplicates permission resolution, role hierarchy, and conversation management logic that exists elsewhere in the codebase.
- Safe modification: Test any change against the GuildAI test suite in `guildai/src/api/__tests__/` and `guildai/src/utils/__tests__/`. Be aware that the hooks file has its own inline constants (MAX_DISCORD_LENGTH, role hierarchies) that must stay in sync with the platform.
- Test coverage: No direct unit tests for the hooks file itself. Covered indirectly through API tests for the GuildAI app.

## Test Coverage Gaps

**API Endpoint Tests:**
- What's not tested: Only 7 spec files exist under `platform/apps/hub/server/api/__tests__/` for 162 API endpoint files. Most API routes (admin, mod, profile, settings, applications) have no dedicated unit tests.
- Files: `platform/apps/hub/server/api/` (162 files), `platform/apps/hub/server/api/__tests__/` (7 spec files)
- Risk: API behavior changes (authorization, validation, response format) may go unnoticed.
- Priority: High - Admin and moderation endpoints should be prioritized for test coverage.

**Server Utility Tests vs. API Tests:**
- What's not tested: Server utilities have good coverage (18 spec files in `platform/apps/hub/server/utils/__tests__/`), but this does not test the integration between utilities and API handlers.
- Files: `platform/apps/hub/server/utils/__tests__/` (18 spec files)
- Risk: A utility may work correctly in isolation but be called incorrectly from an API handler.
- Priority: Medium - Integration tests would complement the existing unit test suite.

**Frontend Component Tests:**
- What's not tested: No Vue component unit tests exist for the hub frontend. Only Playwright E2E tests (in `platform/apps/hub/tests/`) cover the UI.
- Files: `platform/apps/hub/app/components/`, `platform/apps/hub/app/pages/`
- Risk: Complex UI components (flow builder, landing editor, permission settings) may break without detection in CI.
- Priority: Medium - Focus on components with complex logic (FlowNodeSidebar, MemberDetailsModal).

**GuildAI Hooks File:**
- What's not tested: The 1,588-line `hooks.ts` has no direct unit tests. It is tested indirectly through API/integration tests for the GuildAI app.
- Files: `guildai/src/bot/hooks.ts`
- Risk: Permission resolution, conversation management, action parsing, and AI retry logic are untested at the function level.
- Priority: High - This is the most complex file in the codebase.

**Marketplace E2E Tests Only:**
- What's not tested: The marketplace has E2E tests but no server-side unit tests for API endpoints or middleware (except the rate limiter).
- Files: `marketplace/e2e/` (14 spec files), `marketplace/server/`
- Risk: Server logic changes may not be caught until E2E tests run (slower feedback loop).
- Priority: Low - The marketplace server is relatively simple.

## Dependencies at Risk

**Security Override Dependencies:**
- Risk: The `platform/package.json` contains 12 `pnpm.overrides` for security patches (serialize-javascript, undici, node-forge, h3, srvx, postcss, etc.). These overrides may mask incompatibilities.
- Files: `platform/package.json` (lines 32-48)
- Impact: Overrides force specific versions that may not be tested with the installed framework versions. Upgrades to Nuxt or other dependencies may conflict.
- Migration plan: Periodically check if upstream packages have adopted the patched versions, then remove unnecessary overrides.

---

*Concerns audit: 2026-04-15*
