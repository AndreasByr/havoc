import { requireAdminSession } from "../../../utils/auth";
import { createError } from "h3";
import { listRoleGroupsWithRoles } from "../../../utils/role-groups";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const groups = await listRoleGroupsWithRoles();
  return { groups };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
