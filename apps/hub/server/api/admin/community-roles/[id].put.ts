import { requireAdminSession } from "../../../utils/auth";
import { adminCommunityRoleSchema, parseCommunityRoleId, updateCommunityRole } from "../../../utils/community-roles";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const params = getRouterParams(event);
  const id = parseCommunityRoleId(params.id);
  const parsed = await readBodyWithSchema(event, adminCommunityRoleSchema, "Invalid payload.");

  await updateCommunityRole(id, parsed, { includeDiscordRoleId: true });

  return { ok: true };
});
