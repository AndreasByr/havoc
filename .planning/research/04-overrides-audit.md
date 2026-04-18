# pnpm.overrides Audit — Phase 4

**Audited:** 2026-04-18
**Source:** platform/package.json pnpm.overrides block
**Total entries:** 18 (15 pre-existing + 3 added in Phase 4)

| Override Key | Constraint | CVE / Reason | Upstream Patched? | Removable? | Status |
|---|---|---|---|---|---|
| serialize-javascript | >=7.0.3 | XSS via unsafe serialization | yes (7.0.5 latest) | no — transitive consumers may still pull older | keep |
| devalue | >=5.6.4 | compatibility/CVE patch (5.7.1 latest) | yes | no — protect against new installs | keep |
| undici | >=6.24.0 <8.0.0 | multiple CVEs (GHSA-*); upper bound intentional compat guard | yes (8.x patched too) | no — compat guard needed until direct deps update to undici 8 | keep |
| flatted | >=3.4.2 | compatibility patch (3.4.2 is latest) | n/a (latest = required) | removable once all consumers independently updated | keep (no-op but protects future installs) |
| node-forge | >=1.3.4 | CVE patch (1.4.0 latest) | yes (1.3.4+) | no — transitive consumers may still pull older | keep |
| picomatch | >=4.0.4 | compatibility patch (4.0.4 is latest) | n/a (latest = required) | removable once all consumers updated | keep (no-op but protects future installs) |
| happy-dom | >=20.8.9 | CVE/compat patch (20.9.0 latest) | yes | no — protect against new installs pulling old | keep |
| h3 | >=1.15.9 | CVE patch; h3 is core Nuxt dep — removing risks reverting to older h3 | yes (1.15.x maintained) | no — Nuxt may pull older h3 without this | keep |
| srvx | >=0.11.13 | compatibility patch (0.11.15 latest) | n/a (latest = required) | removable once consumers updated | keep |
| postcss | >=8.4.31 | CVE-2023-44270 (line injection, 8.5.10 latest) | yes | no — many tools still pin older postcss | keep |
| brace-expansion@>=2.0.0 <2.0.3 | >=2.0.3 | CVE patch for specific 2.x range (2.1.0 latest) | yes | no — pin protects against specific range | keep |
| brace-expansion@>=4.0.0 <5.0.5 | >=5.0.5 | CVE patch for 4.x range pinned to 5.0.5+ (5.0.5 latest) | yes | no — intentional range pin | keep |
| yaml | >=2.8.3 | CVE/compat patch (2.8.3 is latest) | n/a (latest = required) | removable once consumers updated | keep |
| ajv | >=8.18.0 | CVE/compat patch (8.18.0 is latest) | n/a (latest = required) | removable once consumers updated | keep |
| eslint>ajv | ^6 | ESLint requires ajv v6 internally — scoped to eslint to avoid forcing v6 on others | n/a (intentional compat) | no — ESLint v8/v9 still use ajv v6 internally | keep |
| defu | >=6.1.5 | CVE-2026-35209, prototype pollution via uncontrolled recursion (205 transitive paths) | yes (6.1.5+) | no — many nuxt paths still pull older defu | keep (Phase 4 addition) |
| lodash | >=4.18.0 | CVE-2026-4800, code injection via template function (4.18.1 latest) | yes (4.18.0+) | no — discord.js and nuxt paths still pull older lodash | keep (Phase 4 addition) |
| vite | >=7.3.2 | CVE-2026-39364 + CVE-2026-39363, fs.deny bypass + arbitrary file read via WebSocket | yes (7.3.2+) | assess after nuxt upgrade — if nuxt pulls >=7.3.2 directly, can remove | keep (Phase 4 addition) |

## Notes

- All 15 pre-existing entries are retained — none were found to be fully removable at this time
  because transitive consumers across the workspace may still pull older versions.
- The 3 Phase 4 additions fix High CVEs that were not covered by existing overrides.
- The `eslint>ajv` entry is a scoped override — it only forces ajv v6 within eslint's
  own dependency tree, preventing it from conflicting with the v8+ requirement elsewhere.
- Re-evaluate removability at each major Nuxt/discord.js/matrix-bot-sdk upgrade.
