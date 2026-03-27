import { ChannelType, type Client } from "discord.js";
import type { BotClient } from "@guildora/app-sdk";
import { logger } from "./logger";

export function createBotClient(client: Client): BotClient {
  return {
    async sendMessage(channelId: string, content: string): Promise<void> {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !("send" in channel) || typeof (channel as { send?: unknown }).send !== "function") {
          logger.warn(`[bot-client] Channel ${channelId} not found or not sendable.`);
          return;
        }
        await (channel as { send(content: string): Promise<unknown> }).send(content);
      } catch (err) {
        logger.error(`[bot-client] Failed to send message to ${channelId}`, err);
      }
    },

    async createVoiceChannel(name: string, parentId: string) {
      try {
        const parentChannel = await client.channels.fetch(parentId);
        if (!parentChannel || !("guild" in parentChannel)) {
          logger.warn(`[bot-client] Parent channel ${parentId} not found or not a guild channel.`);
          return null;
        }
        const guild = (parentChannel as { guild: { channels: { create(opts: unknown): Promise<{ id: string; name: string }> } } }).guild;
        const created = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: parentId
        });
        return { id: created.id, name: created.name };
      } catch (err) {
        logger.error(`[bot-client] Failed to create voice channel "${name}" in parent ${parentId}`, err);
        return null;
      }
    },

    async deleteChannel(channelId: string) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return false;
        if ("delete" in channel && typeof (channel as { delete?: unknown }).delete === "function") {
          await (channel as { delete(): Promise<unknown> }).delete();
          return true;
        }
        return false;
      } catch (err) {
        logger.error(`[bot-client] Failed to delete channel ${channelId}`, err);
        return false;
      }
    },

    async getChannel(channelId: string) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return null;
        const raw = channel as Record<string, unknown>;
        const name = typeof raw.name === "string" ? raw.name : "";
        const parentId = typeof raw.parentId === "string" ? raw.parentId : null;
        let memberCount: number | null = null;
        if (raw.members && typeof raw.members === "object") {
          const size = (raw.members as { size?: unknown }).size;
          if (typeof size === "number") memberCount = size;
        }
        return { id: channel.id, name, parentId, memberCount };
      } catch (err) {
        logger.error(`[bot-client] Failed to fetch channel ${channelId}`, err);
        return null;
      }
    },

    async setChannelName(channelId: string, name: string) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return false;
        if ("setName" in channel && typeof (channel as { setName?: unknown }).setName === "function") {
          await (channel as { setName(name: string): Promise<unknown> }).setName(name);
          return true;
        }
        return false;
      } catch (err) {
        logger.error(`[bot-client] Failed to rename channel ${channelId}`, err);
        return false;
      }
    },

    async moveMemberToChannel(memberId: string, channelId: string) {
      try {
        // Derive guild from the target channel
        const channel = await client.channels.fetch(channelId);
        if (!channel || !("guild" in channel)) return false;
        const guild = (channel as { guild: { members: { fetch(id: string): Promise<{ voice: { setChannel(id: string): Promise<unknown> } } | null> } } }).guild;
        const member = await guild.members.fetch(memberId);
        if (!member || !member.voice) return false;
        await member.voice.setChannel(channelId);
        return true;
      } catch (err) {
        logger.error(`[bot-client] Failed to move member ${memberId} to channel ${channelId}`, err);
        return false;
      }
    },

    async getMemberVoiceChannelId(memberId: string) {
      try {
        const guildId = process.env.DISCORD_GUILD_ID;
        if (!guildId) return null;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return null;
        const voiceState = guild.voiceStates.cache.get(memberId);
        return voiceState?.channelId ?? null;
      } catch (err) {
        logger.error(`[bot-client] Failed to get voice state for member ${memberId}`, err);
        return null;
      }
    },

    async listTextChannels() {
      try {
        const guildId = process.env.DISCORD_GUILD_ID;
        if (!guildId) return [];
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return [];
        const channels = await guild.channels.fetch();
        const result: Array<{ id: string; name: string }> = [];
        for (const [, channel] of channels) {
          if (!channel) continue;
          if (channel.type !== ChannelType.GuildText) continue;
          result.push({ id: channel.id, name: channel.name });
        }
        return result;
      } catch (err) {
        logger.error("[bot-client] Failed to list text channels", err);
        return [];
      }
    },

    async listVoiceChannelsByCategory(categoryId: string) {
      try {
        // Derive guild from the category channel
        const category = await client.channels.fetch(categoryId);
        if (!category || !("guild" in category)) return [];
        const guild = (category as { guild: { channels: { fetch(): Promise<Map<string, { id: string; name: string; type: ChannelType; parentId: string | null; members?: { size?: number } }>> } } }).guild;
        const channels = await guild.channels.fetch();
        const result: Array<{ id: string; name: string; parentId: string | null; memberCount: number | null }> = [];
        for (const [, channel] of channels) {
          if (!channel) continue;
          if (channel.type !== ChannelType.GuildVoice) continue;
          if (channel.parentId !== categoryId) continue;
          let memberCount: number | null = null;
          if ("members" in channel && channel.members && typeof channel.members === "object") {
            const size = (channel.members as { size?: unknown }).size;
            if (typeof size === "number") memberCount = size;
          }
          result.push({ id: channel.id, name: channel.name, parentId: channel.parentId, memberCount });
        }
        return result;
      } catch (err) {
        logger.error(`[bot-client] Failed to list voice channels in category ${categoryId}`, err);
        return [];
      }
    }
  };
}
