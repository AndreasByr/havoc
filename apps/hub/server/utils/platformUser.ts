import { eq, and } from "drizzle-orm";
import { users, userPlatformAccounts, profiles } from "@guildora/shared";
import { getDb } from "./db";
import type { PlatformType } from "./platformConfig";

export type PlatformUserInput = {
  platform: PlatformType;
  platformUserId: string;
  platformUsername?: string | null;
  platformAvatarUrl?: string | null;
  email?: string | null;
};

// ─── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Find a user by their external platform identity.
 * Searches user_platform_accounts first, then falls back to users.discord_id for backward compat.
 */
export async function getUserByPlatformId(
  platform: PlatformType,
  platformUserId: string
): Promise<{ id: string; discordId: string | null; displayName: string } | null> {
  const db = getDb();

  // Primary path: check user_platform_accounts
  const [linked] = await db
    .select({
      userId: userPlatformAccounts.userId,
      discordId: users.discordId,
      displayName: users.displayName
    })
    .from(userPlatformAccounts)
    .innerJoin(users, eq(userPlatformAccounts.userId, users.id))
    .where(
      and(
        eq(userPlatformAccounts.platform, platform),
        eq(userPlatformAccounts.platformUserId, platformUserId)
      )
    )
    .limit(1);

  if (linked) {
    return { id: linked.userId, discordId: linked.discordId, displayName: linked.displayName };
  }

  // Fallback: for Discord, also check users.discord_id (legacy users not yet in platform_accounts)
  if (platform === "discord") {
    const [legacyUser] = await db
      .select({ id: users.id, discordId: users.discordId, displayName: users.displayName })
      .from(users)
      .where(eq(users.discordId, platformUserId))
      .limit(1);

    return legacyUser ?? null;
  }

  return null;
}

/**
 * Legacy helper — wraps getUserByPlatformId for backward compatibility.
 */
export async function getUserByDiscordId(discordId: string) {
  return getUserByPlatformId("discord", discordId);
}

// ─── Create / Upsert ────────────────────────────────────────────────────────

/**
 * Ensure a user exists for the given platform identity.
 * - If found via platform_accounts → update avatar/username, return user
 * - If found via legacy discord_id → create platform_account link, return user
 * - If not found → create new user + profile + platform_account
 */
export async function ensurePlatformUser(input: PlatformUserInput): Promise<{
  userId: string;
  isNew: boolean;
}> {
  const db = getDb();
  const { platform, platformUserId, platformUsername, platformAvatarUrl, email } = input;

  // 1. Check if already linked
  const existing = await getUserByPlatformId(platform, platformUserId);
  if (existing) {
    // Update platform account metadata
    await db
      .update(userPlatformAccounts)
      .set({
        platformUsername: platformUsername ?? undefined,
        platformAvatarUrl: platformAvatarUrl ?? undefined
      })
      .where(
        and(
          eq(userPlatformAccounts.platform, platform),
          eq(userPlatformAccounts.platformUserId, platformUserId)
        )
      );

    return { userId: existing.id, isNew: false };
  }

  // 2. Create new user
  const displayName = platformUsername || platformUserId;
  const [newUser] = await db
    .insert(users)
    .values({
      discordId: platform === "discord" ? platformUserId : null,
      displayName,
      email: email ?? null,
      avatarUrl: platformAvatarUrl ?? null,
      avatarSource: platform,
      primaryPlatform: platform,
      lastLoginAt: new Date()
    })
    .returning({ id: users.id });

  // 3. Create profile
  await db.insert(profiles).values({ userId: newUser.id });

  // 4. Create platform account link
  await db.insert(userPlatformAccounts).values({
    userId: newUser.id,
    platform,
    platformUserId,
    platformUsername: platformUsername ?? null,
    platformAvatarUrl: platformAvatarUrl ?? null,
    isPrimary: true
  });

  return { userId: newUser.id, isNew: true };
}

// ─── Account Linking ────────────────────────────────────────────────────────

/**
 * Link an additional platform identity to an existing user.
 * Throws if the platform identity is already linked to a different user.
 */
export async function linkPlatformAccount(
  userId: string,
  input: Omit<PlatformUserInput, "email">
): Promise<void> {
  const db = getDb();
  const { platform, platformUserId, platformUsername, platformAvatarUrl } = input;

  // Check if this platform identity is already linked to someone
  const [existingLink] = await db
    .select({ userId: userPlatformAccounts.userId })
    .from(userPlatformAccounts)
    .where(
      and(
        eq(userPlatformAccounts.platform, platform),
        eq(userPlatformAccounts.platformUserId, platformUserId)
      )
    )
    .limit(1);

  if (existingLink) {
    if (existingLink.userId === userId) return; // already linked to this user
    throw new Error(`This ${platform} account is already linked to a different user.`);
  }

  await db.insert(userPlatformAccounts).values({
    userId,
    platform,
    platformUserId,
    platformUsername: platformUsername ?? null,
    platformAvatarUrl: platformAvatarUrl ?? null,
    isPrimary: false
  });

  // Also update users.discord_id for backward compatibility if linking Discord
  if (platform === "discord") {
    const [user] = await db
      .select({ discordId: users.discordId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user && !user.discordId) {
      await db
        .update(users)
        .set({ discordId: platformUserId })
        .where(eq(users.id, userId));
    }
  }
}
