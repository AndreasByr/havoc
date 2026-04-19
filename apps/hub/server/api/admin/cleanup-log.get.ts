import { desc, sql } from "drizzle-orm";

import { cleanupLog } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  const query = getQuery(event);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  let items, countResult;
  try {
    [items, countResult] = await Promise.all([
      db
        .select()
        .from(cleanupLog)
        .orderBy(desc(cleanupLog.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(cleanupLog)
    ]);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  return {
    items: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      discordId: item.discordId,
      discordUsername: item.discordUsername,
      reason: item.reason,
      conditionsMatched: item.conditionsMatched,
      rolesRemoved: item.rolesRemoved,
      createdAt: item.createdAt.toISOString()
    })),
    pagination: {
      total: countResult[0]?.count ?? 0,
      limit,
      offset
    }
  };
});
