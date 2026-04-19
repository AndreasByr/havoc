import { asc, eq } from "drizzle-orm";
import { createError } from "h3";
import { landingPages, landingSections, landingPageVersions } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";
import { templateSections, defaultSections } from "@guildora/shared/db/seeds/landing-templates";

const resetSchema = z.object({
  templateId: z.string().optional()
}).optional();

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, resetSchema ?? z.object({}), "Invalid reset payload.").catch(() => undefined);
  const templateId = body?.templateId || "default";
  const sections = templateSections[templateId] ?? defaultSections;

  const db = getDb();

  // Snapshot current state before reset
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
      label: "Before reset",
      createdBy: session.user.id
    });
  }

  try {
  await db.delete(landingSections);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  for (const section of sections) {
    try {
    await db.insert(landingSections).values({
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
      blockType: section.blockType,
      sortOrder: section.sortOrder,
      visible: section.visible,
      config: section.config,
      content: section.content,
      updatedBy: session.user.id
    });
  }

  try {
  const [page] = await db.select().from(landingPages).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  if (page) {
    await db
      .update(landingPages)
      .set({
        activeTemplate: templateId,
        customCss: null,
        updatedBy: session.user.id
      })
      .where(eq(landingPages.id, page.id));
  }

  return { success: true };
});
