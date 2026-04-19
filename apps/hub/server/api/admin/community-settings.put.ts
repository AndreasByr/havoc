import { z } from "zod";
import { eq } from "drizzle-orm";
import { communitySettings, displayNameTemplateSchema } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";
import { localePreferences, normalizeCommunityDefaultLocale } from "../../../utils/locale-preference";
import { COMMUNITY_SETTINGS_SINGLETON_ID, invalidateCommunitySettingsCache } from "../../utils/community-settings";

const schema = z.object({
  communityName: z.string().trim().max(200).nullable(),
  discordInviteCode: z.string().trim().max(20).regex(/^[a-zA-Z0-9-]*$/, "Invalid Discord invite code").nullable().optional(),
  defaultLocale: z.enum(localePreferences).optional(),
  displayNameTemplate: displayNameTemplateSchema.optional()
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");

  const db = getDb();
  const [existing] = await db
    .select()
    .from(communitySettings)
    .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
    .limit(1);

  const value = parsed.communityName === "" ? null : parsed.communityName;
  const discordInviteCode = parsed.discordInviteCode === "" ? null : (parsed.discordInviteCode ?? existing?.discordInviteCode ?? null);
  const defaultLocale = normalizeCommunityDefaultLocale(parsed.defaultLocale ?? existing?.defaultLocale, "en");
  const displayNameTemplate = parsed.displayNameTemplate ?? (existing?.displayNameTemplate as typeof parsed.displayNameTemplate) ?? [];

  if (existing) {
    await db
      .update(communitySettings)
      .set({
        communityName: value,
        discordInviteCode,
        defaultLocale,
        displayNameTemplate,
        updatedAt: new Date(),
        updatedBy: session.user.id
      })
      .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID));
  } else {
    await db.insert(communitySettings).values({
      id: COMMUNITY_SETTINGS_SINGLETON_ID,
      communityName: value,
      discordInviteCode,
      defaultLocale,
      displayNameTemplate,
      updatedBy: session.user.id
    });
  }

  invalidateCommunitySettingsCache();

  return { communityName: value, discordInviteCode, defaultLocale, displayNameTemplate };
});
