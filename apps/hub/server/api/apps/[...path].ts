import { eq } from "drizzle-orm";
import { installedApps } from "@guildora/shared";
import type { RuntimeInstalledApp } from "../../plugins/app-loader";
import { requireSession } from "../../utils/auth";
import { hasRequiredRoles, refreshAppRegistry } from "../../utils/apps";
import { createAppDb } from "../../utils/app-db";
import { getDb } from "../../utils/db";
import { isDevRoleSwitcherEnabled } from "../../utils/dev-role-switcher";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const userRoles = session.user.permissionRoles ?? session.user.roles ?? [];

  const url = event.node.req.url || "";
  const match = url.match(/^\/api\/apps\/([^/?]+)\/(.+?)(\?.*)?$/);
  if (!match) {
    throw createError({ statusCode: 404, statusMessage: "Not found." });
  }
  const appId = match[1]!;
  const restPath = match[2]!;

  // Skip internal endpoints (leading underscore)
  if (restPath.startsWith("_")) {
    throw createError({ statusCode: 404, statusMessage: "Not found." });
  }

  const apps: RuntimeInstalledApp[] = event.context.installedApps || [];
  const app = apps.find((a) => a.appId === appId);
  if (!app || !app.manifest) {
    throw createError({ statusCode: 404, statusMessage: `App '${appId}' not found or not active.` });
  }

  if (app.source === "sideloaded" && !isDevRoleSwitcherEnabled(event)) {
    throw createError({ statusCode: 403, statusMessage: "Sideloaded apps are only available in development mode." });
  }

  const fullPath = `/api/apps/${appId}/${restPath}`;
  const method = event.node.req.method?.toUpperCase() || "GET";

  const route = app.manifest.apiRoutes.find(
    (r) => r.method === method && r.path === fullPath
  );
  if (!route) {
    throw createError({ statusCode: 404, statusMessage: `No matching route for ${method} ${fullPath}` });
  }

  if (!hasRequiredRoles(route.requiredRoles, userRoles)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden." });
  }

  // Load handler from codeBundle
  const handlerCode = app.codeBundle[route.handler];
  if (!handlerCode) {
    throw createError({ statusCode: 501, statusMessage: `Handler code not found for ${route.handler}. Re-sideload the app.` });
  }

  // Execute handler via new Function (CJS) — injecting h3 helpers from the Nitro runtime
  const mod = { exports: {} as Record<string, unknown> };
  const restrictedRequire = (id: string) => {
    throw new Error(`require('${id}') is not available in sideloaded API handlers.`);
  };
  const h3Globals = {
    defineEventHandler,
    getQuery,
    readBody,
    createError,
    getRouterParams,
    setResponseHeader,
    sendNoContent,
    getHeader,
    setResponseStatus
  };
  const h3Names = Object.keys(h3Globals);
  const h3Values = Object.values(h3Globals);

  try {
    // eslint-disable-next-line no-new-func
    new Function("module", "exports", "require", ...h3Names, handlerCode)(mod, mod.exports, restrictedRequire, ...h3Values);
  } catch (error: unknown) {
    const reason = (error as Error)?.message || "Unknown runtime error.";
    throw createError({ statusCode: 500, statusMessage: `Failed to load handler for app '${appId}': ${reason}` });
  }

  const handler = (mod.exports as { default?: (...args: unknown[]) => unknown }).default;
  if (typeof handler !== "function") {
    throw createError({ statusCode: 501, statusMessage: `Handler '${route.handler}' has no default export.` });
  }

  // Inject app context
  const db = getDb();
  event.context.guildora = {
    userId: session.user.id,
    userRoles,
    guildId: null,
    config: app.config || {},
    db: createAppDb(appId),
    saveConfig: async (config: Record<string, unknown>) => {
      await db.update(installedApps).set({ config, updatedAt: new Date() }).where(eq(installedApps.appId, appId));
      await refreshAppRegistry();
    }
  };

  return handler(event);
});
