import { desc } from "drizzle-orm";
import { createError } from "h3";
import { installedApps } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();
  try {
  const rows = await db.select().from(installedApps).orderBy(desc(installedApps.updatedAt));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

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
