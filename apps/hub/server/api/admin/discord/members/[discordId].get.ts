import { requireAdminSession } from "../../../../utils/auth";
import { createError } from "h3";
import { fetchDiscordGuildMemberFromBot } from "../../../../utils/botSync";
import { throwBotBridgeHttpError } from "../../../../utils/bot-bridge-error";
import { requireRouterParam } from "../../../../utils/http";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const discordId = requireRouterParam(event, "discordId", "Missing discord id.");

  try {
    return await fetchDiscordGuildMemberFromBot(discordId);
  } catch (error) {
    throwBotBridgeHttpError(error);
  }
});
