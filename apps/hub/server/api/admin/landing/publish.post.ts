import { asc, eq } from "drizzle-orm";
import { landingPages, landingSections, landingPageVersions } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const db = getDb();

  // Snapshot current published state before publishing new changes
  const currentSections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  const [currentPage] = await db.select().from(landingPages).limit(1);

  if (currentSections.length > 0) {
    await db.insert(landingPageVersions).values({
      snapshot: { sections: currentSections, pageConfig: currentPage ?? null },
      label: "Published",
      createdBy: session.user.id
    });
  }

  // Set all draft sections to published
  const result = await db
    .update(landingSections)
    .set({ status: "published" })
    .where(eq(landingSections.status, "draft"))
    .returning({ id: landingSections.id });

  // Update publishedAt
  if (currentPage) {
    await db
      .update(landingPages)
      .set({ publishedAt: new Date(), updatedBy: session.user.id })
      .where(eq(landingPages.id, currentPage.id));
  }

  return { success: true, publishedCount: result.length };
});
