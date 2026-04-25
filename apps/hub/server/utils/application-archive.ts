import { lt, eq, and, or, isNotNull, inArray } from "drizzle-orm";
import { rm } from "node:fs/promises";
import {
  applicationFlows,
  applications,
  applicationFileUploads,
  applicationTokens
} from "@guildora/shared";
import type { ApplicationFlowSettings } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";

/**
 * Cleans up archived applications older than their flow's archiveRetentionDays.
 * Also cleans up associated files and expired/used tokens.
 */
export async function cleanupExpiredArchives(db: GuildoraDatabase): Promise<{ deletedApplications: number; deletedTokens: number }> {
  let deletedApplications = 0;

  // Collect all application IDs to delete across all flows
  const flows = await db.select().from(applicationFlows);
  const appIdsToDelete: string[] = [];

  for (const flow of flows) {
    const settings = flow.settingsJson as ApplicationFlowSettings;
    const retentionDays = settings.archiveRetentionDays;
    if (!retentionDays || retentionDays <= 0) continue;

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const oldApps = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.flowId, flow.id),
          or(eq(applications.status, "approved"), eq(applications.status, "rejected")),
          lt(applications.createdAt, cutoffDate)
        )
      );

    appIdsToDelete.push(...oldApps.map((a) => a.id));
  }

  if (appIdsToDelete.length > 0) {
    // Batch-fetch all file uploads for these applications
    const uploads = await db
      .select({ storagePath: applicationFileUploads.storagePath })
      .from(applicationFileUploads)
      .where(inArray(applicationFileUploads.applicationId, appIdsToDelete));

    // Delete files concurrently
    await Promise.all(
      uploads.map((u) => rm(u.storagePath, { force: true }).catch(() => {}))
    );

    // Batch-delete applications (cascades to file uploads via FK)
    await db.delete(applications).where(inArray(applications.id, appIdsToDelete));
    deletedApplications = appIdsToDelete.length;
  }

  // Batch-delete expired and used tokens (older than 24h past expiry)
  const tokenCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expiredTokenIds = await db
    .select({ id: applicationTokens.id })
    .from(applicationTokens)
    .where(
      or(
        lt(applicationTokens.expiresAt, tokenCutoff),
        isNotNull(applicationTokens.usedAt)
      )
    );

  let deletedTokens = 0;
  if (expiredTokenIds.length > 0) {
    await db.delete(applicationTokens).where(
      inArray(applicationTokens.id, expiredTokenIds.map((t) => t.id))
    );
    deletedTokens = expiredTokenIds.length;
  }

  return { deletedApplications, deletedTokens };
}
