import { requireModeratorSession } from "../../../utils/auth";
import { createError } from "h3";
import { listCommunityRoles, listPermissionRoles } from "../../../utils/community";

export default defineEventHandler(async (event) => {
try {
  await requireModeratorSession(event);

  const [community, permission] = await Promise.all([listCommunityRoles(), listPermissionRoles()]);
  return {
    communityRoles: community,
    permissionRoles: permission
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
