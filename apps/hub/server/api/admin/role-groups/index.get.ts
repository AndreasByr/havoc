import { requireAdminSession } from "../../../utils/auth";
import { listRoleGroupsWithRoles } from "../../../utils/role-groups";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const groups = await listRoleGroupsWithRoles();
  return { groups };
});
