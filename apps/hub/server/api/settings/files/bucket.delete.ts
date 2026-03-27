import { requireSuperadminSession } from "../../../utils/auth";
import { getMediaService } from "../../../utils/media";

export default defineEventHandler(async (event) => {
  await requireSuperadminSession(event);

  const body = await readBody(event);
  const media = getMediaService();
  const status = media.getBucketStatus();

  if (!status.enabled) {
    throw createError({ statusCode: 400, statusMessage: "No bucket configured." });
  }

  if (!body?.confirmation || body.confirmation !== status.bucket) {
    throw createError({ statusCode: 400, statusMessage: "Confirmation does not match bucket name." });
  }

  let deleted = 0;
  let cursor: string | null = null;

  do {
    const result = await media.list("", cursor || undefined, 1000);
    for (const file of result.files) {
      await media.delete(file.key);
      deleted++;
    }
    cursor = result.cursor;
  } while (cursor);

  return { deleted };
});
