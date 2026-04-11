import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock("@guildora/app-sdk", () => ({}));

vi.mock("../../utils/app-hooks", () => ({
  botAppHookRegistry: { emit: (...args: unknown[]) => mockEmit(...args) },
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerMessageCreateEvent } from "../messageCreate.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

type MessageHandler = (message: unknown) => Promise<void>;

function captureHandler(): MessageHandler {
  const client = { on: vi.fn() };
  registerMessageCreateEvent(client as any);
  return client.on.mock.calls.find((c: unknown[]) => c[0] === "messageCreate")![1];
}

function makeMessage(overrides: {
  bot?: boolean;
  guildId?: string | null;
  content?: string;
  attachments?: Array<{ url: string; contentType: string; name: string }>;
  reference?: { messageId?: string };
} = {}) {
  const attachmentValues = (overrides.attachments ?? []).map((a) => ({
    url: a.url,
    contentType: a.contentType,
    name: a.name,
  }));

  return {
    author: { bot: overrides.bot ?? false, id: "author-1" },
    guild: overrides.guildId === null ? null : { id: overrides.guildId ?? "guild-1" },
    channel: {
      id: "ch-1",
      messages: {
        fetch: vi.fn().mockResolvedValue({ author: { id: "reply-author" } }),
      },
    },
    id: "msg-1",
    content: overrides.content ?? "hello world",
    attachments: {
      values: () => attachmentValues,
    },
    reference: overrides.reference ?? null,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("messageCreate event", () => {
  let handler: MessageHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = captureHandler();
  });

  it("registers a messageCreate listener", () => {
    const client = { on: vi.fn() };
    registerMessageCreateEvent(client as any);
    expect(client.on).toHaveBeenCalledWith("messageCreate", expect.any(Function));
  });

  it("ignores bot messages", async () => {
    const message = makeMessage({ bot: true });
    await handler(message);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("ignores DM messages (no guild)", async () => {
    const message = makeMessage({ guildId: null });
    await handler(message);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits onMessage with correct payload", async () => {
    const message = makeMessage({ content: "test msg" });
    await handler(message);
    expect(mockEmit).toHaveBeenCalledWith(
      "onMessage",
      expect.objectContaining({
        guildId: "guild-1",
        channelId: "ch-1",
        messageId: "msg-1",
        memberId: "author-1",
        content: "test msg",
      })
    );
  });

  it("extracts image attachments into payload", async () => {
    const message = makeMessage({
      attachments: [
        { url: "https://cdn.example.com/img.png", contentType: "image/png", name: "img.png" },
        { url: "https://cdn.example.com/doc.pdf", contentType: "application/pdf", name: "doc.pdf" },
      ],
    });
    await handler(message);
    const payload = mockEmit.mock.calls[0][1];
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0]).toEqual({
      url: "https://cdn.example.com/img.png",
      contentType: "image/png",
      filename: "img.png",
    });
  });

  it("does not include attachments key when no image attachments", async () => {
    const message = makeMessage({ attachments: [] });
    await handler(message);
    const payload = mockEmit.mock.calls[0][1];
    expect(payload.attachments).toBeUndefined();
  });

  it("includes replyToMessageId and replyToUserId for reply messages", async () => {
    const message = makeMessage({ reference: { messageId: "ref-msg-1" } });
    await handler(message);
    const payload = mockEmit.mock.calls[0][1];
    expect(payload.replyToMessageId).toBe("ref-msg-1");
    expect(payload.replyToUserId).toBe("reply-author");
  });

  it("handles fetch failure for reply gracefully", async () => {
    const message = makeMessage({ reference: { messageId: "ref-msg-1" } });
    (message.channel.messages.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not found")
    );
    await handler(message);
    const payload = mockEmit.mock.calls[0][1];
    expect(payload.replyToMessageId).toBe("ref-msg-1");
    expect(payload.replyToUserId).toBeUndefined();
  });

  it("catches errors without throwing", async () => {
    mockEmit.mockRejectedValueOnce(new Error("hook crash"));
    const message = makeMessage();
    await expect(handler(message)).resolves.toBeUndefined();
  });
});
