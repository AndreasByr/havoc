import type { MatrixClient } from "matrix-bot-sdk";
import { getSpaceHierarchy } from "../utils/matrix-helpers.js";
import { botAppHookRegistry } from "../utils/app-hooks.js";

/**
 * Register a handler for room membership events.
 * Emits onMemberJoin app hooks when users join rooms in the configured space.
 */
export function registerRoomMemberHandler(client: MatrixClient, spaceId: string | null) {
  client.on("room.event", async (roomId: string, event: Record<string, unknown>) => {
    if (event.type !== "m.room.member") return;

    const content = event.content as { membership?: string; displayname?: string } | undefined;
    const prevContent = event.unsigned as { prev_content?: { membership?: string } } | undefined;

    if (!content) return;

    // Detect join events (membership changed to "join")
    const isJoin = content.membership === "join" && prevContent?.prev_content?.membership !== "join";
    if (!isJoin) return;

    // Ignore own joins
    const botUserId = await client.getUserId();
    if (event.state_key === botUserId) return;

    // Check if room is in our space
    if (spaceId && roomId !== spaceId) {
      try {
        const hierarchy = await getSpaceHierarchy(client, spaceId);
        const roomIds = hierarchy.map((r: { room_id: string }) => r.room_id);
        if (!roomIds.includes(roomId)) return;
      } catch {
        return;
      }
    }

    botAppHookRegistry.emit("onMemberJoin", {
      guildId: spaceId || "",
      memberId: event.state_key as string,
      username: content.displayname || (event.state_key as string),
      joinedAt: new Date().toISOString(),
      platform: "matrix"
    });
  });
}
