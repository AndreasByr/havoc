import sharp from "sharp";
import { eq } from "drizzle-orm";
import { users } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { getMediaService, avatarKey, extractMediaKeyFromUrl } from "../../utils/media";
import { replaceAuthSessionForUserId } from "../../utils/auth-session";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const userId = session.user.id;

  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded." });
  }

  const fileField = formData.find((f) => f.name === "file");
  if (!fileField?.data || !fileField.filename) {
    throw createError({ statusCode: 400, statusMessage: "Missing file." });
  }

  const mimeType = fileField.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mimeType)) {
    throw createError({ statusCode: 400, statusMessage: "Only PNG, JPEG, WebP, GIF allowed." });
  }
  if (fileField.data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: "File exceeds 5 MB limit." });
  }

  // Generate thumbnail (max 256x256) — preserve GIF as-is
  const ext = MIME_TO_EXT[mimeType] || "png";
  let buffer: Buffer;
  if (mimeType === "image/gif") {
    buffer = fileField.data;
  } else {
    buffer = await sharp(fileField.data)
      .resize(256, 256, { fit: "cover" })
      .toBuffer();
  }

  const db = getDb();

  // Delete old uploaded avatar if exists
  const [userRow] = await db
    .select({ avatarUrl: users.avatarUrl, avatarSource: users.avatarSource })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRow?.avatarSource === "upload" && userRow.avatarUrl) {
    const oldKey = extractMediaKeyFromUrl(userRow.avatarUrl);
    if (oldKey) {
      await getMediaService().delete(oldKey).catch(() => {});
    }
  }

  // Upload new avatar
  const media = getMediaService();
  const key = avatarKey(userId, ext);
  const publicUrl = await media.upload(key, buffer, mimeType);

  // Update DB
  await db
    .update(users)
    .set({ avatarUrl: publicUrl, avatarSource: "upload" })
    .where(eq(users.id, userId));

  // Refresh session so sidebar avatar updates immediately
  await replaceAuthSessionForUserId(event, userId, session.originalUserId);

  return { avatarUrl: publicUrl, avatarSource: "upload" };
});
