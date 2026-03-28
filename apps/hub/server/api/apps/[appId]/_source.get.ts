import type { RuntimeInstalledApp } from "../../../plugins/app-loader";
import { requireSession } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireSession(event);

  const appId = getRouterParam(event, "appId");
  const query = getQuery(event) as { file?: string };
  const file = query.file;

  if (!appId) {
    throw createError({ statusCode: 400, statusMessage: "Missing appId." });
  }
  if (!file || typeof file !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Missing file query parameter." });
  }

  // Path traversal protection
  if (file.includes("..") || file.startsWith("/") || file.includes("\0")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid file path." });
  }

  const apps: RuntimeInstalledApp[] = event.context.installedApps || [];
  const app = apps.find((a) => a.appId === appId);
  if (!app || !app.manifest) {
    throw createError({ statusCode: 404, statusMessage: `App '${appId}' not found.` });
  }

  const source = app.codeBundle[file];
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: `File '${file}' not found in app bundle.` });
  }

  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  return source;
});
