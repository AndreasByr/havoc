import { asc } from "drizzle-orm";
import { communityTags } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { requireModeratorRight } from "../../../utils/moderation-rights";

export default defineEventHandler(async (event) => {
  await requireModeratorRight(event, "modAccessCustomFields");
  const db = getDb();

  const tags = await db
    .select()
    .from(communityTags)
    .orderBy(asc(communityTags.name));

  return { tags };
});
