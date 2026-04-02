import { eq } from "drizzle-orm";
import { landingPageVersions } from "@guildora/shared";
import { requireAdminSession } from "../../../../utils/auth";
import { getDb } from "../../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing version ID." });

  const db = getDb();
  const [version] = await db
    .select()
    .from(landingPageVersions)
    .where(eq(landingPageVersions.id, id))
    .limit(1);

  if (!version) throw createError({ statusCode: 404, statusMessage: "Version not found." });

  return { version };
});
