import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { persistDiscordAvatarLocally } from "../../../utils/avatar-storage";

const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

/**
 * On-demand avatar route: serves locally persisted avatars and re-downloads
 * missing files from Discord CDN transparently. This ensures avatars work
 * even after container restarts without persistent volumes.
 */
export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, "filename");
  if (!filename) {
    throw createError({ statusCode: 400, statusMessage: "Missing filename" });
  }

  // Determine storage directory (same logic as avatar-storage.ts)
  const avatarDir = process.env.MEDIA_STORAGE_PATH
    ? path.resolve(process.env.MEDIA_STORAGE_PATH, "uploads/avatars")
    : path.join(
        process.env.NODE_ENV === "production"
          ? path.resolve(process.cwd(), ".output/public")
          : path.resolve(process.cwd(), "public"),
        "uploads/avatars"
      );

  const filePath = path.join(avatarDir, path.basename(filename));

  // Try to serve existing file first
  try {
    await access(filePath);
    return sendAvatarFile(event, filePath, filename);
  } catch {
    // File doesn't exist — attempt re-download
  }

  // Extract discordId and avatarHash from filename: {discordId}-{hash}.{ext}
  const match = filename.match(/^(\d+)-([^.]+)\.\w+$/);
  if (!match) {
    throw createError({ statusCode: 404, statusMessage: "Avatar not found" });
  }

  const [, discordId, avatarHash] = match;
  const localUrl = await persistDiscordAvatarLocally(discordId, avatarHash);
  if (!localUrl) {
    throw createError({ statusCode: 404, statusMessage: "Avatar not found" });
  }

  return sendAvatarFile(event, filePath, filename);
});

async function sendAvatarFile(event: Parameters<Parameters<typeof defineEventHandler>[0]>[0], filePath: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "png";
  const contentType = mimeTypes[ext] || "image/png";

  const buffer = await readFile(filePath);
  setResponseHeader(event, "content-type", contentType);
  setResponseHeader(event, "cache-control", "public, max-age=86400, immutable");
  return buffer;
}
