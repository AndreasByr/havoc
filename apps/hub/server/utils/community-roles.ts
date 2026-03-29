import { eq } from "drizzle-orm";
import { communityRoles, permissionRoles, userCommunityRoles } from "@guildora/shared";
import { z } from "zod";
import { getDb } from "./db";

const baseCommunityRoleSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(250).nullable(),
  permissionRoleName: z.string().min(2).max(60),
  sortOrder: z.number().int().min(0).max(999).default(0)
});

export const modCommunityRoleSchema = baseCommunityRoleSchema;
export const adminCommunityRoleSchema = baseCommunityRoleSchema.extend({
  discordRoleId: z.string().trim().min(1).max(64).nullable()
});

type ModCommunityRoleInput = z.infer<typeof modCommunityRoleSchema>;
type AdminCommunityRoleInput = z.infer<typeof adminCommunityRoleSchema>;

function isDiscordRoleUniqueConstraintError(error: unknown) {
  const check = (err: unknown): boolean => {
    const message = err instanceof Error ? err.message : String(err);
    return message.toLowerCase().includes("community_roles_discord_role_id_unique");
  };
  if (check(error)) return true;
  if (error instanceof Error && "cause" in error) return check(error.cause);
  return false;
}

export function parseCommunityRoleId(raw: string | null | undefined) {
  const id = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid role id." });
  }
  return id;
}

async function resolvePermissionRoleId(permissionRoleName: string) {
  const db = getDb();
  const permission = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(eq(permissionRoles.name, permissionRoleName))
    .limit(1);
  const permissionRole = permission[0];
  if (!permissionRole) {
    throw createError({ statusCode: 404, statusMessage: "Permission role not found." });
  }
  return permissionRole.id;
}

function normalizeValues(
  input: ModCommunityRoleInput | AdminCommunityRoleInput,
  includeDiscordRoleId: boolean
) {
  const values: {
    name: string;
    description: string | null;
    permissionRoleId: number;
    sortOrder: number;
    discordRoleId?: string | null;
  } = {
    name: input.name,
    description: input.description,
    permissionRoleId: 0,
    sortOrder: input.sortOrder
  };

  if (includeDiscordRoleId && "discordRoleId" in input) {
    values.discordRoleId = input.discordRoleId;
  }

  return values;
}

export async function createCommunityRole(
  input: ModCommunityRoleInput | AdminCommunityRoleInput,
  options?: { includeDiscordRoleId?: boolean }
) {
  const includeDiscordRoleId = options?.includeDiscordRoleId === true;
  const db = getDb();
  const permissionRoleId = await resolvePermissionRoleId(input.permissionRoleName);
  const values = normalizeValues(input, includeDiscordRoleId);
  values.permissionRoleId = permissionRoleId;

  try {
    await db.insert(communityRoles).values(values);
  } catch (error) {
    if (includeDiscordRoleId && isDiscordRoleUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, statusMessage: "Discord role is already mapped." });
    }
    throw error;
  }
}

export async function updateCommunityRole(
  roleId: number,
  input: ModCommunityRoleInput | AdminCommunityRoleInput,
  options?: { includeDiscordRoleId?: boolean }
) {
  const includeDiscordRoleId = options?.includeDiscordRoleId === true;
  const db = getDb();
  const permissionRoleId = await resolvePermissionRoleId(input.permissionRoleName);
  const values = normalizeValues(input, includeDiscordRoleId);
  values.permissionRoleId = permissionRoleId;

  try {
    await db.update(communityRoles).set(values).where(eq(communityRoles.id, roleId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (includeDiscordRoleId && isDiscordRoleUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, statusMessage: "Discord role is already mapped." });
    }
    if (message.toLowerCase().includes("community_roles_name_unique")) {
      throw createError({ statusCode: 409, statusMessage: "A community role with this name already exists." });
    }
    console.error("updateCommunityRole failed:", message);
    throw error;
  }
}

export async function deleteCommunityRole(roleId: number, options?: { requireUnassigned?: boolean }) {
  const db = getDb();
  if (options?.requireUnassigned) {
    const assigned = await db
      .select({ userId: userCommunityRoles.userId })
      .from(userCommunityRoles)
      .where(eq(userCommunityRoles.communityRoleId, roleId))
      .limit(1);
    if (assigned[0]) {
      throw createError({
        statusCode: 409,
        statusMessage: "Role still has assigned users."
      });
    }
  }

  await db.delete(communityRoles).where(eq(communityRoles.id, roleId));
}
