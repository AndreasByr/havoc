import { requireSuperadminSession } from "../../../utils/auth";
import { getMediaService } from "../../../utils/media";

export default defineEventHandler(async (event) => {
  await requireSuperadminSession(event);

  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "Missing file key." });
  }

  const media = getMediaService();
  if (!media.isConfigured()) {
    throw createError({ statusCode: 400, statusMessage: "No bucket configured." });
  }

  await media.delete(key);
  return { deleted: true };
});
