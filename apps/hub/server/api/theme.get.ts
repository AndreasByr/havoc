import { desc } from "drizzle-orm";

import { themeSettings } from "@guildora/shared";
import { getDb } from "../utils/db";
import { defaultThemeColors, normalizeThemeColors } from "../utils/theme";

export default defineEventHandler(async () => {
  const db = getDb();
  try {
  const [storedTheme] = await db.select().from(themeSettings).orderBy(desc(themeSettings.updatedAt)).limit(1);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  if (!storedTheme) {
    return defaultThemeColors;
  }

  return normalizeThemeColors({
    colorDominant: storedTheme.colorDominant,
    colorSecondary: storedTheme.colorSecondary,
    colorAccent: storedTheme.colorAccent,
    colorAccentContentTone: storedTheme.colorAccentContentTone,
    colorInfo: storedTheme.colorInfo,
    colorInfoContentTone: storedTheme.colorInfoContentTone,
    colorSuccess: storedTheme.colorSuccess,
    colorSuccessContentTone: storedTheme.colorSuccessContentTone,
    colorWarning: storedTheme.colorWarning,
    colorWarningContentTone: storedTheme.colorWarningContentTone,
    colorError: storedTheme.colorError,
    colorErrorContentTone: storedTheme.colorErrorContentTone
  });
});
