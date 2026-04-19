import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { getDb } from "../../utils/db";
import {
  normalizeUserLocalePreference,
  readLegacyLocalePreferenceFromCustomFields,
  resolveEffectiveLocale
} from "../../../utils/locale-preference";
import { loadCommunitySettingsLocale } from "../../utils/community-settings";

type EventUserSession = {
  user?: {
    id?: string;
  };
} | null;

export default defineEventHandler(async (event) => {
  const db = getDb();
  const communityDefaultLocale = await loadCommunitySettingsLocale(db);

  const session = (event.context.userSession ?? null) as EventUserSession;
  const userId = typeof session?.user?.id === "string" ? session.user.id : null;

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
});
