import { eq } from "drizzle-orm";
import { landingSections } from "@guildora/shared";
import { z } from "zod";
import { requireInternalToken } from "../../../../utils/internal-auth";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema } from "../../../../utils/http";

const reorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0)
  }))
});

export default defineEventHandler(async (event) => {
  requireInternalToken(event);
  const body = await readBodyWithSchema(event, reorderSchema, "Invalid reorder payload.");

  const db = getDb();
  for (const item of body.order) {
    await db
      .update(landingSections)
      .set({ sortOrder: item.sortOrder })
      .where(eq(landingSections.id, item.id));
  }

  return { success: true };
});
