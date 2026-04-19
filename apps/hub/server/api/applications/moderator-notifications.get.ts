import { eq } from "drizzle-orm";
import { createError } from "h3";
import { applicationModeratorNotifications, applicationFlows } from "@guildora/shared";
import { requireModeratorSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const db = getDb();

  try {
  const flows = await db.select({ id: applicationFlows.id, name: applicationFlows.name }).from(applicationFlows);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  const notifications = await db
    .select()
    .from(applicationModeratorNotifications)
    .where(eq(applicationModeratorNotifications.userId, session.user.id));

  const notificationMap = new Map(notifications.map((n) => [n.flowId, n.enabled]));

  return {
    flows: flows.map((f) => ({
      flowId: f.id,
      flowName: f.name,
      enabled: notificationMap.get(f.id) ?? false
    }))
  };
});
