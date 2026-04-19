import { requireSuperadminSession } from "../../../utils/auth";
import { getMediaService } from "../../../utils/media";

export default defineEventHandler(async (event) => {
  await requireSuperadminSession(event);
  return getMediaService().testConnection();
});
