import { retentionPolicies } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();
  const policies = await db
    .select({
      id: retentionPolicies.id,
      category: retentionPolicies.category,
      retentionDays: retentionPolicies.retentionDays,
      enabled: retentionPolicies.enabled,
      updatedAt: retentionPolicies.updatedAt
    })
    .from(retentionPolicies);

  return { policies };
});
