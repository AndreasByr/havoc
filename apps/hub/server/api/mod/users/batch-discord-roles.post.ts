import { eq } from "drizzle-orm";
import { users } from "@guildora/shared";
import { z } from "zod";
import { requireModeratorSession } from "../../../utils/auth";
import { isSuperadminUser } from "../../../utils/admin-mirror";
import {
  addDiscordRolesToMember,
  removeDiscordRolesFromBot
} from "../../../utils/botSync";
import { getDb } from "../../../utils/db";
import { readBodyWithSchema } from "../../../utils/http";

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  discordRoleIds: z.array(z.string().min(1)).min(1).max(25),
  action: z.enum(["add", "remove"])
});

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid payload.");
  const db = getDb();

  const succeeded: string[] = [];
  const failed: { userId: string; error: string }[] = [];
  const skipped: string[] = [];

  for (const userId of parsed.userIds) {
    try {
      const isSuperadmin = await isSuperadminUser(userId);
      if (isSuperadmin) {
        skipped.push(userId);
        continue;
      }

      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userRows[0];
      if (!user) {
        skipped.push(userId);
        continue;
      }

      if (parsed.action === "add") {
        await addDiscordRolesToMember(user.discordId, parsed.discordRoleIds);
      } else {
        await removeDiscordRolesFromBot(user.discordId, { roleIds: parsed.discordRoleIds });
      }

      succeeded.push(userId);
    } catch (error) {
      failed.push({
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { succeeded, failed, skipped };
});
