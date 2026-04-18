import { vi } from "vitest";

export function createMockMatrixClient() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getUserId: vi.fn().mockResolvedValue("@bot:example.org"),
    getUserProfile: vi.fn().mockResolvedValue({ displayname: "Test User", avatar_url: null }),
    joinRoom: vi.fn().mockResolvedValue("!room:example.org"),
    createRoom: vi.fn().mockResolvedValue("!newroom:example.org"),
    leaveRoom: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue("$event1"),
    sendStateEvent: vi.fn().mockResolvedValue("$event2"),
    getRoomStateEvent: vi.fn().mockResolvedValue({ users: {}, users_default: 0, events_default: 0 }),
    getSpaceHierarchy: vi.fn().mockResolvedValue([
      { room_id: "!room1:example.org", name: "General", room_type: undefined },
      { room_id: "!room2:example.org", name: "Random", room_type: undefined },
    ]),
    getJoinedRooms: vi.fn().mockResolvedValue(["!room1:example.org", "!room2:example.org"]),
    getJoinedRoomMembers: vi.fn().mockResolvedValue([
      "@alice:example.org",
      "@bob:example.org",
      "@carol:example.org",
    ]),
    redactEvent: vi.fn().mockResolvedValue(undefined),
    kickUser: vi.fn().mockResolvedValue(undefined),
    banUser: vi.fn().mockResolvedValue(undefined),
    dms: {
      getOrCreateDm: vi.fn().mockResolvedValue("!dm-room:example.org"),
    },
    doRequest: vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.includes("/hierarchy")) {
        return Promise.resolve({
          rooms: [
            { room_id: "!space:example.org", name: "Space", room_type: "m.space" },
            { room_id: "!room1:example.org", name: "General" },
            { room_id: "!room2:example.org", name: "Random" },
          ]
        });
      }
      return Promise.resolve({});
    }),
    on: vi.fn(),
  };
}
