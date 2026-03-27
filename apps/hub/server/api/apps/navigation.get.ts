import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { buildAppNavigation, hasRequiredRoles } from "../../utils/apps";
import { getLocalizedCoreNavigation, resolveNavigationLocale } from "../../utils/core-navigation";
import { requireSession } from "../../utils/auth";
import { loadCmsAccessConfig } from "../../utils/cms-access";
import { loadApplicationAccessConfig } from "../../utils/application-access";
import { getDb } from "../../utils/db";
import {
  normalizeUserLocalePreference,
  readLegacyLocalePreferenceFromCustomFields,
  resolveEffectiveLocale
} from "../../../utils/locale-preference";
import { loadCommunitySettingsLocale } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const db = getDb();
  const roles = session.user.permissionRoles ?? session.user.roles ?? [];
  const [profile, communityDefaultLocale, cmsAccess, applicationAccess] = await Promise.all([
    db
      .select({ localePreference: profiles.localePreference, customFields: profiles.customFields })
      .from(profiles)
      .where(eq(profiles.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    loadCommunitySettingsLocale(db),
    loadCmsAccessConfig(db),
    loadApplicationAccessConfig(db)
  ]);
  const userLocalePreference = normalizeUserLocalePreference(
    profile?.localePreference ?? readLegacyLocalePreferenceFromCustomFields(profile?.customFields ?? {}),
    null
  );
  const locale = resolveNavigationLocale(resolveEffectiveLocale({
    userLocalePreference,
    communityDefaultLocale
  }).locale);
  const isDev = useRuntimeConfig().public.isDev;
  const { coreRailItems, corePanelGroups } = getLocalizedCoreNavigation(locale, {
    allowModeratorCmsAccess: cmsAccess.allowModeratorAccess,
    allowModeratorAppsAccess: cmsAccess.allowModeratorAppsAccess,
    allowModeratorApplicationsAccess: applicationAccess.allowModeratorAccess,
    isDev: isDev === true
  });

  const visibleCoreRail = coreRailItems.filter((item) => hasRequiredRoles(item.requiredRoles, roles));
  const visibleCoreRailIds = new Set(visibleCoreRail.map((item) => item.id));
  const visibleCorePanelGroups = corePanelGroups
    .filter((group) => visibleCoreRailIds.has(group.railItemId))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasRequiredRoles(item.requiredRoles, roles))
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => a.order - b.order);

  const appNavigation = buildAppNavigation(roles, event.context.installedApps);
  const rail = [...visibleCoreRail, ...appNavigation.rail].sort((a, b) => a.order - b.order);
  const panelGroups = [...visibleCorePanelGroups, ...appNavigation.panelGroups];

  return {
    rail,
    panelGroups,
    meta: {
      loadedAt: new Date().toISOString()
    }
  };
});
