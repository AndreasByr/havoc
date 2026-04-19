import { desc } from "drizzle-orm";

import { themeSettings } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { toAdminThemeResponse } from "../../utils/theme";

export default defineEventHandler(async (event) => {
  const db = getDb();
  await requireAdminSession(event);

  try {
  const [storedTheme] = await db.select().from(themeSettings).orderBy(desc(themeSettings.updatedAt)).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  return toAdminThemeResponse(storedTheme);
});
