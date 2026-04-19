import { asc } from "drizzle-orm";

import { communityTags } from "@guildora/shared";
import { getDb } from "../../../utils/db";
import { requireModeratorRight } from "../../../utils/moderation-rights";

export default defineEventHandler(async (event) => {
try {
  await requireModeratorRight(event, "modAccessCustomFields");
  const db = getDb();

  const tags = await db
    .select()
    .from(communityTags)
    .orderBy(asc(communityTags.name));

  return { tags };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
