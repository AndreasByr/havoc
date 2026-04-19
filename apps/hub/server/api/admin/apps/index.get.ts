import { desc } from "drizzle-orm";

import { installedApps, safeParseAppManifest } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  let appsRows;
  try {
    appsRows = await db.select().from(installedApps).orderBy(desc(installedApps.updatedAt));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  const apps = appsRows.map((row) => ({
    ...row,
    manifestValid: safeParseAppManifest(row.manifest).success
  }));

  return {
    apps,
    stats: {
      installed: apps.length,
      active: apps.filter((item) => item.status === "active").length
    }
  };
});
