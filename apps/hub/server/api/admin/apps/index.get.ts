import { desc } from "drizzle-orm";
import { installedApps, safeParseAppManifest } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  const appsRows = await db.select().from(installedApps).orderBy(desc(installedApps.updatedAt));

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
