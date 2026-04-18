import type { MatrixClient } from "matrix-bot-sdk";
import { getSpaceHierarchy } from "../utils/matrix-helpers.js";
import { botAppHookRegistry } from "../utils/app-hooks.js";

/**
 * Register a handler for room message events.
 * Emits onMessage app hooks when messages arrive in the configured space.
 */
export function registerRoomMessageHandler(client: MatrixClient, spaceId: string | null) {
  client.on("room.message", async (roomId: string, event: Record<string, unknown>) => {
    // Ignore own messages
    const botUserId = await client.getUserId();
    if (event.sender === botUserId) return;

    // Ignore messages outside the configured space (if set)
    if (spaceId) {
      try {
        const hierarchy = await getSpaceHierarchy(client, spaceId);
        const roomIds = hierarchy.map((r: { room_id: string }) => r.room_id);
        if (!roomIds.includes(roomId)) return;
      } catch {
        // Can't verify space membership — process anyway
      }
    }

    const content = event.content as { body?: string; msgtype?: string } | undefined;
    if (!content?.body || content.msgtype !== "m.text") return;

    botAppHookRegistry.emit("onMessage", {
      guildId: spaceId || "",
      channelId: roomId,
      messageId: event.event_id as string,
      memberId: event.sender as string,
      content: content.body,
      occurredAt: new Date().toISOString(),
      platform: "matrix"
    });
  });
}
