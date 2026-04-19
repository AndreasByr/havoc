import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { cleanupExpiredArchives } from "../../../utils/application-archive";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();
  const result = await cleanupExpiredArchives(db);
  return { success: true, ...result };
});
