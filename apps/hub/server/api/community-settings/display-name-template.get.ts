import { requireSession } from "../../utils/auth";

import { getDb } from "../../utils/db";
import { loadDisplayNameTemplate } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
try {
  await requireSession(event);
  const db = getDb();
  const displayNameTemplate = await loadDisplayNameTemplate(db);
  return { displayNameTemplate };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
