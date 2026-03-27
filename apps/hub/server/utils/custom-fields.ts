import { asc, eq } from "drizzle-orm";
import { communityCustomFields } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";
import { z } from "zod";

export const customFieldInputTypes = [
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "multiselect",
  "multiselect_search",
  "slider",
  "date"
] as const;

export type CustomFieldInputType = (typeof customFieldInputTypes)[number];

export const createCustomFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(128),
  description: z.string().max(512).nullable().optional(),
  inputType: z.enum(customFieldInputTypes),
  options: z.array(z.string()).nullable().optional(),
  sliderMin: z.number().int().nullable().optional(),
  sliderMax: z.number().int().nullable().optional(),
  sliderStep: z.number().int().positive().nullable().optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  userCanView: z.boolean().optional(),
  userCanEdit: z.boolean().optional(),
  modCanView: z.boolean().optional(),
  modCanEdit: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

export const updateCustomFieldSchema = createCustomFieldSchema.omit({ key: true }).partial();

export function enforceViewEditConsistency<T extends { userCanEdit?: boolean; userCanView?: boolean; modCanEdit?: boolean; modCanView?: boolean }>(data: T): T {
  if (data.userCanEdit) {
    data.userCanView = true;
  }
  if (data.modCanEdit) {
    data.modCanView = true;
  }
  return data;
}

export async function loadAllCustomFields(db: GuildoraDatabase) {
  return db
    .select()
    .from(communityCustomFields)
    .orderBy(asc(communityCustomFields.sortOrder), asc(communityCustomFields.createdAt));
}

export async function loadActiveCustomFields(db: GuildoraDatabase) {
  return db
    .select()
    .from(communityCustomFields)
    .where(eq(communityCustomFields.active, true))
    .orderBy(asc(communityCustomFields.sortOrder), asc(communityCustomFields.createdAt));
}

export function filterFieldsForUser(fields: Awaited<ReturnType<typeof loadAllCustomFields>>) {
  return fields.filter((f) => f.userCanView || f.userCanEdit);
}

export function filterFieldsForMod(fields: Awaited<ReturnType<typeof loadAllCustomFields>>) {
  return fields.filter((f) => f.modCanView || f.modCanEdit);
}

export function extractCustomFieldValues(
  allFields: Awaited<ReturnType<typeof loadAllCustomFields>>,
  profileCustomFields: Record<string, unknown>,
  editableOnly: boolean,
  role: "user" | "mod" | "admin"
) {
  const visible = role === "admin"
    ? allFields.filter((f) => f.active)
    : role === "mod"
      ? filterFieldsForMod(allFields)
      : filterFieldsForUser(allFields);

  return visible.map((field) => ({
    ...field,
    value: profileCustomFields[field.key] ?? null,
    canEdit: role === "admin"
      ? true
      : role === "mod"
        ? field.modCanEdit
        : field.userCanEdit
  })).filter((f) => !editableOnly || f.canEdit);
}

export function validateAndMergeFieldValues(
  allowedFields: Array<{ key: string; inputType: string }>,
  existingValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, unknown> {
  const allowedKeys = new Set(allowedFields.map((f) => f.key));
  const merged = { ...existingValues };

  for (const [key, value] of Object.entries(newValues)) {
    if (allowedKeys.has(key)) {
      merged[key] = value;
    }
  }

  return merged;
}
