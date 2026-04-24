/**
 * Tests that roomMessage and roomMember handlers emit the correct app hooks.
 * Verifies R001: onMessage and onMemberJoin fire when Matrix room events occur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
}));

vi.mock("../utils/matrix-helpers.js", () => ({
  getSpaceHierarchy: vi.fn().mockResolvedValue([
    { room_id: "!room:example.org" },
    { room_id: "!space:example.org" },
  ]),
}));

import { botAppHookRegistry } from "../utils/app-hooks.js";
import { registerRoomMessageHandler } from "../events/roomMessage.js";
import { registerRoomMemberHandler } from "../events/roomMember.js";

const SPACE_ID = "!space:example.org";
const ROOM_ID = "!room:example.org";
const BOT_USER_ID = "@bot:example.org";

function createClient(botUserId = BOT_USER_ID) {
  return {
    getUserId: vi.fn().mockResolvedValue(botUserId),
    on: vi.fn(),
  };
}

function extractHandler(clientOn: ReturnType<typeof vi.fn>, eventName: string): (...args: unknown[]) => Promise<void> {
  const call = clientOn.mock.calls.find((c) => c[0] === eventName);
  if (!call) throw new Error(`No handler registered for "${eventName}"`);
  return call[1] as (...args: unknown[]) => Promise<void>;
}

beforeEach(() => {
  vi.mocked(botAppHookRegistry.emit).mockReset();
});

describe("roomMessage handler — onMessage emission (R001)", () => {
  it("emits onMessage with correct payload for a text message", async () => {
    const client = createClient();
    registerRoomMessageHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.message");
    const event = {
      event_id: "$event1",
      sender: "@user:example.org",
      content: { body: "Hello world", msgtype: "m.text" },
    };
    await handler(ROOM_ID, event);

    expect(botAppHookRegistry.emit).toHaveBeenCalledOnce();
    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onMessage",
      expect.objectContaining({
        guildId: SPACE_ID,
        channelId: ROOM_ID,
        messageId: "$event1",
        memberId: "@user:example.org",
        content: "Hello world",
        platform: "matrix",
      })
    );
  });

  it("includes platform: 'matrix' in the payload", async () => {
    const client = createClient();
    registerRoomMessageHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.message");
    await handler(ROOM_ID, {
      event_id: "$e",
      sender: "@user:example.org",
      content: { body: "hi", msgtype: "m.text" },
    });

    const [, payload] = vi.mocked(botAppHookRegistry.emit).mock.calls[0];
    expect(payload).toMatchObject({ platform: "matrix" });
  });

  it("does not emit for the bot's own messages", async () => {
    const client = createClient();
    registerRoomMessageHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.message");
    await handler(ROOM_ID, {
      event_id: "$e",
      sender: BOT_USER_ID, // own message
      content: { body: "bot message", msgtype: "m.text" },
    });

    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("does not emit for non-text message types", async () => {
    const client = createClient();
    registerRoomMessageHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.message");
    await handler(ROOM_ID, {
      event_id: "$e",
      sender: "@user:example.org",
      content: { body: "file.jpg", msgtype: "m.file" },
    });

    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });
});

describe("roomMember handler — onMemberJoin emission (R001)", () => {
  it("emits onMemberJoin when a user joins a room in the space", async () => {
    const client = createClient();
    registerRoomMemberHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.event");
    const event = {
      type: "m.room.member",
      state_key: "@newuser:example.org",
      content: { membership: "join", displayname: "New User" },
      unsigned: { prev_content: { membership: "invite" } },
    };
    await handler(ROOM_ID, event);

    expect(botAppHookRegistry.emit).toHaveBeenCalledOnce();
    expect(botAppHookRegistry.emit).toHaveBeenCalledWith(
      "onMemberJoin",
      expect.objectContaining({
        guildId: SPACE_ID,
        memberId: "@newuser:example.org",
        username: "New User",
        platform: "matrix",
      })
    );
  });

  it("includes platform: 'matrix' in the onMemberJoin payload", async () => {
    const client = createClient();
    registerRoomMemberHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.event");
    await handler(ROOM_ID, {
      type: "m.room.member",
      state_key: "@user:example.org",
      content: { membership: "join", displayname: "User" },
      unsigned: { prev_content: { membership: "invite" } },
    });

    const [, payload] = vi.mocked(botAppHookRegistry.emit).mock.calls[0];
    expect(payload).toMatchObject({ platform: "matrix" });
  });

  it("does not emit onMemberJoin for the bot's own join", async () => {
    const client = createClient();
    registerRoomMemberHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.event");
    await handler(ROOM_ID, {
      type: "m.room.member",
      state_key: BOT_USER_ID, // bot joining
      content: { membership: "join" },
      unsigned: { prev_content: { membership: "invite" } },
    });

    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("does not emit for non-join membership events", async () => {
    const client = createClient();
    registerRoomMemberHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.event");
    await handler(ROOM_ID, {
      type: "m.room.member",
      state_key: "@user:example.org",
      content: { membership: "leave" },
      unsigned: {},
    });

    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });

  it("ignores events that are not m.room.member type", async () => {
    const client = createClient();
    registerRoomMemberHandler(client as never, SPACE_ID);

    const handler = extractHandler(client.on, "room.event");
    await handler(ROOM_ID, {
      type: "m.room.message",
      state_key: "@user:example.org",
      content: { body: "hello" },
    });

    expect(botAppHookRegistry.emit).not.toHaveBeenCalled();
  });
});
