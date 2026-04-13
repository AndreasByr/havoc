/**
 * Setup completion endpoint: grants superadmin to the first authenticated user.
 * Only works when:
 *  - At least one platform connection exists (setup step 3 completed)
 *  - No user has the superadmin permission role yet
 * After granting, the session is refreshed to include the new role.
 */
import { eq } from "drizzle-orm";
import { platformConnections, permissionRoles, userPermissionRoles } from "@guildora/shared";
import { getDb } from "../../utils/db";
import { requireSession } from "../../utils/auth";
import { replaceAuthSessionForUserId } from "../../utils/auth-session";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const userId = session.user.id;
  const db = getDb();

  // Ensure at least one platform connection exists
  const platforms = await db.select({ id: platformConnections.id }).from(platformConnections).limit(1);
  if (platforms.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Setup not ready: no platform connection configured yet."
    });
  }

  // Check if any user already has the superadmin role
  const superadminRole = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(eq(permissionRoles.name, "superadmin"))
    .limit(1);

  if (!superadminRole[0]) {
    throw createError({
      statusCode: 500,
      statusMessage: "Superadmin permission role not found. Run database seeds first."
    });
  }

  const existingSuperadmin = await db
    .select({ userId: userPermissionRoles.userId })
    .from(userPermissionRoles)
    .where(eq(userPermissionRoles.permissionRoleId, superadminRole[0].id))
    .limit(1);

  if (existingSuperadmin.length > 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "A superadmin already exists. Setup completion is no longer available."
    });
  }

  // Grant superadmin to the current user
  await db.insert(userPermissionRoles).values({
    userId,
    permissionRoleId: superadminRole[0].id
  }).onConflictDoNothing();

  // Refresh session so the new role is immediately available
  await replaceAuthSessionForUserId(event, userId);

  return { ok: true };
});
