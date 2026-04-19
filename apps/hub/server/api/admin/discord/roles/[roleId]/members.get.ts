import { requireAdminSession } from "../../../../../utils/auth";
import { fetchDiscordGuildMembersByRoleFromBot } from "../../../../../utils/botSync";
import { throwBotBridgeHttpError } from "../../../../../utils/bot-bridge-error";
import { requireRouterParam } from "../../../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const roleId = requireRouterParam(event, "roleId", "Missing role id.");

  try {
    return await fetchDiscordGuildMembersByRoleFromBot(roleId);
  } catch (error) {
    throwBotBridgeHttpError(error);
  }
});
