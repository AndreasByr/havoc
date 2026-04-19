import { asc, eq } from "drizzle-orm";

import { landingPages, landingSections, landingPageVersions } from "@guildora/shared";
import { requireInternalToken } from "../../../utils/internal-auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
  const db = getDb();

  try {
  const currentSections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  try {
  const [currentPage] = await db.select().from(landingPages).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  if (currentSections.length > 0) {
    try {
    await db.insert(landingPageVersions).values({
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
      snapshot: { sections: currentSections, pageConfig: currentPage ?? null },
      label: "Published (MCP)"
    });
  }

  const result = await db
    .update(landingSections)
    .set({ status: "published" })
    .where(eq(landingSections.status, "draft"))
    .returning({ id: landingSections.id });

  if (currentPage) {
    await db
      .update(landingPages)
      .set({ publishedAt: new Date() })
      .where(eq(landingPages.id, currentPage.id));
  }

  return { success: true, publishedCount: result.length };
});
