import { eq } from "drizzle-orm";
import { createError } from "h3";
import { communityTags } from "@guildora/shared";
import { z } from "zod";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";
import { requireModeratorRight } from "../../../utils/moderation-rights";

const createTagSchema = z.object({
  name: z.string().min(1).max(64).transform((v) => v.trim())
});

export default defineEventHandler(async (event) => {
try {
  await requireModeratorRight(event, "modAccessCustomFields");
  const session = await requireModeratorSession(event);
  const { name } = await readBodyWithSchema(event, createTagSchema, "Invalid tag payload.");

  const db = getDb();

  const existing = await db
    .select()
    .from(communityTags)
    .where(eq(communityTags.name, name))
    .limit(1);

  if (existing.length > 0) {
    return { tag: existing[0], created: false };
  }

  const [tag] = await db
    .insert(communityTags)
    .values({ name, createdBy: session.user.id })
    .returning();

  return { tag, created: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
