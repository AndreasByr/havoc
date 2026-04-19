import { requireSession } from "../../utils/auth";
import { getSessionUserById, replaceAuthSession } from "../../utils/auth-session";
import { assertDevRoleSwitcherAccess, hasModeratorAccess } from "../../utils/dev-role-switcher";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  assertDevRoleSwitcherAccess(event, session);

  if (!session.originalUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No original user is set."
    });
  }

  const originalUser = await getSessionUserById(session.originalUserId);
  if (!originalUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found."
    });
  }

  const originalRoles = originalUser.permissionRoles ?? originalUser.roles ?? [];
  if (!hasModeratorAccess(originalRoles)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden."
    });
  }

  await replaceAuthSession(event, originalUser);

  return {
    success: true,
    restoredUserId: originalUser.id
  };
});
