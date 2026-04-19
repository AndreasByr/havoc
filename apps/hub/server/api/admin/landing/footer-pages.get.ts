import { asc } from "drizzle-orm";
import { footerPages } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();

  const pages = await db
    .select()
    .from(footerPages)
    .orderBy(asc(footerPages.sortOrder));

  return { pages };
});
