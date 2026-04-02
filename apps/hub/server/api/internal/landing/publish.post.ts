import { asc, eq } from "drizzle-orm";
import { landingPages, landingSections, landingPageVersions } from "@guildora/shared";
import { requireInternalToken } from "../../../utils/internal-auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
  const db = getDb();

  const currentSections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  const [currentPage] = await db.select().from(landingPages).limit(1);

  if (currentSections.length > 0) {
    await db.insert(landingPageVersions).values({
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
