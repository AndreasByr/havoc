import { desc, eq } from "drizzle-orm";
import { communitySettings, themeSettings } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";

const COMMUNITY_SETTINGS_SINGLETON_ID = 1;

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();
  const [storedTheme] = await db.select().from(themeSettings).orderBy(desc(themeSettings.updatedAt)).limit(1);
  const [storedCommunity] = await db
    .select()
    .from(communitySettings)
    .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
    .limit(1);

  const sidebarLogoSizePx = storedTheme?.sidebarLogoSizePx ?? 60;
  const sizeValid = [40, 48, 60, 72].includes(sidebarLogoSizePx);

  return {
    logoDataUrl: storedTheme?.logoDataUrl || null,
    communityName: storedCommunity?.communityName ?? null,
    sidebarLogoSizePx: sizeValid ? sidebarLogoSizePx : 60
  };
});
