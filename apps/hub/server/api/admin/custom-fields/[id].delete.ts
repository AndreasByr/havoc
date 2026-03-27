import { eq } from "drizzle-orm";
import { communityCustomFields } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { requireRouterParam } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = requireRouterParam(event, "id", "Missing custom field id.");

  const db = getDb();

  const [field] = await db
    .select({ isDefault: communityCustomFields.isDefault })
    .from(communityCustomFields)
    .where(eq(communityCustomFields.id, id))
    .limit(1);

  if (!field) {
    throw createError({ statusCode: 404, statusMessage: "Custom field not found." });
  }

  if (field.isDefault) {
    throw createError({ statusCode: 400, statusMessage: "Default custom fields cannot be deleted." });
  }

  await db.delete(communityCustomFields).where(eq(communityCustomFields.id, id));

  return { success: true };
});
