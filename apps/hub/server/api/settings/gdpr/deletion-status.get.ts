import { desc, eq } from "drizzle-orm";
import { deletionRequests } from "@guildora/shared";
import { requireSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const db = getDb();

  const [latestRequest] = await db
    .select({
      status: deletionRequests.status,
      createdAt: deletionRequests.createdAt
    })
    .from(deletionRequests)
    .where(eq(deletionRequests.userId, session.user.id))
    .orderBy(desc(deletionRequests.createdAt))
    .limit(1);

  if (!latestRequest) {
    return {
      hasPendingRequest: false,
      status: null,
      createdAt: null
    };
  }

  return {
    hasPendingRequest: latestRequest.status === "pending",
    status: latestRequest.status,
    createdAt: latestRequest.createdAt
  };
});
