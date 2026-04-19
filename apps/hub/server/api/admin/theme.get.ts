import { desc } from "drizzle-orm";
import { themeSettings } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { toAdminThemeResponse } from "../../utils/theme";

export default defineEventHandler(async (event) => {
  const db = getDb();
  await requireAdminSession(event);

  const [storedTheme] = await db.select().from(themeSettings).orderBy(desc(themeSettings.updatedAt)).limit(1);
  return toAdminThemeResponse(storedTheme);
});
