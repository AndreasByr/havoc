import { asc } from "drizzle-orm";
import { createError } from "h3";
import { landingPages, landingSections, landingTemplates } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();

  try {
  const [page] = await db.select().from(landingPages).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  try {
  const templates = await db.select().from(landingTemplates);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  const sections = await db
    .select()
    .from(landingSections)
    .orderBy(asc(landingSections.sortOrder));

  return {
    page: page ?? null,
    templates,
    sections
  };
});
