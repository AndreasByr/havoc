import { requireAdminSession } from "../../../utils/auth";
import { createError } from "h3";
import { deleteCommunityRole, parseCommunityRoleId } from "../../../utils/community-roles";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const params = getRouterParams(event);
  const id = parseCommunityRoleId(params.id);

  await deleteCommunityRole(id);
  return { ok: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
