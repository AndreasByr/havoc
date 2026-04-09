import { and, asc, eq } from "drizzle-orm";
import { landingPages, landingSections, landingTemplates, resolveLandingColors, migrateColorOverrides } from "@guildora/shared";
import type { LandingColorOverrides } from "@guildora/shared";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=30, stale-while-revalidate=120");

  const query = getQuery(event);
  const locale = typeof query.locale === "string" && query.locale.length >= 2 ? query.locale : "en";

  const db = getDb();

  const [page] = await db
    .select()
    .from(landingPages)
    .limit(1);

  if (!page || !page.publishedAt) {
    return { sections: [], template: null, customCss: null, meta: {}, colors: null };
  }

  const [template] = await db
    .select()
    .from(landingTemplates)
    .where(eq(landingTemplates.id, page.activeTemplate))
    .limit(1);

  const sections = await db
    .select()
    .from(landingSections)
    .where(and(eq(landingSections.visible, true), eq(landingSections.status, "published")))
    .orderBy(asc(landingSections.sortOrder));

  const localizedSections = sections.map((section) => {
    const content = section.content as Record<string, unknown>;
    const localizedContent = (content[locale] ?? content.en ?? content) as Record<string, unknown>;
    return {
      id: section.id,
      blockType: section.blockType,
      sortOrder: section.sortOrder,
      config: section.config,
      content: localizedContent
    };
  });

  const perTemplate = migrateColorOverrides(
    page.colorOverrides as Record<string, unknown> ?? {},
    page.activeTemplate
  );
  const resolvedColors = resolveLandingColors(
    page.activeTemplate,
    (perTemplate[page.activeTemplate] ?? {}) as LandingColorOverrides
  );

  return {
    sections: localizedSections,
    template: template
      ? { id: template.id, name: template.name }
      : null,
    customCss: page.customCss ?? null,
    meta: {
      title: page.metaTitle,
      description: page.metaDescription
    },
    colors: resolvedColors
  };
});
