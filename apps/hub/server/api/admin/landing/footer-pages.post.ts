import { footerPages } from "@guildora/shared";
import { createError } from "h3";
import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";
import { sanitizeRecordStrings } from "../../../utils/sanitize";

const createPageSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.record(z.string()),
  content: z.record(z.string()).optional().default({}),
  sortOrder: z.number().int().min(0).optional().default(0),
  visible: z.boolean().optional().default(true)
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, createPageSchema, "Invalid footer page payload.");

  const db = getDb();
  try {
  const [page] = await db.insert(footerPages).values({
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
    slug: body.slug,
    title: sanitizeRecordStrings(body.title),
    content: sanitizeRecordStrings(body.content),
    sortOrder: body.sortOrder,
    visible: body.visible,
    updatedBy: session.user.id
  }).returning();

  return { page };
});
