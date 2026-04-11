import { eq } from "drizzle-orm";
import { platformConnections } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { invalidatePlatformCache } from "../../../utils/platformConfig";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Platform connection ID is required." });
  }

  const db = getDb();
  const [deleted] = await db
    .delete(platformConnections)
    .where(eq(platformConnections.id, id))
    .returning({ id: platformConnections.id, platform: platformConnections.platform });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Platform connection not found." });
  }

  invalidatePlatformCache();
  return { ok: true, deleted: { id: deleted.id, platform: deleted.platform } };
});
