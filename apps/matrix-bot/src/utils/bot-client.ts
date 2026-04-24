import type { MatrixClient } from "matrix-bot-sdk";
import type { BotClient } from "@guildora/app-sdk";
import { getSpaceHierarchy } from "./matrix-helpers.js";

export function createMatrixBotClient(client: MatrixClient): BotClient {
  return {
    async sendMessage(channelId: string, content: string): Promise<void> {
      try {
        await client.sendText(channelId, content);
      } catch (err) {
        console.error(`[bot-client] Failed to send message to ${channelId}`, err);
      }
    },

    async createVoiceChannel(_name: string, _parentId: string) {
      return null;
    },

    async deleteChannel(_channelId: string) {
      return false;
    },

    async getChannel(channelId: string) {
      try {
        const nameEvent = await client.getRoomStateEvent(channelId, "m.room.name", "");
        const name = typeof nameEvent?.name === "string" ? nameEvent.name : channelId;
        return { id: channelId, name, parentId: null, memberCount: null };
      } catch (err) {
        console.error(`[bot-client] Failed to fetch channel ${channelId}`, err);
        return null;
      }
    },

    async setChannelName(channelId: string, name: string) {
      try {
        await client.sendStateEvent(channelId, "m.room.name", "", { name });
        return true;
      } catch (err) {
        console.error(`[bot-client] Failed to rename channel ${channelId}`, err);
        return false;
      }
    },

    async moveMemberToChannel(_memberId: string, _channelId: string) {
      return false;
    },

    async getMemberVoiceChannelId(_memberId: string) {
      return null;
    },

    async listVoiceChannelsByCategory(_categoryId: string) {
      return [];
    },

    async listTextChannels() {
      try {
        const spaceId = process.env.MATRIX_SPACE_ID;
        if (!spaceId) return [];
        const rooms = await getSpaceHierarchy(client, spaceId);
        return rooms
          .filter((r) => r.room_type !== "m.space")
          .map((r) => ({ id: r.room_id, name: r.name ?? r.room_id }));
      } catch (err) {
        console.error("[bot-client] Failed to list text channels", err);
        return [];
      }
    },

    async listAllChannels() {
      try {
        const spaceId = process.env.MATRIX_SPACE_ID;
        if (!spaceId) return [];
        const rooms = await getSpaceHierarchy(client, spaceId);
        return rooms.map((r) => ({
          id: r.room_id,
          name: r.name ?? r.room_id,
          type: r.room_type === "m.space" ? "category" : "text",
          parentId: null
        }));
      } catch (err) {
        console.error("[bot-client] Failed to list all channels", err);
        return [];
      }
    }
  };
}
