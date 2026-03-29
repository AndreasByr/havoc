import { eq } from "drizzle-orm";
import { parseProfileName, users } from "@guildora/shared";
import { requireModeratorSession } from "../../../../utils/auth";
import { syncDiscordUserFromWebsite } from "../../../../utils/botSync";
import { loadDisplayNameTemplate } from "../../../../utils/community-settings";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";
import { jsonResponse } from "../../../../utils/jsonResponse";
import { updateModProfileSchema, updateUserDisplayName, updateUserDisplayNameFromTemplate, upsertProfileDetails } from "../../../../utils/profile-write";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const targetUserId = requireRouterParam(event, "id", "User id is required.");
  const parsed = await readBodyWithSchema(event, updateModProfileSchema, "Invalid moderation profile payload.");

  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  const userRow = userRows[0];
  if (!userRow) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }

  const displayNameTemplate = await loadDisplayNameTemplate(db);
  let profileName: string;
  if (parsed.displayNameParts && displayNameTemplate.length > 0) {
    profileName = await updateUserDisplayNameFromTemplate(db, targetUserId, displayNameTemplate, parsed.displayNameParts);
  } else {
    profileName = await updateUserDisplayName(db, targetUserId, {
      ingameName: parsed.ingameName,
      rufname: parsed.rufname
    });
  }
  const updatedProfile = await upsertProfileDetails(
    db,
    targetUserId,
    {},
    "moderation"
  );

  await syncDiscordUserFromWebsite({
    discordId: userRow.discordId,
    profileName
  });

  const parsedName = parseProfileName(profileName);
  const profileRow = updatedProfile.profileRow;

  return jsonResponse({
    userId: targetUserId,
    profileName,
    ingameName: parsedName.ingameName,
    rufname: parsedName.rufname,
    customFields: profileRow?.customFields ?? updatedProfile.customFields
  });
});
