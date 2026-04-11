import { eq } from "drizzle-orm";
import { platformConnections } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { invalidatePlatformCache } from "../../../utils/platformConfig";

/**
 * Test a platform connection by calling the bot's health endpoint.
 * Updates the connection status in the database.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Platform connection ID is required." });
  }

  const db = getDb();
  const [connection] = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, id))
    .limit(1);

  if (!connection) {
    throw createError({ statusCode: 404, statusMessage: "Platform connection not found." });
  }

  if (!connection.botInternalUrl) {
    await db
      .update(platformConnections)
      .set({ status: "error", statusMessage: "No bot URL configured.", lastHealthCheck: new Date() })
      .where(eq(platformConnections.id, id));
    invalidatePlatformCache();
    return { ok: false, status: "error", message: "No bot URL configured." };
  }

  // Try to reach the bot's health endpoint
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (connection.botInternalToken) {
    headers.Authorization = `Bearer ${connection.botInternalToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await $fetch<{ ok?: boolean; status?: string }>(
      `${connection.botInternalUrl}/internal/health`,
      { headers, signal: controller.signal }
    );

    await db
      .update(platformConnections)
      .set({
        status: "connected",
        statusMessage: null,
        lastHealthCheck: new Date()
      })
      .where(eq(platformConnections.id, id));

    invalidatePlatformCache();
    return { ok: true, status: "connected", response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    await db
      .update(platformConnections)
      .set({
        status: "error",
        statusMessage: message,
        lastHealthCheck: new Date()
      })
      .where(eq(platformConnections.id, id));

    invalidatePlatformCache();
    return { ok: false, status: "error", message };
  } finally {
    clearTimeout(timeout);
  }
});
