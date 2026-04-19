import { asc } from "drizzle-orm";
import { landingSections } from "@guildora/shared";
import { requireInternalToken } from "../../../utils/internal-auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
  const db = getDb();
  const sections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  return { sections };
});
