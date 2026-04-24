import { and, eq, isNotNull, ne } from "drizzle-orm";
import { platformConnections } from "@guildora/shared";
import { getDb } from "../utils/db";
import { checkPlatformHealth } from "../utils/platformBridge";
import { invalidatePlatformCache, type PlatformType } from "../utils/platformConfig";

const POLL_INTERVAL_MS = 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

type HealthCheckResult = {
  ok: boolean;
  status?: string;
  message?: string;
};

let running = false;

async function updatePlatformStatus(
  connectionId: string,
  nextStatus: "connected" | "error",
  nextMessage: string | null,
  lastHealthCheck: Date
) {
  const db = getDb();
  await db
    .update(platformConnections)
    .set({
      status: nextStatus,
      statusMessage: nextMessage,
      lastHealthCheck
    })
    .where(eq(platformConnections.id, connectionId));

  invalidatePlatformCache();
}

async function pollPlatformHealth() {
  if (running) return;
  running = true;

  try {
    const db = getDb();
    const connections = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          ne(platformConnections.status, "disconnected"),
          isNotNull(platformConnections.botInternalUrl)
        )
      );

    for (const connection of connections) {
      const platform = connection.platform as PlatformType;

      try {
        const result = await checkPlatformHealth(platform) as HealthCheckResult;
        const now = new Date();
        const nextStatus = result.ok ? "connected" : "error";
        const nextMessage = result.ok
          ? null
          : typeof result.message === "string" && result.message.trim().length > 0
            ? result.message
            : "Health check failed.";

        if (connection.status === nextStatus) {
          continue;
        }

        await updatePlatformStatus(connection.id, nextStatus, nextMessage, now);
        console.log(
          `[platform-health-monitor] ${platform} status changed: ${connection.status} → ${nextStatus}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Health check failed.";

        if (connection.status === "error") {
          console.warn(
            `[platform-health-monitor] ${platform} health check failed without status transition: ${message}`
          );
          continue;
        }

        await updatePlatformStatus(connection.id, "error", message, new Date());
        console.log(
          `[platform-health-monitor] ${platform} status changed: ${connection.status} → error`
        );
      }
    }
  } catch (error) {
    console.error("[platform-health-monitor] Poll failed:", error);
  } finally {
    running = false;
  }
}

export default defineNitroPlugin((nitroApp) => {
  const startupTimeout = setTimeout(async () => {
    await pollPlatformHealth();
  }, STARTUP_DELAY_MS);

  const intervalId = setInterval(pollPlatformHealth, POLL_INTERVAL_MS);

  nitroApp.hooks.hook("close", () => {
    clearTimeout(startupTimeout);
    clearInterval(intervalId);
  });
});
