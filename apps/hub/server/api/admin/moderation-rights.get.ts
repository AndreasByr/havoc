import { requireAdminSession } from "../../utils/auth";

import { loadModerationRights } from "../../utils/moderation-rights";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const db = getDb();
  const rights = await loadModerationRights(db);
  return { rights };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
