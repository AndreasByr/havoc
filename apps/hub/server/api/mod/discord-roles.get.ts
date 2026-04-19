import { requireModeratorSession } from "../../utils/auth";

import { fetchDiscordGuildRolesFromBot } from "../../utils/botSync";
import { throwBotBridgeHttpError } from "../../utils/bot-bridge-error";

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  try {
    return await fetchDiscordGuildRolesFromBot();
  } catch (error) {
    throwBotBridgeHttpError(error);
  }
});
