import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockGetUserByDiscordId = vi.fn();
const mockCloseIfOpen = vi.fn();
const mockSplitOnChannelMismatch = vi.fn();
const mockIsRegularVoiceChannel = vi.fn();
const mockEmit = vi.fn();
const mockGetDb = vi.fn(() => ({}));

vi.mock("../../utils/community", () => ({
  getUserByDiscordId: (...args: unknown[]) => mockGetUserByDiscordId(...args),
}));

vi.mock("../../utils/voice-session-lifecycle", () => ({
  closeIfOpen: (...args: unknown[]) => mockCloseIfOpen(...args),
  splitOnChannelMismatch: (...args: unknown[]) => mockSplitOnChannelMismatch(...args),
  isRegularVoiceChannel: (...args: unknown[]) => mockIsRegularVoiceChannel(...args),
}));

vi.mock("../../utils/app-hooks", () => ({
  botAppHookRegistry: { emit: (...args: unknown[]) => mockEmit(...args) },
}));

vi.mock("../../utils/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerVoiceStateUpdateEvent } from "../voiceStateUpdate.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVoiceState(overrides: {
  channelId?: string | null;
  id?: string;
  bot?: boolean;
  guildId?: string;
}) {
  return {
    channelId: overrides.channelId ?? null,
    id: overrides.id ?? "user-1",
    member: {
      user: { bot: overrides.bot ?? false },
    },
    guild: overrides.guildId ? { id: overrides.guildId } : null,
  };
}

type VoiceHandler = (oldState: unknown, newState: unknown) => Promise<void>;

function captureHandler(): { handler: VoiceHandler; client: { on: ReturnType<typeof vi.fn> } } {
  const client = { on: vi.fn() };
  registerVoiceStateUpdateEvent(client as any);
  const handler = client.on.mock.calls.find((c: unknown[]) => c[0] === "voiceStateUpdate")![1];
  return { handler, client };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("voiceStateUpdate event", () => {
  let handler: VoiceHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AFK_VOICE_CHANNEL_ID;
    mockGetUserByDiscordId.mockResolvedValue({ id: "internal-1" });
    mockIsRegularVoiceChannel.mockReturnValue(true);
    mockCloseIfOpen.mockResolvedValue(true);
    mockSplitOnChannelMismatch.mockResolvedValue("split");
    mockEmit.mockResolvedValue(undefined);
    ({ handler } = captureHandler());
  });

  it("registers a voiceStateUpdate listener on the client", () => {
    const client = { on: vi.fn() };
    registerVoiceStateUpdateEvent(client as any);
    expect(client.on).toHaveBeenCalledWith("voiceStateUpdate", expect.any(Function));
  });

  it("ignores bot users", async () => {
    const oldState = makeVoiceState({ channelId: null, bot: true });
    const newState = makeVoiceState({ channelId: "ch-1", bot: true });
    await handler(oldState, newState);
    expect(mockGetUserByDiscordId).not.toHaveBeenCalled();
  });

  it("ignores when channel did not change", async () => {
    const oldState = makeVoiceState({ channelId: "ch-1" });
    const newState = makeVoiceState({ channelId: "ch-1" });
    await handler(oldState, newState);
    expect(mockGetUserByDiscordId).not.toHaveBeenCalled();
  });

  it("returns early when discordId is missing", async () => {
    const oldState = makeVoiceState({ channelId: "ch-1", id: "" });
    const newState = makeVoiceState({ channelId: "ch-2", id: "" });
    await handler(oldState, newState);
    expect(mockGetUserByDiscordId).not.toHaveBeenCalled();
  });

  it("returns early when user not found in DB", async () => {
    mockGetUserByDiscordId.mockResolvedValue(null);
    const oldState = makeVoiceState({ channelId: "ch-1" });
    const newState = makeVoiceState({ channelId: "ch-2" });
    await handler(oldState, newState);
    expect(mockCloseIfOpen).not.toHaveBeenCalled();
    expect(mockSplitOnChannelMismatch).not.toHaveBeenCalled();
  });

  it("calls closeIfOpen when user leaves a regular channel to nothing", async () => {
    // leftRegular=true, joinedRegular=false
    mockIsRegularVoiceChannel
      .mockReturnValueOnce(true)   // leftRegular
      .mockReturnValueOnce(false); // joinedRegular
    const oldState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    const newState = makeVoiceState({ channelId: null, guildId: "g1" });
    await handler(oldState, newState);
    expect(mockCloseIfOpen).toHaveBeenCalled();
  });

  it("calls splitOnChannelMismatch when user moves between regular channels", async () => {
    // leftRegular=true, joinedRegular=true
    mockIsRegularVoiceChannel
      .mockReturnValueOnce(true)  // leftRegular
      .mockReturnValueOnce(true); // joinedRegular
    const oldState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    const newState = makeVoiceState({ channelId: "ch-2", guildId: "g1" });
    await handler(oldState, newState);
    expect(mockSplitOnChannelMismatch).toHaveBeenCalled();
  });

  it("calls splitOnChannelMismatch when user joins a regular channel from nothing", async () => {
    mockIsRegularVoiceChannel
      .mockReturnValueOnce(false) // leftRegular (was null)
      .mockReturnValueOnce(true); // joinedRegular
    const oldState = makeVoiceState({ channelId: null, guildId: "g1" });
    const newState = makeVoiceState({ channelId: "ch-2", guildId: "g1" });
    await handler(oldState, newState);
    expect(mockSplitOnChannelMismatch).toHaveBeenCalled();
  });

  it("emits onVoiceActivity with action 'join' when joining from null", async () => {
    mockIsRegularVoiceChannel.mockReturnValue(false); // skip lifecycle
    const oldState = makeVoiceState({ channelId: null, guildId: "g1" });
    const newState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    await handler(oldState, newState);
    expect(mockEmit).toHaveBeenCalledWith(
      "onVoiceActivity",
      expect.objectContaining({ action: "join", channelId: "ch-1" })
    );
  });

  it("emits onVoiceActivity with action 'leave' when leaving to null", async () => {
    mockIsRegularVoiceChannel.mockReturnValue(false);
    const oldState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    const newState = makeVoiceState({ channelId: null, guildId: "g1" });
    await handler(oldState, newState);
    expect(mockEmit).toHaveBeenCalledWith(
      "onVoiceActivity",
      expect.objectContaining({ action: "leave" })
    );
  });

  it("emits onVoiceActivity with action 'move' when switching channels", async () => {
    mockIsRegularVoiceChannel.mockReturnValue(false);
    const oldState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    const newState = makeVoiceState({ channelId: "ch-2", guildId: "g1" });
    await handler(oldState, newState);
    expect(mockEmit).toHaveBeenCalledWith(
      "onVoiceActivity",
      expect.objectContaining({ action: "move" })
    );
  });

  it("does not emit onVoiceActivity when guild is missing", async () => {
    mockIsRegularVoiceChannel.mockReturnValue(false);
    const oldState = makeVoiceState({ channelId: "ch-1" }); // no guildId
    const newState = makeVoiceState({ channelId: "ch-2" });
    await handler(oldState, newState);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("catches and logs errors without throwing", async () => {
    mockGetUserByDiscordId.mockRejectedValue(new Error("db down"));
    const oldState = makeVoiceState({ channelId: "ch-1", guildId: "g1" });
    const newState = makeVoiceState({ channelId: "ch-2", guildId: "g1" });
    await expect(handler(oldState, newState)).resolves.toBeUndefined();
  });
});
