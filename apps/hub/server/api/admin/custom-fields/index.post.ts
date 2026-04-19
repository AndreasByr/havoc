import { communityCustomFields } from "@guildora/shared";

import { requireAdminSession } from "../../../utils/auth";
import { createCustomFieldSchema, enforceViewEditConsistency } from "../../../utils/custom-fields";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  const body = await readBodyWithSchema(event, createCustomFieldSchema, "Invalid custom field payload.");
  const data = enforceViewEditConsistency(body);

  const db = getDb();
  const [created] = await db
    .insert(communityCustomFields)
    .values({
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      inputType: data.inputType,
      options: data.options ?? null,
      sliderMin: data.sliderMin ?? null,
      sliderMax: data.sliderMax ?? null,
      sliderStep: data.sliderStep ?? null,
      required: data.required ?? false,
      active: data.active ?? true,
      userCanView: data.userCanView ?? false,
      userCanEdit: data.userCanEdit ?? false,
      modCanView: data.modCanView ?? false,
      modCanEdit: data.modCanEdit ?? false,
      sortOrder: data.sortOrder ?? 0
    })
    .returning();

  return { field: created };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
