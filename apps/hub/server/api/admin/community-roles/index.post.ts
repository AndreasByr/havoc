import { requireAdminSession } from "../../../utils/auth";
import { adminCommunityRoleSchema, createCommunityRole } from "../../../utils/community-roles";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, adminCommunityRoleSchema, "Invalid payload.");

  await createCommunityRole(parsed, { includeDiscordRoleId: true });

  return { ok: true };
});
