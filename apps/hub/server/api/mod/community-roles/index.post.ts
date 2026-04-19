import { requireAdminSession } from "../../../utils/auth";
import { createCommunityRole, modCommunityRoleSchema } from "../../../utils/community-roles";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, modCommunityRoleSchema, "Invalid payload.");

  await createCommunityRole(parsed);

  return { ok: true };
});
