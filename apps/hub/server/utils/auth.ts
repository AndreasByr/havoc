export interface ModerationRightsSession {
  modDeleteUsers: boolean;
  modManageApplications: boolean;
  modAccessCommunitySettings: boolean;
  modAccessDesign: boolean;
  modAccessApps: boolean;
  modAccessDiscordRoles: boolean;
}

/** Canonical field for technical roles is permissionRoles. roles is kept as optional alias for legacy sessions. */
export interface AppSessionUser {
  id: string;
  discordId?: string;
  profileName?: string;
  avatarUrl?: string | null;
  /** @deprecated Use permissionRoles. Kept for backward compatibility with existing sessions. */
  roles?: string[];
  permissionRoles?: string[];
  communityRole?: string | null;
  moderationRights?: ModerationRightsSession;
}

export interface AppSession {
  user: AppSessionUser;
  originalUserId?: string;
}

export const adminPermissionRoles = ["admin", "superadmin"] as const;
export const moderatorPermissionRoles = ["moderator", "admin", "superadmin"] as const;
export const staffPermissionRoles = ["admin", "moderator", "superadmin"] as const;

export async function requireSession(event: Parameters<typeof requireUserSession>[0]): Promise<AppSession> {
  try {
    const session = (await requireUserSession(event)) as AppSession;
    if (!session.user?.id) {
      throw new Error("Missing user id in session.");
    }
    return session;
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required."
    });
  }
}

export function requireRole(sessionUser: AppSessionUser, roles: readonly string[]) {
  const assignedRoles = sessionUser.permissionRoles ?? sessionUser.roles ?? [];
  const allowed = roles.some((role) => assignedRoles.includes(role));

  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden."
    });
  }
}

export function requireStaffRole(sessionUser: AppSessionUser) {
  requireRole(sessionUser, staffPermissionRoles);
}

export async function requireAdminSession(event: Parameters<typeof requireUserSession>[0]): Promise<AppSession> {
  const session = await requireSession(event);
  requireRole(session.user, adminPermissionRoles);
  return session;
}

export async function requireModeratorSession(event: Parameters<typeof requireUserSession>[0]): Promise<AppSession> {
  const session = await requireSession(event);
  requireRole(session.user, moderatorPermissionRoles);
  return session;
}

export async function requireSuperadminSession(event: Parameters<typeof requireUserSession>[0]): Promise<AppSession> {
  const session = await requireSession(event);
  requireRole(session.user, ["superadmin"]);
  return session;
}
