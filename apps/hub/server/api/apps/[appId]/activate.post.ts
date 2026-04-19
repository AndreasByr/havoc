import { requireAdminSession } from "../../../utils/auth";
import { setInstalledAppStatus } from "../../../utils/apps";
import { requireRouterParam } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const appId = requireRouterParam(event, "appId", "Missing app id.");

  await setInstalledAppStatus(appId, "active");
  return { ok: true };
});
