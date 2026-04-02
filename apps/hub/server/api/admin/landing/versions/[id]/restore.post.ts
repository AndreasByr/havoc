import { asc, eq } from "drizzle-orm";
import { landingPages, landingSections, landingPageVersions } from "@guildora/shared";
import { requireAdminSession } from "../../../../../utils/auth";
import { getDb } from "../../../../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing version ID." });

  const db = getDb();

  const [version] = await db
    .select()
    .from(landingPageVersions)
    .where(eq(landingPageVersions.id, id))
    .limit(1);

  if (!version) throw createError({ statusCode: 404, statusMessage: "Version not found." });

  const snapshot = version.snapshot as { sections?: Array<Record<string, unknown>>; pageConfig?: Record<string, unknown> | null };
  if (!snapshot.sections) throw createError({ statusCode: 400, statusMessage: "Invalid snapshot data." });

  // Snapshot current state before restoring
  const currentSections = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder));
  const [currentPage] = await db.select().from(landingPages).limit(1);
  if (currentSections.length > 0) {
    await db.insert(landingPageVersions).values({
      snapshot: { sections: currentSections, pageConfig: currentPage ?? null },
      label: "Before restore",
      createdBy: session.user.id
    });
  }

  // Delete current sections and restore from snapshot
  await db.delete(landingSections);

  for (const section of snapshot.sections) {
    await db.insert(landingSections).values({
      blockType: String(section.blockType ?? section.block_type),
      sortOrder: Number(section.sortOrder ?? section.sort_order ?? 0),
      visible: section.visible !== false,
      status: String(section.status ?? "published") as "draft" | "published",
      config: (section.config ?? {}) as Record<string, unknown>,
      content: (section.content ?? {}) as Record<string, unknown>,
      updatedBy: session.user.id
    });
  }

  // Restore page config if present
  if (snapshot.pageConfig) {
    const pc = snapshot.pageConfig;
    const [page] = await db.select().from(landingPages).limit(1);
    if (page) {
      await db.update(landingPages).set({
        activeTemplate: String(pc.activeTemplate ?? pc.active_template ?? "default"),
        customCss: pc.customCss != null ? String(pc.customCss ?? pc.custom_css) : null,
        metaTitle: pc.metaTitle != null ? String(pc.metaTitle ?? pc.meta_title) : null,
        metaDescription: pc.metaDescription != null ? String(pc.metaDescription ?? pc.meta_description) : null,
        updatedBy: session.user.id
      }).where(eq(landingPages.id, page.id));
    }
  }

  return { success: true };
});
