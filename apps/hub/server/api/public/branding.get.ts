import { eq } from "drizzle-orm";
import { createError } from "h3";
import { communitySettings } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { COMMUNITY_SETTINGS_SINGLETON_ID } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
try {
  setResponseHeader(event, "Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  const db = getDb();
  const [row] = await db
    .select({ communityName: communitySettings.communityName, discordInviteCode: communitySettings.discordInviteCode })
    .from(communitySettings)
    .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
    .limit(1);

  return {
    communityName: row?.communityName ?? null,
    discordInviteCode: row?.discordInviteCode ?? null,
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
