import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { z } from "zod";
import { localePreferences, normalizeUserLocalePreference, resolveEffectiveLocale } from "../../../utils/locale-preference";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";
import { jsonResponse } from "../../utils/jsonResponse";
import { upsertProfileDetails } from "../../utils/profile-write";
import { loadCommunitySettingsLocale } from "../../utils/community-settings";
import { readAppearancePreferenceFromCustomFields } from "../../../utils/appearance";

const schema = z.object({
  localePreference: z.enum(localePreferences).nullable()
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const db = getDb();
  const parsed = await readBodyWithSchema(event, schema, "Invalid locale payload.");

  const existingProfileRows = await db.select().from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
  const existingCustomFields = (existingProfileRows[0]?.customFields || {}) as Record<string, unknown>;

  const normalizedLocalePreference = normalizeUserLocalePreference(parsed.localePreference, null);
  const updatedProfile = await upsertProfileDetails(
    db,
    session.user.id,
    {
      customFields: existingCustomFields,
      localePreference: normalizedLocalePreference
    },
    "self"
  );

  const communityDefaultLocale = await loadCommunitySettingsLocale(db);
  const effectiveLocale = resolveEffectiveLocale({
    userLocalePreference: normalizedLocalePreference,
    communityDefaultLocale
  });

  return jsonResponse({
    localePreference: normalizedLocalePreference,
    effectiveLocale: effectiveLocale.locale,
    localeSource: effectiveLocale.source,
    appearancePreference: readAppearancePreferenceFromCustomFields(updatedProfile.profileRow?.customFields ?? existingCustomFields)
  });
});
