import { requireModeratorSession } from "../../../utils/auth";
import { listCommunityRoles, listPermissionRoles } from "../../../utils/community";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const [community, permission] = await Promise.all([listCommunityRoles(), listPermissionRoles()]);
  return {
    communityRoles: community,
    permissionRoles: permission
  };
});
