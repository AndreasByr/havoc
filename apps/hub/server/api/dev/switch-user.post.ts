import { z } from "zod";
import { requireSession } from "../../utils/auth";
import { getSessionUserById, replaceAuthSession } from "../../utils/auth-session";
import { assertDevRoleSwitcherAccess } from "../../utils/dev-role-switcher";

const schema = z.object({
  userId: z.string().uuid()
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  assertDevRoleSwitcherAccess(event, session);

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload."
    });
  }

  const targetUser = await getSessionUserById(parsed.data.userId);
  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found."
    });
  }

  const originalUserId = session.originalUserId ?? session.user.id;
  await replaceAuthSession(event, targetUser, originalUserId);

  return {
    success: true,
    switchedTo: {
      id: targetUser.id,
      profileName: targetUser.profileName ?? null,
      permissionRoles: targetUser.permissionRoles ?? [],
      communityRole: targetUser.communityRole ?? null
    },
    originalUserId
  };
});
