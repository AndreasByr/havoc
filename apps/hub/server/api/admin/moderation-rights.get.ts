import { requireAdminSession } from "../../utils/auth";
import { loadModerationRights } from "../../utils/moderation-rights";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();
  const rights = await loadModerationRights(db);
  return { rights };
});
