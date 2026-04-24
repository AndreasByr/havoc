import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { users, applicationFileUploads } from "@guildora/shared";
import { requireSuperadminSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { getMediaService, avatarKey, applicationUploadKey } from "../../../utils/media";

function getPublicDir(): string {
  const currentDir = fileURLToPath(new URL(".", import.meta.url));
  return join(currentDir, "../../../public");
}

async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function recursiveFiles(dir: string): Promise<string[]> {
  const entries = await safeReaddir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await recursiveFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export default defineEventHandler(async (event) => {
  await requireSuperadminSession(event);

  const media = getMediaService();
  if (!media.isConfigured()) {
    throw createError({ statusCode: 400, statusMessage: "No bucket configured." });
  }

  const db = getDb();
  let migrated = 0;
  const errors: string[] = [];

  // 1. Migrate avatars from public/uploads/avatars/
  const avatarDir = join(getPublicDir(), "uploads/avatars");
  const avatarEntries = await safeReaddir(avatarDir);

  for (const entry of avatarEntries) {
    if (!entry.isFile() || entry.name === ".gitkeep") continue;
    try {
      const filePath = join(avatarDir, entry.name);
      const buffer = await readFile(filePath);
      const ext = extname(entry.name).slice(1) || "png";
      const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

      // Extract discordId from filename pattern: {discordId}-{hash}.{ext}
      const dashIdx = entry.name.indexOf("-");
      if (dashIdx === -1) {
        errors.push(`Skipped avatar ${entry.name}: unexpected filename format.`);
        continue;
      }
      const discordId = entry.name.slice(0, dashIdx);

      // Look up userId by discordId
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.discordId, discordId))
        .limit(1);
      if (!user) {
        errors.push(`Skipped avatar ${entry.name}: no user found for discordId ${discordId}.`);
        continue;
      }

      const key = avatarKey(user.id, ext);
      const publicUrl = await media.upload(key, buffer, mimeType);

      await db
        .update(users)
        .set({ avatarUrl: publicUrl, avatarSource: "upload" })
        .where(eq(users.id, user.id));

      migrated++;
    } catch (err: unknown) {
      errors.push(`Avatar ${entry.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // 2. Migrate application uploads from data/application-uploads/
  const appUploadDir = join(process.cwd(), "data", "application-uploads");
  const appFiles = await recursiveFiles(appUploadDir);

  for (const filePath of appFiles) {
    try {
      const buffer = await readFile(filePath);
      const ext = extname(filePath).slice(1) || "bin";
      const _fileStat = await stat(filePath);

      // Look up DB record by storagePath
      const [upload] = await db
        .select({ id: applicationFileUploads.id, flowId: applicationFileUploads.flowId })
        .from(applicationFileUploads)
        .where(eq(applicationFileUploads.storagePath, filePath))
        .limit(1);

      if (!upload) {
        errors.push(`Skipped app upload ${filePath}: no DB record found.`);
        continue;
      }

      const mimeType = ext === "pdf" ? "application/pdf"
        : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "png" ? "image/png"
        : "application/octet-stream";

      const key = applicationUploadKey(upload.flowId, upload.id, ext);
      await media.upload(key, buffer, mimeType);

      await db
        .update(applicationFileUploads)
        .set({ storagePath: key })
        .where(eq(applicationFileUploads.id, upload.id));

      migrated++;
    } catch (err: unknown) {
      errors.push(`App upload ${filePath}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { migrated, errors };
});

