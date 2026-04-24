import { and, eq } from "drizzle-orm";
import { deletionRequests } from "@guildora/shared";
import { requireSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const db = getDb();

  const [pendingRequest] = await db
    .select({ id: deletionRequests.id })
    .from(deletionRequests)
    .where(and(eq(deletionRequests.userId, session.user.id), eq(deletionRequests.status, "pending")))
    .limit(1);

  if (pendingRequest) {
    throw createError({
      statusCode: 409,
      statusMessage: "A deletion request is already pending."
    });
  }

  const [createdRequest] = await db
    .insert(deletionRequests)
    .values({
      userId: session.user.id,
      status: "pending"
    })
    .returning({ id: deletionRequests.id });

  if (!createdRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create deletion request."
    });
  }

  return {
    ok: true,
    requestId: createdRequest.id
  };
});
