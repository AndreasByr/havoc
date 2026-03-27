import { z } from "zod";
import type { DisplayNameField } from "../types/profile";

export const PROFILE_NAME_DELIMITER = " | ";

const namePartSchema = z
  .string()
  .trim()
  .max(60)
  .refine((value) => !value.includes("|"), "Name parts must not include '|'.");

const ingameNameSchema = z
  .string()
  .trim()
  .max(60)
  .refine((value) => value.length > 0, "Ingame name is required.")
  .refine((value) => !value.includes("|"), "Name parts must not include '|'.");
const optionalRufnameSchema = z
  .string()
  .trim()
  .max(60)
  .refine((value) => !value.includes("|"), "Name parts must not include '|'.")
  .nullable();

export type ProfileNameParts = {
  ingameName: string;
  rufname: string | null;
};

export function sanitizeProfileNamePart(value: string) {
  return value.replaceAll("|", " ").trim().slice(0, 60);
}

export function coerceProfileNameFromRaw(rawValue: string, fallbackIngameName = "Member") {
  const parsed = parseProfileName(rawValue);
  const ingameName = sanitizeProfileNamePart(parsed.ingameName) || sanitizeProfileNamePart(fallbackIngameName) || "Member";
  const normalizedRufname = parsed.rufname ? sanitizeProfileNamePart(parsed.rufname) : null;
  const rufname = normalizedRufname && normalizedRufname.length > 0 ? normalizedRufname : null;
  return serializeProfileName({ ingameName, rufname });
}

export function validateProfileNameParts(input: ProfileNameParts) {
  const ingameName = ingameNameSchema.parse(input.ingameName);
  const parsedRufname = optionalRufnameSchema.parse(input.rufname);
  const rufname = parsedRufname && parsedRufname.length > 0 ? parsedRufname : null;
  return { ingameName, rufname };
}

export function serializeProfileName(input: ProfileNameParts) {
  const parsed = validateProfileNameParts(input);
  return parsed.rufname ? `${parsed.ingameName}${PROFILE_NAME_DELIMITER}${parsed.rufname}` : parsed.ingameName;
}

export function parseProfileName(profileName: string): ProfileNameParts {
  const normalized = profileName.trim();
  const delimiterIndex = normalized.indexOf(PROFILE_NAME_DELIMITER);
  if (delimiterIndex < 0) {
    return {
      ingameName: normalized,
      rufname: null
    };
  }

  const ingameName = normalized.slice(0, delimiterIndex).trim();
  const rawRufname = normalized.slice(delimiterIndex + PROFILE_NAME_DELIMITER.length).trim();
  return {
    ingameName,
    rufname: rawRufname.length > 0 ? rawRufname : null
  };
}

// ─── Template-aware functions ────────────────────────────────────────────

export function serializeFromTemplate(
  template: DisplayNameField[],
  values: Record<string, string>
): string {
  const parts = template.map((field) => {
    const raw = values[field.key] ?? "";
    return sanitizeProfileNamePart(String(raw));
  });
  // Trim trailing empty parts
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts.join(PROFILE_NAME_DELIMITER);
}

export function parseWithTemplate(
  displayName: string,
  template: DisplayNameField[]
): Record<string, string> {
  const normalized = displayName.trim();
  const segments = normalized.split(PROFILE_NAME_DELIMITER).map((s) => s.trim());
  const result: Record<string, string> = {};
  for (let i = 0; i < template.length; i++) {
    result[template[i].key] = i < segments.length ? segments[i] : "";
  }
  return result;
}

export function validateWithTemplate(
  template: DisplayNameField[],
  values: Record<string, string>
): Record<string, string> {
  const validated: Record<string, string> = {};
  for (const field of template) {
    const raw = values[field.key] ?? "";
    const sanitized = sanitizeProfileNamePart(raw);
    if (field.required && sanitized.length === 0) {
      throw new Error(`Field "${field.label}" is required.`);
    }
    validated[field.key] = sanitized;
  }
  return validated;
}
