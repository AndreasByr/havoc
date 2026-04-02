import { eq } from "drizzle-orm";
import { landingSections } from "@guildora/shared";
import { z } from "zod";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema } from "../../../../utils/http";
import { requireModeratorRight } from "../../../../utils/moderation-rights";

const updateSectionSchema = z.object({
  blockType: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  config: z.record(z.unknown()).optional(),
  content: z.record(z.unknown()).optional()
});

export default defineEventHandler(async (event) => {
  const session = await requireModeratorRight(event, "allowModeratorAccess");
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing section ID." });

  const body = await readBodyWithSchema(event, updateSectionSchema, "Invalid section update payload.");
  const db = getDb();

  const updateData: Record<string, unknown> = { updatedBy: session.user.id };
  if (body.blockType !== undefined) updateData.blockType = body.blockType;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
  if (body.visible !== undefined) updateData.visible = body.visible;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.config !== undefined) updateData.config = body.config;
  if (body.content !== undefined) updateData.content = body.content;

  const [updated] = await db
    .update(landingSections)
    .set(updateData)
    .where(eq(landingSections.id, id))
    .returning();

  if (!updated) throw createError({ statusCode: 404, statusMessage: "Section not found." });

  return { section: updated };
});
