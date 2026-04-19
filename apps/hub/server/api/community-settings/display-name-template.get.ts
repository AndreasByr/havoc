import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { loadDisplayNameTemplate } from "../../utils/community-settings";

export default defineEventHandler(async (event) => {
  await requireSession(event);
  const db = getDb();
  const displayNameTemplate = await loadDisplayNameTemplate(db);
  return { displayNameTemplate };
});
