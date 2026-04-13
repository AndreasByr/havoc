import crypto from "node:crypto";
import { checkRateLimit, getRateLimitKey } from "../../utils/rate-limit";
import { collectMappedRolesForMember } from "../../utils/admin-mirror";
import { fetchDiscordGuildMemberFromBot, fetchDiscordGuildRolesFromBot, type DiscordGuildRole } from "../../utils/botSync";
import { coerceProfileNameFromRaw, users } from "@guildora/shared";
import { eq } from "drizzle-orm";
import { replaceAuthSessionForUserId } from "../../utils/auth-session";
import { ensureCommunityUser, ensureUserProfile, getUserByDiscordId, listActiveCommunityRoleMappings, upsertCommunityRoleAssignment } from "../../utils/community";
import { replaceUserDiscordRolesSnapshotFromMember } from "../../utils/discord-roles";
import { persistDiscordAvatarLocally } from "../../utils/avatar-storage";
import { loadMembershipSettings } from "../../utils/membership-settings";
import { getDb } from "../../utils/db";
import { normalizeReturnTo } from "../../utils/redirect-safety";

type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string;
  avatar?: string | null;
  email?: string | null;
};

function resolvePrimaryDiscordRoleName(roleIds: string[], guildRoles: DiscordGuildRole[]): string | null {
  const roleById = new Map(guildRoles.map((role) => [role.id, role]));
  let topRole: DiscordGuildRole | null = null;

  for (const roleId of roleIds) {
    const role = roleById.get(roleId);
    if (!role) continue;
    if (!topRole || role.position > topRole.position) {
      topRole = role;
    }
  }

  return topRole?.name ?? null;
}

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type DiscordOauthStatePayload = {
  nonce: string;
  returnTo: string;
};

const oauthStateCookieName = "guildora_discord_oauth_state";
const oauthStateTtlSeconds = 60 * 10;

function encodeOauthState(payload: DiscordOauthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeOauthState(value: string): DiscordOauthStatePayload | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<DiscordOauthStatePayload>;
    if (
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length < 16 ||
      parsed.nonce.length > 128 ||
      typeof parsed.returnTo !== "string" ||
      parsed.returnTo.length === 0 ||
      parsed.returnTo.length > 2048
    ) {
      return null;
    }
    return {
      nonce: parsed.nonce,
      returnTo: parsed.returnTo
    };
  } catch {
    return null;
  }
}

function timingSafeEqualString(input: string, expected: string) {
  const inputBuffer = Buffer.from(input, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const maxLen = Math.max(inputBuffer.length, expectedBuffer.length);
  const paddedInput = Buffer.concat([inputBuffer, Buffer.alloc(maxLen - inputBuffer.length)]);
  const paddedExpected = Buffer.concat([expectedBuffer, Buffer.alloc(maxLen - expectedBuffer.length)]);
  return crypto.timingSafeEqual(paddedInput, paddedExpected);
}

export default defineEventHandler(async (event) => {
  checkRateLimit(getRateLimitKey(event, 'auth'), { windowMs: 60000, max: 10 });
  const config = useRuntimeConfig(event);
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : null;
  const state = typeof query.state === "string" ? query.state : null;
  const isDev = import.meta.dev || process.env.NODE_ENV === "development";
  const sessionCookieConfig = (config as { session?: { cookie?: { secure?: boolean } } }).session?.cookie;
  const secureCookie = sessionCookieConfig?.secure ?? true;
  const devBypassEnabled = isDev && config.authDevBypass === true;
  const superadminDiscordId = typeof config.superadminDiscordId === "string" ? config.superadminDiscordId : "";

  if (isDev && devBypassEnabled) {
    if (!superadminDiscordId) {
      throw createError({
        statusCode: 503,
        statusMessage: "SUPERADMIN_DISCORD_ID is not configured for development login bypass."
      });
    }

    const returnTo = normalizeReturnTo(typeof query.returnTo === "string" ? query.returnTo : null);
    const existingUser = await getUserByDiscordId(superadminDiscordId);
    const profileName = existingUser
      ? existingUser.displayName
      : coerceProfileNameFromRaw(`discord-${superadminDiscordId}`, `discord-${superadminDiscordId}`);
    const dbUser = await ensureCommunityUser({
      discordId: superadminDiscordId,
      profileName,
      avatarUrl: existingUser?.avatarUrl ?? null,
      email: existingUser?.email ?? null,
      superadminDiscordId
    });
    await ensureUserProfile(dbUser.id);
    try {
      const [memberResponse, rolesResponse] = await Promise.all([
        fetchDiscordGuildMemberFromBot(superadminDiscordId),
        fetchDiscordGuildRolesFromBot()
      ]);
      if (memberResponse.member) {
        await replaceUserDiscordRolesSnapshotFromMember(dbUser.id, memberResponse.member, rolesResponse.roles);
      }
    } catch {
      // Optional in dev bypass - authentication should still work without bot connectivity.
    }
    await replaceAuthSessionForUserId(event, dbUser.id);
    return sendRedirect(event, returnTo);
  }

  const clientId = typeof config.discordClientId === "string" ? config.discordClientId : "";
  const clientSecret = typeof config.discordClientSecret === "string" ? config.discordClientSecret : "";
  const hubUrl = typeof config.public.hubUrl === "string" ? config.public.hubUrl : "http://localhost:3003";
  const redirectUri =
    typeof config.discordRedirectUri === "string" && config.discordRedirectUri.length > 0
      ? config.discordRedirectUri
      : `${hubUrl}/api/auth/discord`;

  if (!clientId || !clientSecret) {
    const missing: string[] = [];
    if (!clientId) missing.push("NUXT_OAUTH_DISCORD_CLIENT_ID");
    if (!clientSecret) missing.push("NUXT_OAUTH_DISCORD_CLIENT_SECRET");
    throw createError({
      statusCode: 503,
      statusMessage: "Discord OAuth is not configured.",
      message: `Set ${missing.join(" and ")} in the repo root .env or in apps/hub/.env, then restart the dev server. See README for Discord OAuth setup.`
    });
  }

  if (!code) {
    const normalizedReturnTo = normalizeReturnTo(typeof query.returnTo === "string" ? query.returnTo : "/dashboard");
    const stateNonce = crypto.randomUUID();
    const state = encodeOauthState({
      nonce: stateNonce,
      returnTo: normalizedReturnTo
    });

    setCookie(event, oauthStateCookieName, stateNonce, {
      httpOnly: true,
      maxAge: oauthStateTtlSeconds,
      sameSite: "lax",
      secure: secureCookie,
      path: "/"
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify email",
      state
    });

    return sendRedirect(event, `https://discord.com/api/oauth2/authorize?${params.toString()}`);
  }

  const statePayload = state ? decodeOauthState(state) : null;
  const storedStateNonce = getCookie(event, oauthStateCookieName) ?? "";
  deleteCookie(event, oauthStateCookieName, { path: "/" });
  if (!statePayload || !storedStateNonce || !timingSafeEqualString(statePayload.nonce, storedStateNonce)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state."
    });
  }
  const targetPath = normalizeReturnTo(statePayload.returnTo);

  try {
    const tokenResponse = await $fetch<DiscordTokenResponse>("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const discordUser = await $fetch<DiscordUser>("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`
      }
    });

    const configuredSuperadminDiscordId = superadminDiscordId.length > 0 ? superadminDiscordId : null;
    const isSuperadminLogin = Boolean(configuredSuperadminDiscordId && configuredSuperadminDiscordId === discordUser.id);

    const [botMember, guildRolesResponse] = await Promise.all([
      fetchDiscordGuildMemberFromBot(discordUser.id),
      fetchDiscordGuildRolesFromBot()
    ]);
    const guildRoles = guildRolesResponse.roles;
    const sourceProfileName = botMember.member?.nickname || botMember.member?.displayName || discordUser.global_name || discordUser.username || `discord-${discordUser.id}`;
    const profileName = coerceProfileNameFromRaw(sourceProfileName, `discord-${discordUser.id}`);
    const db = getDb();
    const membershipConfig = await loadMembershipSettings(db);
    const applicationsRequired = membershipConfig.applicationsRequired;
    const activeMappings = await listActiveCommunityRoleMappings();
    const matchedMappings = botMember.member ? collectMappedRolesForMember(botMember.member.roleIds, activeMappings) : [];

    // Determine the target community role for this login
    let autoLoginRoleId: number | null = null;

    if (!isSuperadminLogin) {
      if (!applicationsRequired) {
        // AUTO-LOGIN MODE: applications disabled, allow direct login for guild members
        if (!botMember.member) {
          return sendRedirect(event, `/login?error=not_guild_member`);
        }
        if (membershipConfig.requiredLoginRoleId) {
          if (!botMember.member.roleIds.includes(membershipConfig.requiredLoginRoleId)) {
            return sendRedirect(event, `/login?error=missing_required_role`);
          }
        }
        if (!membershipConfig.defaultCommunityRoleId) {
          return sendRedirect(event, `/login?error=auto_login_not_configured`);
        }
        autoLoginRoleId = membershipConfig.defaultCommunityRoleId;
      } else {
        // APPLICATION-BASED FLOW: unchanged behavior
        if (!botMember.member) {
          throw createError({ statusCode: 403, statusMessage: "Discord member is not part of the server." });
        }
        if (matchedMappings.length !== 1) {
          throw createError({
            statusCode: 403,
            statusMessage: matchedMappings.length === 0
              ? "No mapped community role found for this Discord account."
              : "Multiple mapped community roles found. Please contact an administrator."
          });
        }
      }
    }

    const existingUser = await getUserByDiscordId(discordUser.id);
    const hasCustomAvatar = existingUser?.avatarSource === "upload";

    let localAvatarUrl: string | null = null;
    if (discordUser.avatar && !hasCustomAvatar) {
      try {
        localAvatarUrl = await persistDiscordAvatarLocally(discordUser.id, discordUser.avatar);
      } catch (avatarError) {
        console.warn("Local avatar persistence failed:", avatarError);
      }
    }

    const primaryDiscordRoleName = botMember.member
      ? resolvePrimaryDiscordRoleName(botMember.member.roleIds, guildRoles)
      : null;
    const resolvedAvatarUrl = hasCustomAvatar
      ? existingUser.avatarUrl
      : localAvatarUrl ?? existingUser?.avatarUrl ?? null;
    const avatarSource = hasCustomAvatar
      ? "upload"
      : localAvatarUrl
        ? "local"
        : existingUser?.avatarSource ?? null;

    const dbUser = await ensureCommunityUser({
      discordId: discordUser.id,
      profileName,
      avatarUrl: resolvedAvatarUrl,
      avatarSource,
      primaryDiscordRoleName,
      email: discordUser.email ?? null,
      superadminDiscordId: configuredSuperadminDiscordId
    });

    // Assign community role based on login mode
    if (autoLoginRoleId) {
      // Auto-login mode: use configured default community role
      await ensureUserProfile(dbUser.id);
      await upsertCommunityRoleAssignment(dbUser.id, autoLoginRoleId);
    } else if (matchedMappings.length === 1) {
      await ensureUserProfile(dbUser.id);
      await upsertCommunityRoleAssignment(dbUser.id, matchedMappings[0]!.id);
    } else if (isSuperadminLogin) {
      await ensureUserProfile(dbUser.id);
    }
    if (botMember.member) {
      await replaceUserDiscordRolesSnapshotFromMember(dbUser.id, botMember.member, guildRoles);
    }

    // Update last login timestamp
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, dbUser.id));

    await replaceAuthSessionForUserId(event, dbUser.id);

    const encodedPath = targetPath.replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${encodedPath}"><script>window.location.replace(${JSON.stringify(targetPath)});</script></head><body><p>Weiterleitung zu <a href="${encodedPath}">${encodedPath}</a> …</p></body></html>`;
    return send(event, html, "text/html");
  } catch (error) {
    // Re-throw intentional HTTP errors (403, 400, etc.) so they render proper error pages
    // instead of redirecting to /login (which causes an infinite loop in dev mode).
    if (isError(error)) throw error;
    console.error("Discord OAuth failed:", error);
    if (error instanceof Error && error.name === "BotBridgeError") {
      throw createError({
        statusCode: 503,
        statusMessage: "Bot service unavailable",
        message: "The Discord bot is not reachable. Please try again later or contact an admin."
      });
    }
    const msg = error instanceof Error ? error.message : String(error);
    const isDbError =
      msg.includes("Failed query") ||
      msg.includes("relation") ||
      msg.includes("does not exist") ||
      msg.includes("column");
    if (isDbError) {
      throw createError({
        statusCode: 503,
        statusMessage: "Database not ready",
        message:
          `Community roles could not be loaded. Ensure DATABASE_URL is set and migrations are applied (pnpm db:migrate). Cause: ${msg}`,
        cause: error
      });
    }
    return sendRedirect(event, "/login");
  }
});
