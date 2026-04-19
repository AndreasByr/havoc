import { requireAdminSession } from "../../../utils/auth";

import { loadAllCustomFields } from "../../../utils/custom-fields";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const db = getDb();
  const fields = await loadAllCustomFields(db);
  return { fields };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
