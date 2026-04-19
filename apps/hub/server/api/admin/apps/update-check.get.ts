import { and, isNotNull, eq } from "drizzle-orm";

import { installedApps, safeParseAppManifest } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { resolveManifestUrls, fetchManifestInput } from "../../../utils/app-sideload";

function parseSemVer(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewerVersion(remote: string, current: string): boolean {
  const r = parseSemVer(remote);
  const c = parseSemVer(current);
  if (!r || !c) return false;
  if (r[0] !== c[0]) return r[0] > c[0];
  if (r[1] !== c[1]) return r[1] > c[1];
  return r[2] > c[2];
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  let rows;
  try {
    rows = await db
      .select()
      .from(installedApps)
      .where(and(isNotNull(installedApps.repositoryUrl), eq(installedApps.source, "sideloaded")));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  const updates = await Promise.all(
    rows.map(async (app) => {
      try {
        const urls = resolveManifestUrls(app.repositoryUrl!);
        const { input } = await fetchManifestInput(urls);
        const parsed = safeParseAppManifest(input);
        const remoteVersion = parsed.success ? parsed.data.version : null;
        const updateAvailable = remoteVersion !== null && app.version !== null && isNewerVersion(remoteVersion, app.version);
        return { appId: app.appId, remoteVersion, updateAvailable };
      } catch {
        return { appId: app.appId, remoteVersion: null, updateAvailable: false, checkError: true };
      }
    })
  );

  return { updates };
});
