import { and, eq } from "drizzle-orm";
import { installedApps } from "@guildora/shared";
import { getDb } from "../utils/db";
import { installAppFromUrl } from "../utils/app-sideload";

async function runAutoUpdates() {
  const db = getDb();
  const rows = await db
    .select()
    .from(installedApps)
    .where(and(eq(installedApps.autoUpdate, true), eq(installedApps.source, "sideloaded")));

  const candidates = rows.filter((r) => r.repositoryUrl !== null);

  for (const app of candidates) {
    try {
      await installAppFromUrl(app.repositoryUrl!, {
        activate: app.status === "active",
        verified: app.verified,
        preserveAutoUpdate: true
      });
      console.log(`[auto-updater] Updated app ${app.appId}`);
    } catch (err) {
      console.error(`[auto-updater] Failed to update app ${app.appId}:`, err);
    }
  }
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();

  if (!import.meta.dev && !config.enableSideloading) {
    return;
  }

  if (!import.meta.dev && config.enableSideloading) {
    console.warn("[auto-updater] Running in non-dev mode because sideloading is enabled.");
  }

  const timer = setTimeout(async () => {
    await runAutoUpdates();
    const interval = setInterval(runAutoUpdates, SIX_HOURS_MS);
    nitroApp.hooks.hookOnce("close", () => clearInterval(interval));
  }, STARTUP_DELAY_MS);

  nitroApp.hooks.hookOnce("close", () => clearTimeout(timer));
});
