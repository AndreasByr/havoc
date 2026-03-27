import { eq } from "drizzle-orm";
import { users } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { getMediaService, extractMediaKeyFromUrl } from "../../utils/media";
import { replaceAuthSessionForUserId } from "../../utils/auth-session";
import { fetchDiscordGuildMemberFromBot } from "../../utils/botSync";
import { persistDiscordAvatarLocally } from "../../utils/avatar-storage";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const userId = session.user.id;
  const db = getDb();

  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }

  // Delete uploaded file if applicable
  if (userRow.avatarSource === "upload" && userRow.avatarUrl) {
    const key = extractMediaKeyFromUrl(userRow.avatarUrl);
    if (key) {
      await getMediaService().delete(key).catch(() => {});
    }
  }

  // Try to fetch and persist the Discord avatar
  let discordAvatarUrl: string | null = null;
  try {
    const { member } = await fetchDiscordGuildMemberFromBot(userRow.discordId);
    if (member?.avatarUrl) {
      // Extract avatar hash from Discord CDN URL
      // Format: https://cdn.discordapp.com/avatars/{id}/{hash}.png?size=256
      const match = member.avatarUrl.match(/\/avatars\/[^/]+\/([^.?]+)/);
      const avatarHash = match?.[1];
      if (avatarHash) {
        discordAvatarUrl = await persistDiscordAvatarLocally(userRow.discordId, avatarHash);
      }
    }
  } catch {
    // Bot not reachable or member not found — fall back to null
  }

  const avatarSource = discordAvatarUrl ? "local" : "discord";
  await db
    .update(users)
    .set({ avatarUrl: discordAvatarUrl, avatarSource })
    .where(eq(users.id, userId));

  // Refresh session
  await replaceAuthSessionForUserId(event, userId, session.originalUserId);

  return { avatarUrl: discordAvatarUrl, avatarSource };
});
