import { eq } from "drizzle-orm";
import { createError } from "h3";
import { landingSections } from "@guildora/shared";
import { z } from "zod";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema } from "../../../../utils/http";
import { requireModeratorRight } from "../../../../utils/moderation-rights";

const reorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0)
  }))
});

export default defineEventHandler(async (event) => {
try {
  const session = await requireModeratorRight(event, "allowModeratorAccess");
  const body = await readBodyWithSchema(event, reorderSchema, "Invalid reorder payload.");

  const db = getDb();
  for (const item of body.order) {
    await db
      .update(landingSections)
      .set({ sortOrder: item.sortOrder, updatedBy: session.user.id })
      .where(eq(landingSections.id, item.id));
  }

  return { success: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
