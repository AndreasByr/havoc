/**
 * Matrix authentication endpoint.
 *
 * Flow:
 * 1. GET /api/auth/matrix → redirects to Matrix homeserver login page (Element-based)
 * 2. GET /api/auth/matrix?loginToken=... → exchanges login token for access, resolves MXID, creates session
 *
 * For now, supports SSO/CAS login flow via Matrix's redirect-based auth.
 * The admin must configure their homeserver to support SSO login.
 *
 * Alternative: Direct token login — user provides their Matrix access token manually
 * via POST /api/auth/matrix with { accessToken, homeserverUrl }.
 */

import { ensurePlatformUser } from "../../utils/platformUser";
import { getMatrixCredentials } from "../../utils/platformConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const credentials = await getMatrixCredentials();

  if (!credentials) {
    throw createError({ statusCode: 503, statusMessage: "Matrix is not configured for this community." });
  }

  const { homeserverUrl } = credentials;

  // Step 1: Redirect to Matrix SSO login
  if (!query.loginToken) {
    const redirectUri = getRequestURL(event).origin + "/api/auth/matrix";
    const ssoUrl = `${homeserverUrl}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectUri)}`;
    return sendRedirect(event, ssoUrl);
  }

  // Step 2: Exchange login token for access token + resolve MXID
  const loginToken = query.loginToken as string;

  try {
    // Exchange login token via Matrix Client-Server API
    const loginResponse = await $fetch<{
      user_id: string;
      access_token: string;
      device_id: string;
    }>(`${homeserverUrl}/_matrix/client/v3/login`, {
      method: "POST",
      body: {
        type: "m.login.token",
        token: loginToken
      }
    });

    const mxid = loginResponse.user_id; // e.g. @andreas:myweby.org

    // Fetch Matrix profile for display name and avatar
    let displayName = mxid;
    let avatarUrl: string | null = null;
    try {
      const profile = await $fetch<{ displayname?: string; avatar_url?: string }>(
        `${homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(mxid)}`
      );
      if (profile.displayname) displayName = profile.displayname;
      if (profile.avatar_url) {
        // Convert mxc:// URL to HTTP URL
        const mxcMatch = profile.avatar_url.match(/^mxc:\/\/([^/]+)\/(.+)$/);
        if (mxcMatch) {
          avatarUrl = `${homeserverUrl}/_matrix/media/v3/thumbnail/${mxcMatch[1]}/${mxcMatch[2]}?width=128&height=128&method=crop`;
        }
      }
    } catch {
      // Profile fetch failed — use MXID as display name
    }

    // Ensure user exists in Guildora
    const { userId } = await ensurePlatformUser({
      platform: "matrix",
      platformUserId: mxid,
      platformUsername: displayName,
      platformAvatarUrl: avatarUrl,
    });

    // Check for account linking: if user is already logged in via another platform
    const linkMode = query.link === "true";
    if (linkMode) {
      try {
        const existingSession = await getUserSession(event);
        if (existingSession?.user?.id) {
          const { linkPlatformAccount } = await import("../../utils/platformUser");
          await linkPlatformAccount(existingSession.user.id, {
            platform: "matrix",
            platformUserId: mxid,
            platformUsername: displayName,
            platformAvatarUrl: avatarUrl,
          });
          return sendRedirect(event, "/profile?linked=matrix");
        }
      } catch {
        // No existing session — proceed with normal login
      }
    }

    // Create session
    // We need to load the user's permission roles from DB
    const { getDb } = await import("../../utils/db");
    const { eq } = await import("drizzle-orm");
    const { users, userPermissionRoles, permissionRoles } = await import("@guildora/shared");

    const db = getDb();
    const roleRows = await db
      .select({ roleName: permissionRoles.name })
      .from(userPermissionRoles)
      .innerJoin(permissionRoles, eq(userPermissionRoles.permissionRoleId, permissionRoles.id))
      .where(eq(userPermissionRoles.userId, userId));

    const permRoles = roleRows.map((r) => r.roleName);

    await replaceUserSession(event, {
      user: {
        id: userId,
        profileName: displayName,
        avatarUrl,
        permissionRoles: permRoles,
        platform: "matrix",
        platformUserId: mxid,
      },
      csrfToken: crypto.randomUUID(),
    });

    // Logout the temporary Matrix access token (we don't need it)
    try {
      await $fetch(`${homeserverUrl}/_matrix/client/v3/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${loginResponse.access_token}` }
      });
    } catch {
      // Ignore logout errors
    }

    const returnTo = (query.returnTo as string) || "/dashboard";
    return sendRedirect(event, returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matrix login failed.";
    console.error("[auth/matrix] Login failed:", message);
    throw createError({ statusCode: 401, statusMessage: `Matrix login failed: ${message}` });
  }
});
