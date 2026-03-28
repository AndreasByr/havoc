import type { RuntimeInstalledApp } from "../../../plugins/app-loader";
import { hasRequiredRoles } from "../../../utils/apps";
import { requireSession } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const userRoles = session.user.permissionRoles ?? session.user.roles ?? [];

  const appId = getRouterParam(event, "appId");
  const query = getQuery(event) as { path?: string };
  const pagePath = query.path;

  if (!appId) {
    throw createError({ statusCode: 400, statusMessage: "Missing appId." });
  }
  if (!pagePath) {
    throw createError({ statusCode: 400, statusMessage: "Missing path query parameter." });
  }

  const apps: RuntimeInstalledApp[] = event.context.installedApps || [];
  const app = apps.find((a) => a.appId === appId);
  if (!app || !app.manifest) {
    throw createError({ statusCode: 404, statusMessage: `App '${appId}' not found.` });
  }

  // Find matching page declaration
  const sortedPages = [...app.manifest.pages].sort((a, b) => b.path.length - a.path.length);
  const pageDecl = sortedPages.find((p) => p.path === pagePath || pagePath.startsWith(p.path + "/"));
  if (!pageDecl) {
    throw createError({ statusCode: 404, statusMessage: `No page found for path '${pagePath}'.` });
  }

  // Role check — honour config-based role overrides (__roleOverrides.<pageId>)
  const roleOverrides = (typeof app.config?.__roleOverrides === "object" && app.config.__roleOverrides !== null && !Array.isArray(app.config.__roleOverrides))
    ? (app.config.__roleOverrides as Record<string, string[]>)
    : {};
  const effectiveRoles = Array.isArray(roleOverrides[pageDecl.id]) ? roleOverrides[pageDecl.id] : pageDecl.requiredRoles;
  if (!hasRequiredRoles(effectiveRoles, userRoles)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden." });
  }

  if (!pageDecl.component) {
    throw createError({ statusCode: 404, statusMessage: `Page '${pageDecl.id}' has no component defined.` });
  }

  const source = app.codeBundle[pageDecl.component];
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Component source not found for '${pageDecl.component}'. Re-sideload the app.`
    });
  }

  setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
  return { source, component: pageDecl.component };
});
