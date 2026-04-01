import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { eq, and } from "drizzle-orm";
import { applicationFileUploads } from "@guildora/shared";
import { requireModeratorSession } from "../../../../utils/auth";
import { requireRouterParam } from "../../../../utils/http";
import { getDb } from "../../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const applicationId = requireRouterParam(event, "applicationId", "Missing application ID.");
  const uploadId = requireRouterParam(event, "uploadId", "Missing upload ID.");

  const db = getDb();
  const [upload] = await db
    .select()
    .from(applicationFileUploads)
    .where(
      and(
        eq(applicationFileUploads.id, uploadId),
        eq(applicationFileUploads.applicationId, applicationId)
      )
    )
    .limit(1);

  if (!upload) {
    throw createError({ statusCode: 404, statusMessage: "File not found." });
  }

  // Verify file exists on disk
  try {
    await stat(upload.storagePath);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "File not found on disk." });
  }

  setResponseHeader(event, "Content-Type", upload.mimeType);
  setResponseHeader(event, "Content-Disposition", `inline; filename="${upload.originalFilename}"`);
  setResponseHeader(event, "Cache-Control", "private, max-age=3600");

  return sendStream(event, createReadStream(upload.storagePath));
});
