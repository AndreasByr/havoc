import { requireAdminSession } from "../../../utils/auth";

import { modCommunityRoleSchema, parseCommunityRoleId, updateCommunityRole } from "../../../utils/community-roles";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const params = getRouterParams(event);
  const id = parseCommunityRoleId(params.id);
  const parsed = await readBodyWithSchema(event, modCommunityRoleSchema, "Invalid payload.");

  await updateCommunityRole(id, parsed);

  return { ok: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
