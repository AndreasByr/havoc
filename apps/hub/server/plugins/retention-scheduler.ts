import { eq, and, isNotNull, lt } from "drizzle-orm";
import { retentionPolicies, voiceSessions } from "@guildora/shared";
import { getDb } from "../utils/db";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 5_000;

async function runRetentionPurge() {
  const db = getDb();

  // Load all enabled retention policies
  const policies = await db
    .select()
    .from(retentionPolicies)
    .where(eq(retentionPolicies.enabled, true));

  if (policies.length === 0) return;

  for (const policy of policies) {
    try {
      if (policy.category === "voice_sessions") {
        const cutoff = new Date(Date.now() - policy.retentionDays * ONE_DAY_MS);

        const result = await db
          .delete(voiceSessions)
          .where(
            and(
              isNotNull(voiceSessions.endedAt),
              lt(voiceSessions.endedAt, cutoff)
            )
          )
          .returning({ id: voiceSessions.id });

        const purged = result.length;
        if (purged > 0) {
          console.log(
            `[retention-scheduler] Purged ${purged} voice sessions (category=voice_sessions, retentionDays=${policy.retentionDays}, cutoff=${cutoff.toISOString()}).`
          );
        } else {
          console.log(
            `[retention-scheduler] No voice sessions to purge (category=voice_sessions, retentionDays=${policy.retentionDays}).`
          );
        }
      }
      // Future categories (audit_logs, application_data, inactive_users) can be added here
    } catch (err) {
      console.error(
        `[retention-scheduler] Failed to purge category=${policy.category}:`,
        err
      );
    }
  }
}

export default defineNitroPlugin((nitroApp) => {
  // Run purge on startup (non-blocking, delayed)
  const startupTimeout = setTimeout(async () => {
    try {
      await runRetentionPurge();
    } catch (err) {
      console.error("[retention-scheduler] Startup purge failed:", err);
    }
  }, STARTUP_DELAY_MS);

  // Schedule daily purge
  const intervalId = setInterval(async () => {
    try {
      await runRetentionPurge();
    } catch (err) {
      console.error("[retention-scheduler] Daily purge failed:", err);
    }
  }, ONE_DAY_MS);

  // Clean up on server shutdown (prevents HMR stacking and allows clean exit)
  nitroApp.hooks.hook("close", () => {
    clearTimeout(startupTimeout);
    clearInterval(intervalId);
  });
});
