# pnpm audit — Accepted Risks — Phase 4

**Audited:** 2026-04-18
**Scope:** pnpm audit --prod (production dependencies only, per D-04)
**Policy:** Per D-05: every High/Critical without upstream fix is documented here with
justification. Medium/Low are noted but not required to be fixed in this phase.

## Accepted: Critical / High

### CVE-2025-7783 — form-data unsafe random boundary (Critical)

- **Package:** form-data < 2.5.4
- **Dependency path:** apps/matrix-bot > matrix-bot-sdk@0.7.1 > request@2.88.2 > form-data@2.3.3
- **Also via:** apps/matrix-bot > matrix-bot-sdk@0.7.1 > request-promise@4.2.6 > request@2.88.2 > form-data@2.3.3
- **Patched version:** form-data >= 2.5.4
- **Why not fixable:** `request@2.88.2` is the entry point. `request` was deprecated in 2020
  and never patched for any CVE. matrix-bot-sdk@0.7.1 depends on `request` and has not
  removed it. A pnpm.overrides entry for `form-data >= 2.5.4` may break the `request@2.88.2`
  interface (form boundary API changed between 2.3.x and 2.5.x). A forced override was
  evaluated and rejected to avoid breaking matrix-bot-sdk's multipart handling.
- **Impact assessment:** This CVE concerns multipart form boundary predictability (boundary
  is pseudo-random but deterministic). matrix-bot uses `request` only for its internal HTTP
  transport to Matrix homeserver — these are JSON-body requests, not multipart form uploads.
  The predictable boundary attack requires an attacker who can intercept and replay specific
  multipart requests; this is not applicable to matrix-bot's actual usage pattern.
- **Mitigating controls:**
  - matrix-bot's internal sync server uses Bearer token auth (Phase 3 hardened: timing-safe comparison)
  - matrix-bot is not internet-facing (Docker internal network only, guildora_internal)
  - No multipart form uploads occur in matrix-bot's code paths (confirmed by code review)
- **Review date:** 2026-04-18
- **Re-evaluate when:** matrix-bot-sdk releases a version that drops the `request` dependency,
  or when an upgrade path to matrix-bot-sdk@0.8+ becomes available.
- **Advisory:** https://github.com/advisories/GHSA-fjxv-7rqg-78g4

## Resolved in Phase 4 (previously High, now fixed)

| CVE | Package | Fix Applied |
|-----|---------|-------------|
| CVE-2026-35209 | defu | pnpm.overrides "defu": ">=6.1.5" |
| CVE-2026-4800 | lodash | pnpm.overrides "lodash": ">=4.18.0" |
| CVE-2026-39364 | vite | pnpm.overrides "vite": ">=7.3.2" |
| CVE-2026-39363 | vite | pnpm.overrides "vite": ">=7.3.2" |
| CVE-2026-39356 | drizzle-orm | Upgraded ^0.44.5 -> ^0.45.2 in shared/hub/bot |

## Noted: Moderate (not required to fix per D-05)

The following Moderate findings are noted. They do not require fixes in this phase per D-05.

| Package | CVE / Advisory | Path | Why Not Fixed |
|---------|----------------|------|---------------|
| request | SSRF / multiple advisories | matrix-bot-sdk > request | request is unmaintained; no patched version exists |
| tough-cookie | prototype pollution | matrix-bot-sdk > request > tough-cookie | same path, unmaintained root cause |
| dompurify | XSS | isomorphic-dompurify@3.7.1 > dompurify@3.3.3 | patched in >=3.4.0; isomorphic-dompurify upgrade scheduled separately |
| hono (multiple) | multiple advisories | mcp-server > @modelcontextprotocol/sdk > hono | Moderate only; mcp-server is optional/internal |
| sanitize-html | XSS | matrix-bot-sdk > sanitize-html@2.x | patched in >=2.17.3; override would conflict with matrix-bot-sdk |
| esbuild | dev server exposure | hub > @nuxt/devtools > esbuild | dev-server-only; does not run in production builds |
| unhead | advisory | hub > nuxt > unhead | Moderate only; no active exploit path confirmed |
| qs | prototype pollution | multiple paths | Moderate only; no active exploit in hub usage |
| vue-template-compiler | advisory | hub > nuxt | Moderate only |
