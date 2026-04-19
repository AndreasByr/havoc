import { requireAdminSession } from "../../../utils/auth";

import { adminCommunityRoleSchema, createCommunityRole } from "../../../utils/community-roles";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, adminCommunityRoleSchema, "Invalid payload.");

  await createCommunityRole(parsed, { includeDiscordRoleId: true });

  return { ok: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
