import { eq, inArray } from "drizzle-orm";
import {
  applicationModeratorNotifications,
  applicationFlows,
  users
} from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  const [flows, allNotifications] = await Promise.all([
    db.select({ id: applicationFlows.id, name: applicationFlows.name }).from(applicationFlows),
    db.select().from(applicationModeratorNotifications).where(eq(applicationModeratorNotifications.enabled, true))
  ]);

  const userIds = [...new Set(allNotifications.map((n) => n.userId))];
  const userRows = userIds.length > 0
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName]));

  // Build notification overview
  const notificationOverview = flows.map((flow) => {
    const flowNotifs = allNotifications.filter((n) => n.flowId === flow.id);
    return {
      flowId: flow.id,
      flowName: flow.name,
      moderators: flowNotifs.map((n) => ({
        userId: n.userId,
        displayName: userMap.get(n.userId) || "Unknown"
      }))
    };
  });

  return {
    notificationOverview
  };
});
