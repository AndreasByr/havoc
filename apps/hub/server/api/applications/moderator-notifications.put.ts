import { z } from "zod";

import { eq, and } from "drizzle-orm";
import { applicationModeratorNotifications } from "@guildora/shared";
import { requireModeratorSession } from "../../utils/auth";
import { readBodyWithSchema } from "../../utils/http";
import { getDb } from "../../utils/db";

const schema = z.object({
  flowId: z.string().uuid(),
  enabled: z.boolean()
});

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const body = await readBodyWithSchema(event, schema, "Invalid notification payload.");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(applicationModeratorNotifications)
    .where(
      and(
        eq(applicationModeratorNotifications.flowId, body.flowId),
        eq(applicationModeratorNotifications.userId, session.user.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(applicationModeratorNotifications)
      .set({ enabled: body.enabled })
      .where(
        and(
          eq(applicationModeratorNotifications.flowId, body.flowId),
          eq(applicationModeratorNotifications.userId, session.user.id)
        )
      );
  } else {
    try {
    await db.insert(applicationModeratorNotifications).values({
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
      flowId: body.flowId,
      userId: session.user.id,
      enabled: body.enabled
    });
  }

  return { success: true };
});
