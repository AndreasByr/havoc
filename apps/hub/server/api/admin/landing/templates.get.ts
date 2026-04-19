import { landingTemplates } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();
  const templates = await db.select().from(landingTemplates);

  return { templates };
});
