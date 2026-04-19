import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";
import { applications, applicationFlows } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const db = getDb();
  const query = getQuery(event);

  const flowIdFilter = query.flowId as string | undefined;
  const statusFilter = query.status as string | undefined;
  const search = query.search as string | undefined;

  const conditions = [
    or(eq(applications.status, "approved"), eq(applications.status, "rejected"))!
  ];
  if (flowIdFilter) conditions.push(eq(applications.flowId, flowIdFilter));
  if (statusFilter === "approved" || statusFilter === "rejected") {
    conditions.push(eq(applications.status, statusFilter));
  }
  if (search) {
    conditions.push(ilike(applications.discordUsername, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(applications)
    .where(and(...conditions))
    .orderBy(desc(applications.updatedAt));

  const flowIds = [...new Set(rows.map((r) => r.flowId))];
  const flows = flowIds.length > 0
    ? await db.select().from(applicationFlows).where(inArray(applicationFlows.id, flowIds))
    : [];
  const flowMap = new Map(flows.map((f) => [f.id, f.name]));

  return {
    applications: rows.map((app) => ({
      id: app.id,
      flowId: app.flowId,
      flowName: flowMap.get(app.flowId) || "Unknown",
      discordUsername: app.discordUsername,
      discordAvatarUrl: app.discordAvatarUrl,
      status: app.status,
      reviewedAt: app.reviewedAt,
      createdAt: app.createdAt
    }))
  };
});
