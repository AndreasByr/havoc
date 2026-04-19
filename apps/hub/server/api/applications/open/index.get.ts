import { eq, and, inArray } from "drizzle-orm";

import { applications, applicationFlows } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const db = getDb();

  const query = getQuery(event);
  const flowIdFilter = query.flowId as string | undefined;

  const conditions = [eq(applications.status, "pending")];
  if (flowIdFilter) conditions.push(eq(applications.flowId, flowIdFilter));

  const filtered = await db
    .select()
    .from(applications)
    .where(and(...conditions))
    .orderBy(applications.createdAt);

  const flowIds = [...new Set(filtered.map((r) => r.flowId))];
  const flows = flowIds.length > 0
    try {
    ? await db.select().from(applicationFlows).where(inArray(applicationFlows.id, flowIds))
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
    : [];
  const flowMap = new Map(flows.map((f) => [f.id, f.name]));

  return {
    applications: filtered.map((app) => ({
      id: app.id,
      flowId: app.flowId,
      flowName: flowMap.get(app.flowId) || "Unknown Flow",
      discordId: app.discordId,
      discordUsername: app.discordUsername,
      discordAvatarUrl: app.discordAvatarUrl,
      displayNameComposed: app.displayNameComposed,
      hasPendingRoles: ((app.pendingRoleAssignments as string[] | null)?.length ?? 0) > 0,
      createdAt: app.createdAt
    }))
  };
});
