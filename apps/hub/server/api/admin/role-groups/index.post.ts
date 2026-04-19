import { z } from "zod";

import { roleGroups } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().default(null),
  sortOrder: z.number().int().min(0).default(0)
});

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");
  const db = getDb();

  const [created] = await db
    .insert(roleGroups)
    .values({
      name: parsed.name,
      description: parsed.description,
      sortOrder: parsed.sortOrder
    })
    .returning();

  return { group: created };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
