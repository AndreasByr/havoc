import { eq } from "drizzle-orm";
import { communityCustomFields } from "@guildora/shared";
import { requireAdminSession } from "../../../utils/auth";
import { updateCustomFieldSchema, enforceViewEditConsistency } from "../../../utils/custom-fields";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema, requireRouterParam } from "../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const id = requireRouterParam(event, "id", "Missing custom field id.");
  const body = await readBodyWithSchema(event, updateCustomFieldSchema, "Invalid custom field payload.");
  const data = enforceViewEditConsistency(body);

  const db = getDb();

  const updateValues: Record<string, unknown> = {};
  if (data.label !== undefined) updateValues.label = data.label;
  if (data.description !== undefined) updateValues.description = data.description;
  if (data.inputType !== undefined) updateValues.inputType = data.inputType;
  if (data.options !== undefined) updateValues.options = data.options;
  if (data.sliderMin !== undefined) updateValues.sliderMin = data.sliderMin;
  if (data.sliderMax !== undefined) updateValues.sliderMax = data.sliderMax;
  if (data.sliderStep !== undefined) updateValues.sliderStep = data.sliderStep;
  if (data.required !== undefined) updateValues.required = data.required;
  if (data.active !== undefined) updateValues.active = data.active;
  if (data.userCanView !== undefined) updateValues.userCanView = data.userCanView;
  if (data.userCanEdit !== undefined) updateValues.userCanEdit = data.userCanEdit;
  if (data.modCanView !== undefined) updateValues.modCanView = data.modCanView;
  if (data.modCanEdit !== undefined) updateValues.modCanEdit = data.modCanEdit;
  if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;

  if (Object.keys(updateValues).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No fields to update." });
  }

  const [updated] = await db
    .update(communityCustomFields)
    .set(updateValues)
    .where(eq(communityCustomFields.id, id))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Custom field not found." });
  }

  return { field: updated };
});
