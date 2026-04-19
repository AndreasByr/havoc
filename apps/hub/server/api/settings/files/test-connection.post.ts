import { requireSuperadminSession } from "../../../utils/auth";

import { getMediaService } from "../../../utils/media";

export default defineEventHandler(async (event) => {
try {
  await requireSuperadminSession(event);
  return getMediaService().testConnection();
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
