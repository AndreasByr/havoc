import type { Client } from "discord.js";
import type { MessagePayload } from "@guildora/app-sdk";
import { botAppHookRegistry } from "../utils/app-hooks";
import { logger } from "../utils/logger";

export function registerMessageCreateEvent(client: Client) {
  client.on("messageCreate", async (message) => {
    try {
      // Ignore bot messages to prevent loops
      if (message.author.bot) return;
      // Only guild messages
      if (!message.guild) return;

      const payload: MessagePayload = {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        memberId: message.author.id,
        content: message.content,
        occurredAt: new Date().toISOString()
      };

      // Include reply context if this message is a reply
      if (message.reference?.messageId) {
        payload.replyToMessageId = message.reference.messageId;
        // Fetch the replied-to message to get its author
        try {
          const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
          if (repliedMessage) {
            payload.replyToUserId = repliedMessage.author.id;
          }
        } catch {
          // Could not fetch replied message, leave replyToUserId undefined
        }
      }

      await botAppHookRegistry.emit("onMessage", payload);
    } catch (error) {
      logger.error("messageCreate handling failed", error);
    }
  });
}
