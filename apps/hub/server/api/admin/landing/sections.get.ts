import { asc } from "drizzle-orm";
import { landingSections } from "@guildora/shared";
import { getDb } from "../../../utils/db";
import { requireModeratorRight } from "../../../utils/moderation-rights";

export default defineEventHandler(async (event) => {
  await requireModeratorRight(event, "allowModeratorAccess");

  const db = getDb();
  const sections = await db
    .select()
    .from(landingSections)
    .orderBy(asc(landingSections.sortOrder));

  return { sections };
});
