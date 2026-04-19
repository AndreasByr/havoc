import { eq } from "drizzle-orm";
import { createError } from "h3";
import { profiles } from "@guildora/shared";
import { z } from "zod";
import { requireSession } from "../../utils/auth";
import { loadActiveCustomFields, filterFieldsForUser, validateAndMergeFieldValues } from "../../utils/custom-fields";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";

const bodySchema = z.object({ values: z.record(z.unknown()) });

export default defineEventHandler(async (event) => {
try {
  const session = await requireSession(event);
  const body = await readBodyWithSchema(event, bodySchema, "Invalid payload.");

  const db = getDb();
  const allFields = await loadActiveCustomFields(db);
  const editableFields = filterFieldsForUser(allFields).filter((f) => f.userCanEdit);

  const [profile] = await db
    .select({ customFields: profiles.customFields })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  const existingValues = (profile?.customFields ?? {}) as Record<string, unknown>;
  const merged = validateAndMergeFieldValues(editableFields, existingValues, body.values);

  await db
    .update(profiles)
    .set({ customFields: merged })
    .where(eq(profiles.userId, session.user.id));

  return { success: true };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
