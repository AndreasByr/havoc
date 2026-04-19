import { eq } from "drizzle-orm";
import { landingPages, sanitizeLandingColorOverrides } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";
import { sanitizeCss } from "../../../utils/sanitize";

const updatePageSchema = z.object({
  customCss: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  enabledLocales: z.array(z.string().min(2).max(5)).min(1).optional(),
  colorOverrides: z.record(z.string()).nullable().optional()
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, updatePageSchema, "Invalid page update payload.");

  const db = getDb();
  const [page] = await db.select().from(landingPages).limit(1);

  const updateData: Record<string, unknown> = { updatedBy: session.user.id };
  if (body.customCss !== undefined) updateData.customCss = body.customCss ? sanitizeCss(body.customCss) : body.customCss;
  if (body.metaTitle !== undefined) updateData.metaTitle = body.metaTitle;
  if (body.metaDescription !== undefined) updateData.metaDescription = body.metaDescription;
  if (body.enabledLocales !== undefined) updateData.enabledLocales = body.enabledLocales;
  if (body.colorOverrides !== undefined) {
    updateData.colorOverrides = body.colorOverrides
      ? sanitizeLandingColorOverrides(body.colorOverrides)
      : {};
  }

  if (page) {
    await db
      .update(landingPages)
      .set(updateData)
      .where(eq(landingPages.id, page.id));
  } else {
    await db.insert(landingPages).values({
      activeTemplate: "default",
      locale: "en",
      ...updateData
    });
  }

  return { success: true };
});
