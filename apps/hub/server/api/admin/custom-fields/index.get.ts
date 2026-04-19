import { requireAdminSession } from "../../../utils/auth";
import { loadAllCustomFields } from "../../../utils/custom-fields";
import { getDb } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const db = getDb();
  const fields = await loadAllCustomFields(db);
  return { fields };
});
