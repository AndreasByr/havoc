import { communitySettings } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not Found." });
  }

  const db = getDb();

  // Delete the singleton community_settings row (id is always 1)
  await db.delete(communitySettings).where(eq(communitySettings.id, 1));

  return { success: true };
});
