import { eq } from "drizzle-orm";
import { createError } from "h3";
import { profiles } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { requireSession } from "../../utils/auth";
import {
  normalizeUserLocalePreference,
  readLegacyLocalePreferenceFromCustomFields,
  resolveEffectiveLocale
} from "../../../utils/locale-preference";
import { loadCommunitySettingsLocale } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
try {
  const session = await requireSession(event);
  const db = getDb();
  const communityDefaultLocale = await loadCommunitySettingsLocale(db);

  const userId = session.user.id;

  let localePreference = null;
  if (userId) {
    const [profile] = await db
      .select({ localePreference: profiles.localePreference, customFields: profiles.customFields })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    localePreference = normalizeUserLocalePreference(
      profile?.localePreference ?? readLegacyLocalePreferenceFromCustomFields(profile?.customFields ?? {}),
      null
    );
  }

  const effectiveLocale = resolveEffectiveLocale({
    userLocalePreference: localePreference,
    communityDefaultLocale
  });

  return {
    localePreference,
    communityDefaultLocale,
    effectiveLocale: effectiveLocale.locale,
    localeSource: effectiveLocale.source,
    hasSession: Boolean(userId)
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
