import { landingSections } from "@guildora/shared";
import { createError } from "h3";
import { z } from "zod";
import { requireInternalToken } from "../../../utils/internal-auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const createSectionSchema = z.object({
  blockType: z.string().min(1),
  sortOrder: z.number().int().min(0),
  visible: z.boolean().optional().default(true),
  config: z.record(z.unknown()).optional().default({}),
  content: z.record(z.unknown())
});

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
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
    config: body.config,
    content: body.content
  }).returning();

  return { section };
});
