import { asc } from "drizzle-orm";
import { createError } from "h3";
import { landingSections } from "@guildora/shared";
import { getDb } from "../../../utils/db";
import { requireModeratorRight } from "../../../utils/moderation-rights";

export default defineEventHandler(async (event) => {
try {
  await requireModeratorRight(event, "allowModeratorAccess");

  const db = getDb();
  const sections = await db
    .select()
    .from(landingSections)
    .orderBy(asc(landingSections.sortOrder));

  return { sections };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
