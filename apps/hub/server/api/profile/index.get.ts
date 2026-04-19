import { and, eq, gte } from "drizzle-orm";
import {
  parseProfileName,
  parseWithTemplate,
  users,
  voiceSessions
} from "@guildora/shared";
import { readAppearancePreferenceFromCustomFields } from "../../../utils/appearance";
import { normalizeUserLocalePreference, readLegacyLocalePreferenceFromCustomFields, resolveEffectiveLocale } from "../../../utils/locale-preference";
import { requireSession, requireStaffRole } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { buildEditableDiscordRolesForUser } from "../../utils/discord-roles";
import { jsonResponse } from "../../utils/jsonResponse";
import { loadUserCommunityRolesMap, loadUserPermissionRolesMap, loadUserProfilesMap } from "../../utils/user-directory";
import { calculateVoiceMinutesFromSessions, classifyVoiceActivity } from "../../utils/voice";
import { loadCommunitySettingsLocale, loadDisplayNameTemplate } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
  const db = getDb();
  const session = await requireSession(event);
  const query = getQuery(event);
  const requestedUserId = typeof query.id === "string" ? query.id : session.user.id;

  if (requestedUserId !== session.user.id) {
    requireStaffRole(session.user);
  }

  const userRows = await db.select().from(users).where(eq(users.id, requestedUserId)).limit(1);
  if (userRows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }
  const userRow = userRows[0];
  if (!userRow) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }

  const [profileMap, permissionMap, communityMap, sessionRows] = await Promise.all([
    loadUserProfilesMap(db, [requestedUserId]),
    loadUserPermissionRolesMap(db, [requestedUserId]),
    loadUserCommunityRolesMap(db, [requestedUserId]),
    db
      .select({
        startedAt: voiceSessions.startedAt,
        endedAt: voiceSessions.endedAt,
        durationMinutes: voiceSessions.durationMinutes
      })
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, requestedUserId),
          gte(voiceSessions.startedAt, new Date(Date.now() - 28 * 24 * 60 * 60 * 1000))
        )
      )
  ]);

  const profile = profileMap.get(requestedUserId) || {
    customFields: {},
    localePreference: null
  };
  const appearancePreference = readAppearancePreferenceFromCustomFields(profile.customFields ?? {});
  const localePreference = normalizeUserLocalePreference(
    profile.localePreference ?? readLegacyLocalePreferenceFromCustomFields(profile.customFields ?? {}),
    null
  );
  const communityDefaultLocale = await loadCommunitySettingsLocale(db);
  const effectiveLocale = resolveEffectiveLocale({
    userLocalePreference: localePreference,
    communityDefaultLocale
  });

  const minutes7d = calculateVoiceMinutesFromSessions(sessionRows, 7);
  const minutes14d = calculateVoiceMinutesFromSessions(sessionRows, 14);
  const minutes28d = calculateVoiceMinutesFromSessions(sessionRows, 28);
  const hours7d = Math.round((minutes7d / 60) * 100) / 100;
  const parsedName = parseProfileName(userRow.displayName);
  const permissionRolesForUser = permissionMap.get(requestedUserId) || [];
  const displayNameTemplate = await loadDisplayNameTemplate(db);
  const displayNameParts = displayNameTemplate.length > 0
    ? parseWithTemplate(userRow.displayName, displayNameTemplate)
    : undefined;

  const body = {
    id: userRow.id,
    discordId: userRow.discordId,
    profileName: userRow.displayName,
    ingameName: parsedName.ingameName,
    rufname: parsedName.rufname,
    displayNameTemplate,
    displayNameParts,
    avatarUrl: userRow.avatarUrl,
    avatarSource: userRow.avatarSource,
    permissionRoles: permissionRolesForUser,
    roles: permissionRolesForUser,
    communityRole: communityMap.get(requestedUserId)?.name ?? null,
    appearancePreference,
    localePreference,
    effectiveLocale: effectiveLocale.locale,
    localeSource: effectiveLocale.source,
    customFields: profile.customFields || {},
    editableDiscordRoles: await buildEditableDiscordRolesForUser(requestedUserId),
    voiceSummary: {
      minutes7d,
      minutes14d,
      minutes28d,
      hours7d,
      label: classifyVoiceActivity(hours7d)
    }
  };
  return jsonResponse(body);
});
