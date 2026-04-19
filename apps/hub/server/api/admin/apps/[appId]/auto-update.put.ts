import { z } from "zod";
import { eq } from "drizzle-orm";

import { installedApps } from "@guildora/shared";
import { requireAdminSession } from "../../../../utils/auth";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";
import { refreshAppRegistry } from "../../../../utils/apps";

const autoUpdateSchema = z.object({
  autoUpdate: z.boolean()
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const appId = requireRouterParam(event, "appId", "Missing app id.");
  const parsed = await readBodyWithSchema(event, autoUpdateSchema, "Invalid auto-update payload.");

  const db = getDb();
  try {
    await db.update(installedApps).set({ autoUpdate: parsed.autoUpdate }).where(eq(installedApps.appId, appId));
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  try {
    await refreshAppRegistry();
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }

  return { ok: true };
});
