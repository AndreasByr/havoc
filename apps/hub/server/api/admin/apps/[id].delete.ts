import { eq } from "drizzle-orm";
import { installedApps } from "@guildora/shared";
import { refreshAppRegistry } from "../../../utils/apps";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { requireRouterParam } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = requireRouterParam(event, "id", "Missing app id parameter.");

  const db = getDb();
  const deletedRows = await db.delete(installedApps).where(eq(installedApps.id, id)).returning();
  const deleted = deletedRows[0];
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "App not found." });
  }

  await refreshAppRegistry();

  console.log(JSON.stringify({ event: "app.uninstalled", appId: deleted.appId, id: deleted.id }));

  return {
    success: true,
    id: deleted.id
  };
});
