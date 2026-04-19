import { requireAdminSession } from "../../utils/auth";
import { createError } from "h3";
import { throwBotBridgeHttpError } from "../../utils/bot-bridge-error";
import { fetchDiscordGuildRolesFromBot } from "../../utils/botSync";
import { listSelectableDiscordRoleRows } from "../../utils/discord-roles";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const selectableRows = await listSelectableDiscordRoleRows();
  let guildRolesResponse: Awaited<ReturnType<typeof fetchDiscordGuildRolesFromBot>>;
  try {
    guildRolesResponse = await fetchDiscordGuildRolesFromBot();
  } catch (error) {
    throwBotBridgeHttpError(error);
  }

  return {
    guildRoles: guildRolesResponse.roles,
    selectableRoleIds: selectableRows.map((row) => row.discordRoleId),
    isSuperadmin: (session.user.permissionRoles ?? session.user.roles ?? []).includes("superadmin")
  };
});
