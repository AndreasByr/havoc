import { eq } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";
import { installedApps } from "@guildora/shared";
import { requireAdminSession } from "../../../../utils/auth";
import { getDb } from "../../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../../utils/http";
import { refreshAppRegistry } from "../../../../utils/apps";

const configSchema = z.object({
  config: z.record(z.unknown())
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const appId = requireRouterParam(event, "appId", "Missing app id.");
  const parsed = await readBodyWithSchema(event, configSchema, "Invalid config payload.");

  const db = getDb();
  try {
    await db.update(installedApps).set({ config: parsed.config }).where(eq(installedApps.appId, appId));
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
