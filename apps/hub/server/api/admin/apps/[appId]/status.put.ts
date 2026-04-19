import { z } from "zod";
import { requireAdminSession } from "../../../../utils/auth";
import { setInstalledAppStatus } from "../../../../utils/apps";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";

const statusSchema = z.object({
  status: z.enum(["active", "inactive"])
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const appId = requireRouterParam(event, "appId", "Missing app id.");
  const parsed = await readBodyWithSchema(event, statusSchema, "Invalid status payload.");

  await setInstalledAppStatus(appId, parsed.status);
  return { ok: true };
});
