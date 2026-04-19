import { requireSuperadminSession } from "../../../utils/auth";
import { createError } from "h3";
import { getMediaService, type MediaFile } from "../../../utils/media";

export default defineEventHandler(async (event) => {
try {
  await requireSuperadminSession(event);

  const query = getQuery(event);
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;

  const media = getMediaService();
  const status = media.getBucketStatus();

  if (!status.enabled) {
    return {
      status,
      files: { avatars: [], theme: [], applications: [], cms: [], other: [] },
      cursor: null,
      totalSize: 0,
      totalCount: 0
    };
  }

  const emptyGrouped: Record<string, MediaFile[]> = {
    avatars: [],
    theme: [],
    applications: [],
    cms: [],
    other: []
  };

  let result;
  try {
    result = await media.list("", cursor, 500);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status,
      files: emptyGrouped,
      cursor: null,
      totalSize: 0,
      totalCount: 0,
      listError: message
    };
  }

  const grouped: Record<string, MediaFile[]> = { ...emptyGrouped };

  let totalSize = 0;
  for (const file of result.files) {
    totalSize += file.size;
    if (file.key.startsWith("avatars/")) grouped.avatars.push(file);
    else if (file.key.startsWith("theme/")) grouped.theme.push(file);
    else if (file.key.startsWith("applications/")) grouped.applications.push(file);
    else if (file.key.startsWith("cms/")) grouped.cms.push(file);
    else grouped.other.push(file);
  }

  return {
    status,
    files: grouped,
    cursor: result.cursor,
    totalSize,
    totalCount: result.files.length
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
