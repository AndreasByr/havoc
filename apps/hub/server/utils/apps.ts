import { eq } from "drizzle-orm";
import { installedApps, roleHierarchy, safeParseAppManifest, type GuildoraAppManifest } from "@guildora/shared";
import { getDb } from "./db";
import { refreshBotCommands, reloadBotHooks } from "./botSync";

type AppRegistryState = {
  loadedAt: string;
  activeApps: InstalledAppSnapshot[];
};

type GlobalWithRegistry = typeof globalThis & {
  __GUILDORA_APP_REGISTRY__?: AppRegistryState;
};

export interface InstalledAppSnapshot {
  id: string;
  appId: string;
  name: string;
  version: string;
  source: "marketplace" | "sideloaded";
  verified: boolean;
  repositoryUrl: string | null;
  status: "active" | "inactive" | "error";
  config: Record<string, unknown>;
  /** Transpiled CJS code bundles: filePath → CJS source string */
  codeBundle: Record<string, string>;
  manifest: GuildoraAppManifest;
  installedAt: Date;
  updatedAt: Date;
}

export type MutableInstalledAppStatus = "active" | "inactive";

export interface AppNavigationRailEntry {
  id: string;
  to: string;
  label: string;
  iconPath: string;
  order: number;
  appId: string;
}

export interface AppNavigationPanelItem {
  id: string;
  label: string;
  to: string;
  iconPath?: string;
  requiredRoles: string[];
}

export interface AppNavigationPanelGroup {
  id: string;
  title?: string;
  railItemId: string;
  order: number;
  appId: string;
  items: AppNavigationPanelItem[];
}

function getRegistryContainer() {
  const container = globalThis as GlobalWithRegistry;
  if (!container.__GUILDORA_APP_REGISTRY__) {
    container.__GUILDORA_APP_REGISTRY__ = {
      loadedAt: new Date(0).toISOString(),
      activeApps: []
    };
  }
  return container;
}

const iconMap: Record<string, string> = {
  puzzle: "proicons:apps",
  store: "proicons:cart",
  bot: "proicons:apps"
};
const fallbackIconName = "proicons:apps";

function normalizeIconPath(icon: string) {
  if (!icon) {
    return fallbackIconName;
  }
  if (icon.includes(":")) {
    return icon;
  }
  if (icon.startsWith("M")) {
    return icon;
  }
  return iconMap[icon] ?? fallbackIconName;
}

function expandRoles(assignedRoles: string[]): string[] {
  const expanded = new Set<string>(assignedRoles);
  for (const role of assignedRoles) {
    for (const implied of roleHierarchy[role] ?? []) {
      expanded.add(implied);
    }
  }
  return Array.from(expanded);
}

export function hasRequiredRoles(requiredRoles: string[] | undefined, assignedRoles: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  const effective = expandRoles(assignedRoles);
  return requiredRoles.some((role) => effective.includes(role));
}

export async function loadActiveInstalledApps() {
  const db = getDb();
  const rows = await db.select().from(installedApps).where(eq(installedApps.status, "active"));

  const validApps: InstalledAppSnapshot[] = [];
  for (const row of rows) {
    const parsed = safeParseAppManifest(row.manifest);
    if (!parsed.success) {
      continue;
    }

    validApps.push({
      id: row.id,
      appId: row.appId,
      name: row.name,
      version: row.version,
      source: row.source,
      verified: row.verified,
      repositoryUrl: row.repositoryUrl || null,
      status: row.status,
      config: (row.config as Record<string, unknown>) || {},
      codeBundle: (row.codeBundle as Record<string, string>) || {},
      manifest: parsed.data,
      installedAt: row.installedAt,
      updatedAt: row.updatedAt
    });
  }

  return validApps;
}

export function setAppRegistrySnapshot(activeApps: InstalledAppSnapshot[]) {
  const container = getRegistryContainer();
  container.__GUILDORA_APP_REGISTRY__ = {
    loadedAt: new Date().toISOString(),
    activeApps
  };
}

export function getAppRegistrySnapshot() {
  return getRegistryContainer().__GUILDORA_APP_REGISTRY__;
}

export async function refreshAppRegistry() {
  const activeApps = await loadActiveInstalledApps();
  setAppRegistrySnapshot(activeApps);
  await Promise.all([
    useNitroApp().hooks.callHook("app-registry:refresh"),
    refreshBotCommands().catch((err) => console.warn("[apps] Bot command sync failed:", err)),
    reloadBotHooks().catch((err) => console.warn("[apps] Bot hook reload failed:", err))
  ]);
  return activeApps;
}

export async function setInstalledAppStatus(appId: string, status: MutableInstalledAppStatus) {
  const db = getDb();
  await db.update(installedApps).set({ status, updatedAt: new Date() }).where(eq(installedApps.appId, appId));
  await refreshAppRegistry();
}

export function buildAppNavigation(
  roles: string[],
  appsOverride?: Array<{ appId: string; name: string; manifest: GuildoraAppManifest | null; config?: Record<string, unknown> }>
) {
  const activeApps = appsOverride
    ? (appsOverride.filter((a) => a.manifest !== null) as Array<{ appId: string; name: string; manifest: GuildoraAppManifest; config?: Record<string, unknown> }>)
    : (getAppRegistrySnapshot()?.activeApps || []);
  const rail: AppNavigationRailEntry[] = [];
  const panelGroups: AppNavigationPanelGroup[] = [];

  for (const app of activeApps) {
    const appConfig = app.config ?? {};
    const roleOverrides = (typeof appConfig.__roleOverrides === "object" && appConfig.__roleOverrides !== null && !Array.isArray(appConfig.__roleOverrides))
      ? (appConfig.__roleOverrides as Record<string, string[]>)
      : {};
    const pagesByPath = new Map(app.manifest.pages.map((p) => [p.path, p]));

    for (const railItem of app.manifest.navigation.rail || []) {
      if (!hasRequiredRoles(railItem.requiredRoles, roles)) {
        continue;
      }

      rail.push({
        id: `app:${app.appId}:${railItem.id}`,
        to: railItem.to || `/apps/${app.appId}`,
        label: railItem.label || app.name,
        iconPath: normalizeIconPath(railItem.icon || "puzzle"),
        order: railItem.order,
        appId: app.appId
      });
    }

    for (const group of app.manifest.navigation.panelGroups || []) {
      const visibleItems = group.items
        .filter((item) => {
          const page = pagesByPath.get(item.to);
          if (page && !page.component) return false;
          const effectiveRoles = Array.isArray(roleOverrides[item.id]) ? roleOverrides[item.id] : item.requiredRoles;
          return hasRequiredRoles(effectiveRoles, roles);
        })
        .map((item) => ({
          id: item.id,
          label: item.label,
          to: item.to,
          iconPath: item.icon ? normalizeIconPath(item.icon) : undefined,
          requiredRoles: item.requiredRoles || []
        }));

      if (visibleItems.length === 0) {
        continue;
      }

      panelGroups.push({
        id: `app:${app.appId}:${group.id}`,
        title: group.title,
        railItemId: `app:${app.appId}:${group.railItemId}`,
        order: group.order,
        appId: app.appId,
        items: visibleItems
      });
    }
  }

  rail.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  panelGroups.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    rail,
    panelGroups
  };
}

