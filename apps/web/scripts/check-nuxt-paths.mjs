/**
 * Detects stale absolute paths in .nuxt build artifacts and cleans them.
 *
 * Problem: Nuxt/Vite embeds absolute file:// URLs in generated server bundles
 * (.nuxt/dist/server/server.mjs, .nuxt/dev/index.mjs). When the workspace is
 * accessed via bind mounts or symlink aliases (e.g. /home/alice/workspace in a
 * container mapped to /home/andreas/workspace on the host), previously generated
 * artifacts may contain paths that don't resolve in the current execution context.
 *
 * This script scans known generated artifacts for embedded file:// imports or
 * stale /home/alice/workspace aliases, verifies the referenced path actually
 * exists on the filesystem, and cleans .nuxt if it doesn't — forcing Nuxt to
 * regenerate with correct paths.
 */

import { readFileSync, rmSync, existsSync, accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

const nuxtDir = resolve('.nuxt');
const candidates = [
  resolve(nuxtDir, 'dist/server/server.mjs'),
  resolve(nuxtDir, 'dev/index.mjs'),
  resolve(nuxtDir, 'nuxt.json'),
];

for (const entry of candidates) {
  if (!existsSync(entry)) continue;

  const content = readFileSync(entry, 'utf8');
  const fileImportMatch = content.match(/from\s+["']file:\/\/\/(.*?)["']/);
  const hasAliasedWorkspacePath = content.includes('/home/alice/workspace/');

  if (!fileImportMatch && !hasAliasedWorkspacePath) continue;

  const embeddedPath = fileImportMatch ? `/${fileImportMatch[1]}` : '/home/alice/workspace';

  try {
    accessSync(embeddedPath, constants.R_OK);
    if (!hasAliasedWorkspacePath) {
      continue;
    }
  } catch {
    // fall through to cleanup
  }

  console.log(`[guildora] Stale .nuxt artifacts detected — embedded module path does not exist.`);
  console.log(`[guildora]   Missing: ${embeddedPath}`);
  console.log(`[guildora]   Source:  ${entry}`);
  console.log(`[guildora]   Cleaning .nuxt to force regeneration...`);
  rmSync(nuxtDir, { recursive: true, force: true });
  console.log(`[guildora]   Done. Nuxt will regenerate on next start.`);
  break;
}
