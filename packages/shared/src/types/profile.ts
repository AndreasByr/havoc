import { z } from "zod";
import type { PermissionRole } from "./roles";
import type { LocaleCode, UserLocalePreference } from "./locale";

export type AppearancePreference = "light" | "dark" | "system";

// ─── Display Name Template ──────────────────────────────────────────────

export interface DisplayNameField {
  key: string;
  label: string;
  type: "string" | "number";
  required: boolean;
}

export const displayNameFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Key must start with a lowercase letter and contain only lowercase letters, digits, and underscores"),
  label: z.string().min(1).max(100),
  type: z.enum(["string", "number"]),
  required: z.boolean()
});

export const displayNameTemplateSchema = z
  .array(displayNameFieldSchema)
  .max(10)
  .refine(
    (fields) => {
      const keys = fields.map((f) => f.key);
      return new Set(keys).size === keys.length;
    },
    { message: "Field keys must be unique" }
  );

export interface CommunityProfile {
  id: string;
  userId: string;
  appearancePreference: AppearancePreference;
  localePreference: UserLocalePreference;
  effectiveLocale: LocaleCode;
  customFields: Record<string, unknown>;
  permissionRoles: PermissionRole[];
  communityRole: string | null;
}
