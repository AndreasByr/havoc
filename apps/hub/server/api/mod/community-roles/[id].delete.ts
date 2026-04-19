import { requireAdminSession } from "../../../utils/auth";
import { deleteCommunityRole, parseCommunityRoleId } from "../../../utils/community-roles";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const params = getRouterParams(event);
  const id = parseCommunityRoleId(params.id);

  await deleteCommunityRole(id);
  return { ok: true };
});
