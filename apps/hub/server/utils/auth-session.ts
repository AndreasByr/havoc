import { eq } from "drizzle-orm";
import { users } from "@guildora/shared";
import type { AppSession, AppSessionUser } from "./auth";
import { getCommunityRoleName, getUserRoles } from "./community";
import { getDb } from "./db";
import { loadModerationRights, defaultModerationRights } from "./moderation-rights";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export async function getSessionUserById(userId: string): Promise<AppSessionUser | null> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    return null;
  }

  const [permissionRoles, communityRole, moderationRights] = await Promise.all([
    getUserRoles(userId),
    getCommunityRoleName(userId),
    loadModerationRights(db).catch(() => defaultModerationRights)
  ]);

  return {
    id: user.id,
    discordId: user.discordId,
    profileName: user.displayName,
    avatarUrl: user.avatarUrl,
    permissionRoles,
    communityRole,
    moderationRights
  };
}

export async function replaceAuthSession(
  event: Parameters<typeof replaceUserSession>[0],
  sessionUser: AppSessionUser,
  originalUserId?: string | null
) {
  // Preserve CSRF token across session replacement so client-side token stays valid
  const existingSession = await getUserSession(event);

  const sessionData: AppSession = { user: sessionUser };
  if (originalUserId) {
    sessionData.originalUserId = originalUserId;
  }
  if (existingSession.csrfToken) {
    sessionData.csrfToken = existingSession.csrfToken;
  }

  const isDev = import.meta.dev || process.env.NODE_ENV === "development";
  const cookieDomain = process.env.NUXT_SESSION_COOKIE_DOMAIN || undefined;

  await replaceUserSession(
    event,
    sessionData,
    {
      maxAge: sessionMaxAgeSeconds,
      cookie: {
        maxAge: sessionMaxAgeSeconds,
        sameSite: "lax",
        secure: !isDev,
        httpOnly: true,
        domain: cookieDomain
      }
    }
  );
}

export async function replaceAuthSessionForUserId(
  event: Parameters<typeof replaceUserSession>[0],
  userId: string,
  originalUserId?: string | null
) {
  const sessionUser = await getSessionUserById(userId);
  if (!sessionUser) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }
  await replaceAuthSession(event, sessionUser, originalUserId);
  return sessionUser;
}
