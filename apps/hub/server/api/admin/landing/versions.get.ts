import { desc } from "drizzle-orm";
import { landingPageVersions } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const db = getDb();
  const versions = await db
    .select({
      id: landingPageVersions.id,
      label: landingPageVersions.label,
      createdAt: landingPageVersions.createdAt,
      createdBy: landingPageVersions.createdBy
    })
    .from(landingPageVersions)
    .orderBy(desc(landingPageVersions.createdAt))
    .limit(50);

  return { versions };
});
