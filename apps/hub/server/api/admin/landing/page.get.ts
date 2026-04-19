import { asc, eq } from "drizzle-orm";
import { landingPages, landingSections, landingTemplates } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();

  const [page] = await db.select().from(landingPages).limit(1);
  const templates = await db.select().from(landingTemplates);
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
