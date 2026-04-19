import { requireAdminSession } from "../../utils/auth";
import { createError } from "h3";
import { throwBotBridgeHttpError } from "../../utils/bot-bridge-error";
import { fetchDiscordGuildChannelsFromBot } from "../../utils/botSync";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  let channelsResponse: Awaited<ReturnType<typeof fetchDiscordGuildChannelsFromBot>>;
  try {
    channelsResponse = await fetchDiscordGuildChannelsFromBot();
  } catch (error) {
    throwBotBridgeHttpError(error);
  }

  return {
    channels: channelsResponse.channels
  };
});
