export type NavigationLocale = "en" | "de";
export type CoreNavigationOptions = {
  allowModeratorCmsAccess?: boolean;
  allowModeratorAppsAccess?: boolean;
  allowModeratorApplicationsAccess?: boolean;
  isDev?: boolean;
};

export type CoreRailItem = {
  id: string;
  to: string;
  label: string;
  labelKey?: string;
  iconPath: string;
  order: number;
  requiredRoles: string[];
};

export type CorePanelGroup = {
  id: string;
  railItemId: string;
  title?: string;
  titleKey?: string;
  order: number;
  items: Array<{
    id: string;
    label: string;
    labelKey?: string;
    to: string;
    iconPath?: string;
    requiredRoles: string[];
  }>;
};

const iconNames = {
  dashboard: "proicons:home",
  members: "proicons:person-multiple",
  profile: "proicons:person",
  settings: "proicons:settings",
  applications: "proicons:checkmark-circle",
  cms: "proicons:document",
  apps: "proicons:grid",
  dev: "proicons:code"
} as const;

function isSupportedLocale(value: string): value is NavigationLocale {
  return value === "en" || value === "de";
}

export function resolveNavigationLocale(value: string | null | undefined): NavigationLocale {
  const normalized = value?.trim().toLowerCase() || "en";
  return isSupportedLocale(normalized) ? normalized : "en";
}

export function getLocalizedCoreNavigation(locale: NavigationLocale, options: CoreNavigationOptions = {}) {
  const allowModeratorCmsAccess = options.allowModeratorCmsAccess ?? true;
  const allowModeratorAppsAccess = options.allowModeratorAppsAccess ?? true;
  const allowModeratorApplicationsAccess = options.allowModeratorApplicationsAccess ?? true;
  const isDev = options.isDev ?? false;
  const cmsRequiredRoles = allowModeratorCmsAccess ? ["moderator", "admin", "superadmin"] : ["admin", "superadmin"];
  const appsRequiredRoles = allowModeratorAppsAccess ? ["moderator", "admin", "superadmin"] : ["admin", "superadmin"];
  const applicationsRequiredRoles = allowModeratorApplicationsAccess ? ["moderator", "admin", "superadmin"] : ["admin", "superadmin"];
  void locale;

  const labels = {
    dashboard: { label: "Dashboard", key: "nav.dashboard" },
    members: { label: "Members", key: "nav.members" },
    profile: { label: "Profile", key: "nav.profile" },
    settings: { label: "Settings", key: "nav.settings" },
    cms: { label: "Landing page", key: "nav.cms" },
    overview: { label: "Overview", key: "dashboard.title" },
    memberList: { label: "Member list", key: "members.title" },
    community: { label: "Community", key: "settings.communityTitle" },
    customFields: { label: "Custom Fields", key: "settings.customFieldsTitle" },
    permissions: { label: "Permissions", key: "settings.permissionsTitle" },
    moderationRights: { label: "Moderation Rights", key: "settings.moderationRightsTitle" },
    design: { label: "Design", key: "adminTheme.title" },
    files: { label: "Files", key: "settingsFiles.navLabel" },
    appsSection: { label: "Apps", key: "nav.apps" },
    appsOverview: { label: "Overview", key: "adminApps.overviewNavLabel" },
    appsSideload: { label: "Sideloading", key: "adminApps.sideloadTitle" },
    appsExplore: { label: "Explore Apps", key: "adminApps.exploreNavLabel" },
    settingsApps: { label: "Apps", key: "nav.apps" },
    applicationsSection: { label: "Applications", key: "nav.applications" },
    applicationsFlows: { label: "Flows", key: "applications.flows" },
    applicationsOpen: { label: "Open Applications", key: "applications.open" },
    applicationsArchive: { label: "Archive", key: "applications.archive" },
    applicationsConfig: { label: "Settings", key: "applications.config" },
    devSection: { label: "DEV", key: "nav.dev" },
    devRoleSwitcher: { label: "Role Switcher", key: "devRoleSwitcher.title" },
    devSideload: { label: "Sideload", key: "adminApps.sideloadTitle" },
    devReset: { label: "Reset", key: "dev.resetTitle" }
  } as const;

  const coreRailItems: CoreRailItem[] = [
    { id: "dashboard", to: "/dashboard", label: labels.dashboard.label, labelKey: labels.dashboard.key, iconPath: iconNames.dashboard, order: 10, requiredRoles: [] },
    { id: "profile", to: "/profile/customize", label: labels.profile.label, labelKey: labels.profile.key, iconPath: iconNames.profile, order: 15, requiredRoles: [] },
    { id: "members", to: "/members", label: labels.members.label, labelKey: labels.members.key, iconPath: iconNames.members, order: 20, requiredRoles: [] },
    {
      id: "applications",
      to: "/applications",
      label: labels.applicationsSection.label,
      labelKey: labels.applicationsSection.key,
      iconPath: iconNames.applications,
      order: 55,
      requiredRoles: applicationsRequiredRoles
    },
    { id: "settings", to: "/settings", label: labels.settings.label, labelKey: labels.settings.key, iconPath: iconNames.settings, order: 60, requiredRoles: ["moderator", "admin", "superadmin"] },
    { id: "apps", to: "/apps", label: labels.appsSection.label, labelKey: labels.appsSection.key, iconPath: iconNames.apps, order: 75, requiredRoles: appsRequiredRoles },
    { id: "cms", to: "/cms", label: labels.cms.label, labelKey: labels.cms.key, iconPath: iconNames.cms, order: 80, requiredRoles: cmsRequiredRoles },
    ...(isDev ? [{ id: "dev", to: "/dev", label: labels.devSection.label, labelKey: labels.devSection.key, iconPath: iconNames.dev, order: 999, requiredRoles: [] as string[] }] : [])
  ];

  const corePanelGroups: CorePanelGroup[] = [
    {
      id: "dashboard-main",
      railItemId: "dashboard",
      title: labels.dashboard.label,
      titleKey: labels.dashboard.key,
      order: 10,
      items: [{ id: "dashboard-home", label: labels.overview.label, labelKey: labels.overview.key, to: "/dashboard", requiredRoles: [] }]
    },
    {
      id: "members-main",
      railItemId: "members",
      title: labels.members.label,
      titleKey: labels.members.key,
      order: 10,
      items: [{ id: "members-list", label: labels.memberList.label, labelKey: labels.memberList.key, to: "/members", requiredRoles: [] }]
    },
    {
      id: "settings-main",
      railItemId: "settings",
      title: labels.settings.label,
      titleKey: labels.settings.key,
      order: 10,
      items: [
        { id: "settings-community", label: labels.community.label, labelKey: labels.community.key, to: "/settings/community", requiredRoles: ["admin", "superadmin"] },
        { id: "settings-custom-fields", label: labels.customFields.label, labelKey: labels.customFields.key, to: "/settings/custom-fields", requiredRoles: ["admin", "superadmin"] },
        { id: "settings-permissions", label: labels.permissions.label, labelKey: labels.permissions.key, to: "/settings/permissions", requiredRoles: ["admin", "superadmin"] },
        { id: "settings-moderation-rights", label: labels.moderationRights.label, labelKey: labels.moderationRights.key, to: "/settings/moderation-rights", requiredRoles: ["admin", "superadmin"] },
        { id: "settings-design", label: labels.design.label, labelKey: labels.design.key, to: "/settings/design", requiredRoles: ["admin", "superadmin"] },
        { id: "settings-files", label: labels.files.label, labelKey: labels.files.key, to: "/settings/files", requiredRoles: ["superadmin"] }
      ]
    },
    {
      id: "applications-main",
      railItemId: "applications",
      title: labels.applicationsSection.label,
      titleKey: labels.applicationsSection.key,
      order: 10,
      items: [
        { id: "applications-flows", label: labels.applicationsFlows.label, labelKey: labels.applicationsFlows.key, to: "/applications/flows", requiredRoles: applicationsRequiredRoles },
        { id: "applications-open", label: labels.applicationsOpen.label, labelKey: labels.applicationsOpen.key, to: "/applications/open", requiredRoles: applicationsRequiredRoles },
        { id: "applications-archive", label: labels.applicationsArchive.label, labelKey: labels.applicationsArchive.key, to: "/applications/archive", requiredRoles: applicationsRequiredRoles },
        { id: "applications-config", label: labels.applicationsConfig.label, labelKey: labels.applicationsConfig.key, to: "/applications/config", requiredRoles: ["admin", "superadmin"] }
      ]
    },
    {
      id: "apps-main",
      railItemId: "apps",
      title: labels.appsSection.label,
      titleKey: labels.appsSection.key,
      order: 10,
      items: [
        { id: "apps-overview", label: labels.appsOverview.label, labelKey: labels.appsOverview.key, to: "/apps/overview", requiredRoles: appsRequiredRoles },
        { id: "apps-explore", label: labels.appsExplore.label, labelKey: labels.appsExplore.key, to: "/apps/explore", requiredRoles: appsRequiredRoles }
      ]
    },
    {
      id: "cms-main",
      railItemId: "cms",
      title: labels.cms.label,
      titleKey: labels.cms.key,
      order: 10,
      items: [{ id: "cms-admin", label: labels.cms.label, labelKey: labels.cms.key, to: "/cms", requiredRoles: cmsRequiredRoles }]
    },
    ...(isDev ? [{
      id: "dev-main",
      railItemId: "dev",
      title: labels.devSection.label,
      titleKey: labels.devSection.key,
      order: 10,
      items: [
        { id: "dev-role-switcher", label: labels.devRoleSwitcher.label, labelKey: labels.devRoleSwitcher.key, to: "/dev/role-switcher", requiredRoles: [] as string[] },
        { id: "dev-sideload", label: labels.devSideload.label, labelKey: labels.devSideload.key, to: "/dev/sideload", requiredRoles: [] as string[] },
        { id: "dev-reset", label: labels.devReset.label, labelKey: labels.devReset.key, to: "/dev/reset", requiredRoles: [] as string[] }
      ]
    }] : [])
  ];

  return { coreRailItems, corePanelGroups };
}
