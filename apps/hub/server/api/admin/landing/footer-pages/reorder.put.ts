import { eq } from "drizzle-orm";
import { footerPages } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../../../utils/auth";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema } from "../../../../utils/http";

const reorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0)
  }))
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBodyWithSchema(event, reorderSchema, "Invalid reorder payload.");

  const db = getDb();
  for (const item of body.order) {
    await db
      .update(footerPages)
      .set({ sortOrder: item.sortOrder, updatedBy: session.user.id })
      .where(eq(footerPages.id, item.id));
  }

  return { success: true };
});
