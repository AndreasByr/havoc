import { eq } from "drizzle-orm";
import { appManifestSchema, installedApps, type AppManifest } from "@newguildplus/shared";
import { getDb } from "../utils/db";

export interface RuntimeInstalledApp {
  id: string;
  appId: string;
  name: string;
  version: string;
  status: "active" | "inactive" | "error";
  source: "marketplace" | "sideloaded";
  verified: boolean;
  repositoryUrl: string | null;
  manifest: AppManifest | null;
  config: Record<string, unknown>;
  /** Transpiled CJS code bundles: filePath → CJS source string */
  codeBundle: Record<string, string>;
  installedAt: Date;
  updatedAt: Date;
}

declare module "h3" {
  interface H3EventContext {
    installedApps?: RuntimeInstalledApp[];
  }
}

async function loadInstalledApps() {
  const db = getDb();
  const rows = await db.select().from(installedApps).where(eq(installedApps.status, "active"));
  return rows
    .map((row) => {
      const parsedManifest = appManifestSchema.safeParse(row.manifest || {});
      return {
        id: row.id,
        appId: row.appId,
        name: row.name,
        version: row.version,
        status: row.status,
        source: row.source,
        verified: row.verified,
        repositoryUrl: row.repositoryUrl,
        manifest: parsedManifest.success ? parsedManifest.data : null,
        config: (row.config as Record<string, unknown>) || {},
        codeBundle: (row.codeBundle as Record<string, string>) || {},
        installedAt: row.installedAt,
        updatedAt: row.updatedAt
      } satisfies RuntimeInstalledApp;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default defineNitroPlugin((nitroApp) => {
  let cache: RuntimeInstalledApp[] = [];
  let cacheUntil = 0;

  const refresh = async (force = false) => {
    const now = Date.now();
    if (!force && now < cacheUntil) {
      return cache;
    }
    cache = await loadInstalledApps();
    cacheUntil = now + 15000;
    return cache;
  };

  nitroApp.hooks.hook("request", async (event) => {
    try {
      event.context.installedApps = await refresh(false);
    } catch (err) {
      console.error("[app-loader] Failed to load installed apps for request:", err);
      event.context.installedApps = [];
    }
  });

  nitroApp.hooks.hook("app-registry:refresh", async () => {
    await refresh(true);
  });
});
