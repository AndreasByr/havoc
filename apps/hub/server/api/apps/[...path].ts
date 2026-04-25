import { eq } from "drizzle-orm";
import { installedApps } from "@guildora/shared";
import type { RuntimeInstalledApp } from "../../plugins/app-loader";
import { requireSession } from "../../utils/auth";
import { hasRequiredRoles, refreshAppRegistry } from "../../utils/apps";
import { createAppDb } from "../../utils/app-db";
import { getDb } from "../../utils/db";

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

  if (app.source === "sideloaded") {
    const config = useRuntimeConfig(event);
    if (!import.meta.dev && !config.enableSideloading) {
      throw createError({ statusCode: 403, statusMessage: "Sideloaded apps are only available when sideloading is enabled." });
    }
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
    // SECURITY: Executes app handler code from the database (codeBundle).
    // Mitigations: require() is blocked, only whitelisted h3 helpers are exposed,
    // app must be installed & active, role-based access is enforced before execution.
    // The executed code receives a scoped app DB (createAppDb) and its own config.
    // Risk: No true sandboxing — code shares the Node.js process. Accepted trade-off
    // for the plugin system. Consider isolated-vm for stricter isolation in the future.
     
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

  // Execute handler with timeout and error logging
  const HOOK_TIMEOUT_MS = 5000;
  const handlerPromise = handler(event);

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      console.warn(JSON.stringify({ event: "route.timeout", appId, route: route.handler, timeoutMs: HOOK_TIMEOUT_MS }));
      reject(createError({ statusCode: 504, statusMessage: `Handler for app '${appId}' timed out after ${HOOK_TIMEOUT_MS}ms.` }));
    }, HOOK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([handlerPromise, timeoutPromise]);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 504) {
      throw error; // Re-throw timeout as-is
    }
    const reason = (error as Error)?.message || "Unknown handler error.";
    console.error(JSON.stringify({ event: "route.error", appId, route: route.handler, error: reason }));
    throw createError({ statusCode: 500, statusMessage: `Handler error for app '${appId}': ${reason}` });
  }
});
