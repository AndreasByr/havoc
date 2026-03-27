import { eq } from "drizzle-orm";
import { communitySettings } from "@guildora/shared";
import type { CommunityDefaultLocale, DisplayNameField } from "@guildora/shared";
import type { getDb } from "./db";
import { normalizeCommunityDefaultLocale } from "../../utils/locale-preference";

type DbClient = ReturnType<typeof getDb>;

export const COMMUNITY_SETTINGS_SINGLETON_ID = 1;

// Simple TTL cache for singleton settings
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const localeCache: { entry: CacheEntry<CommunityDefaultLocale> | null } = { entry: null };
const templateCache: { entry: CacheEntry<DisplayNameField[]> | null } = { entry: null };

export function invalidateCommunitySettingsCache() {
  localeCache.entry = null;
  templateCache.entry = null;
}

export async function loadCommunitySettingsLocale(db: DbClient): Promise<CommunityDefaultLocale> {
  const now = Date.now();
  if (localeCache.entry && now < localeCache.entry.expiresAt) {
    return localeCache.entry.value;
  }

  const [row] = await db
    .select({ defaultLocale: communitySettings.defaultLocale })
    .from(communitySettings)
    .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
    .limit(1);

  const value = normalizeCommunityDefaultLocale(row?.defaultLocale, "en");
  localeCache.entry = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export async function loadDisplayNameTemplate(db: DbClient): Promise<DisplayNameField[]> {
  const now = Date.now();
  if (templateCache.entry && now < templateCache.entry.expiresAt) {
    return templateCache.entry.value;
  }

  try {
    const [row] = await db
      .select({ displayNameTemplate: communitySettings.displayNameTemplate })
      .from(communitySettings)
      .where(eq(communitySettings.id, COMMUNITY_SETTINGS_SINGLETON_ID))
      .limit(1);

    const value = (row?.displayNameTemplate as DisplayNameField[] | null) ?? [];
    templateCache.entry = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    return [];
  }
}
