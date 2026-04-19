import { desc } from "drizzle-orm";
import { installedApps } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();
  const rows = await db.select().from(installedApps).orderBy(desc(installedApps.updatedAt));

  return {
    items: rows.map((row) => ({
      id: row.id,
      appId: row.appId,
      name: row.name,
      version: row.version,
      status: row.status,
      source: row.source,
      verified: row.verified,
      repositoryUrl: row.repositoryUrl,
      installedAt: row.installedAt,
      updatedAt: row.updatedAt
    }))
  };
});
