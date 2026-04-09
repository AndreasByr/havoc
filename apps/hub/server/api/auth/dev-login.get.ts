import { coerceProfileNameFromRaw, users } from "@guildora/shared";
import { eq } from "drizzle-orm";
import { replaceAuthSessionForUserId } from "../../utils/auth-session";
import { ensureCommunityUser, ensureUserProfile, getUserByDiscordId } from "../../utils/community";
import { getDb } from "../../utils/db";

const DEV_USER_DISCORD_ID = "000000000000000000";
const DEV_USER_DISPLAY_NAME = "Dev Superadmin";
const DEV_USER_EMAIL = "dev@localhost";

export default defineEventHandler(async (event) => {
  const isDev = import.meta.dev || process.env.NODE_ENV === "development";
  const config = useRuntimeConfig(event);
  const devBypassEnabled = isDev && config.authDevBypass === true;

  if (!devBypassEnabled) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found"
    });
  }

  const query = getQuery(event);
  const rawReturnTo = typeof query.returnTo === "string" ? query.returnTo : null;
  let returnTo = "/dashboard";
  if (rawReturnTo) {
    try {
      returnTo = decodeURIComponent(rawReturnTo);
    } catch {
      returnTo = rawReturnTo;
    }
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
      returnTo = "/dashboard";
    }
  }

  const existingUser = await getUserByDiscordId(DEV_USER_DISCORD_ID);
  const profileName = existingUser?.displayName ?? DEV_USER_DISPLAY_NAME;

  const dbUser = await ensureCommunityUser({
    discordId: DEV_USER_DISCORD_ID,
    profileName,
    avatarUrl: existingUser?.avatarUrl ?? null,
    email: existingUser?.email ?? DEV_USER_EMAIL,
    superadminDiscordId: DEV_USER_DISCORD_ID
  });

  await ensureUserProfile(dbUser.id);

  // Update last login timestamp
  const db = getDb();
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, dbUser.id));

  await replaceAuthSessionForUserId(event, dbUser.id);
  return sendRedirect(event, returnTo);
});
