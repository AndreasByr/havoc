import { eq } from "drizzle-orm";
import { communitySettings } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { COMMUNITY_SETTINGS_SINGLETON_ID } from "../../utils/community-settings";
import { normalizeCommunityDefaultLocale } from "../../../utils/locale-preference";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();
  const [row] = await db
    .select({
      communityName: communitySettings.communityName,
      discordInviteCode: communitySettings.discordInviteCode,
      defaultLocale: communitySettings.defaultLocale,
      displayNameTemplate: communitySettings.displayNameTemplate
    })
    .from(communitySettings)
    .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
    .limit(1);

  return {
    communityName: row?.communityName ?? null,
    discordInviteCode: row?.discordInviteCode ?? null,
    defaultLocale: normalizeCommunityDefaultLocale(row?.defaultLocale, "en"),
    displayNameTemplate: row?.displayNameTemplate ?? []
  };
});
