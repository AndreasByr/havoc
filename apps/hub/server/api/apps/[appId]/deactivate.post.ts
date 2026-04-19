import { requireAdminSession } from "../../../utils/auth";
import { createError } from "h3";
import { setInstalledAppStatus } from "../../../utils/apps";
import { requireRouterParam } from "../../../utils/http";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const appId = requireRouterParam(event, "appId", "Missing app id.");

  await setInstalledAppStatus(appId, "inactive");
  return { ok: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
