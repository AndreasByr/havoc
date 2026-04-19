import { createError } from "h3";
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

  try {
    await setInstalledAppStatus(appId, parsed.status);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  return { ok: true };
});
