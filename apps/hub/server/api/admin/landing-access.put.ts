import { desc, eq } from "drizzle-orm";
import { moderationSettings } from "@guildora/shared";
import { z } from "zod";
import { requireAdminSession } from "../../utils/auth";
import { loadLandingAccessConfig } from "../../utils/landing-access";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";

const landingAccessSchema = z.object({
  allowModeratorAccess: z.boolean(),
  allowModeratorAppsAccess: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, landingAccessSchema, "Invalid landing access payload.");

  const db = getDb();
  const [existingSettings] = await db.select().from(moderationSettings).orderBy(desc(moderationSettings.updatedAt)).limit(1);

  if (existingSettings) {
    await db
        .update(moderationSettings)
        .set({
          allowModeratorAccess: parsed.allowModeratorAccess,
          ...(parsed.allowModeratorAppsAccess !== undefined ? { allowModeratorAppsAccess: parsed.allowModeratorAppsAccess } : {}),
          updatedAt: new Date(),
          updatedBy: session.user.id
        })
      .where(eq(moderationSettings.id, existingSettings.id));
  } else {
    await db.insert(moderationSettings).values({
      allowModeratorAccess: parsed.allowModeratorAccess,
      ...(parsed.allowModeratorAppsAccess !== undefined ? { allowModeratorAppsAccess: parsed.allowModeratorAppsAccess } : {}),
      updatedBy: session.user.id
    });
  }

  return {
    landingAccess: await loadLandingAccessConfig(db)
  };
});
