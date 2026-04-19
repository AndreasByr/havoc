import { landingSections } from "@guildora/shared";

import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";
import { sanitizeContentObject } from "../../../utils/sanitize";

const createSectionSchema = z.object({
  blockType: z.string().min(1),
  sortOrder: z.number().int().min(0),
  visible: z.boolean().optional().default(true),
  config: z.record(z.unknown()).optional().default({}),
  content: z.record(z.unknown())
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, createSectionSchema, "Invalid section payload.");

  const db = getDb();
  try {
  const [section] = await db.insert(landingSections).values({
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
    blockType: body.blockType,
    sortOrder: body.sortOrder,
    visible: body.visible,
    status: "draft",
    config: sanitizeContentObject(body.config),
    content: sanitizeContentObject(body.content),
    updatedBy: session.user.id
  }).returning();

  return { section };
});
