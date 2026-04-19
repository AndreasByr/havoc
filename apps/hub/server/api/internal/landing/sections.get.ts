import { asc } from "drizzle-orm";

import { landingSections } from "@guildora/shared";
import { requireInternalToken } from "../../../utils/internal-auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
  const db = getDb();
  try {
  const sections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  return { sections };
});
