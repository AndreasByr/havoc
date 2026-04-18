import { eq } from "drizzle-orm";
import { membershipSettings } from "@guildora/shared";
import { listActiveCommunityRoleMappings } from "./community";
import { fetchDiscordGuildMembersByRoleFromBot, fetchDiscordGuildRolesFromBot } from "./botSync";
import { upsertMirroredDiscordMember, wasUserExistingByDiscordId } from "./admin-mirror";
import { MEMBERSHIP_SETTINGS_SINGLETON_ID } from "./membership-settings";
import type { getDb } from "./db";

type DbClient = ReturnType<typeof getDb>;

export interface SyncResult {
  created: number;
  updated: number;
  conflicts: number;
  error?: string;
}

export async function runAutoSyncCycle(db: DbClient, superadminDiscordId?: string | null): Promise<SyncResult> {
  const mappings = await listActiveCommunityRoleMappings();
  if (mappings.length === 0) {
    return { created: 0, updated: 0, conflicts: 0 };
  }

  const guildRolesResponse = await fetchDiscordGuildRolesFromBot();
  const guildRoles = guildRolesResponse.roles;

  // Aggregate members from all mapped roles (same logic as import.post.ts)
  const importMap = new Map<string, {
    member: { discordId: string; displayName: string; nickname: string | null; avatarUrl: string | null; roleIds: string[] };
    communityRoleIds: Set<number>;
  }>();

  for (const mapping of mappings) {
    const response = await fetchDiscordGuildMembersByRoleFromBot(mapping.discordRoleId);
    for (const member of response.members) {
      const existing = importMap.get(member.discordId);
      if (existing) {
        existing.communityRoleIds.add(mapping.id);
      } else {
        importMap.set(member.discordId, {
          member,
          communityRoleIds: new Set([mapping.id])
        });
      }
    }
  }

  let created = 0;
  let updated = 0;
  let conflicts = 0;

  for (const [, aggregate] of importMap) {
    const matchedRoles = Array.from(aggregate.communityRoleIds);
    if (matchedRoles.length !== 1) {
      conflicts++;
      continue;
    }

    const existedBefore = await wasUserExistingByDiscordId(aggregate.member.discordId);
    await upsertMirroredDiscordMember(aggregate.member, matchedRoles[0]!, superadminDiscordId, guildRoles);
    if (existedBefore) {
      updated++;
    } else {
      created++;
    }
  }

  // Update last run timestamp
  await db
    .update(membershipSettings)
    .set({ autoSyncLastRun: new Date() })
    .where(eq(membershipSettings.id, MEMBERSHIP_SETTINGS_SINGLETON_ID));

  return { created, updated, conflicts };
}
