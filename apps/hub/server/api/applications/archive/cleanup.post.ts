import { requireAdminSession } from "../../../utils/auth";

import { getDb } from "../../../utils/db";
import { cleanupExpiredArchives } from "../../../utils/application-archive";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const db = getDb();
  const result = await cleanupExpiredArchives(db);
  return { success: true, ...result };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
