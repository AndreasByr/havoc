import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockHandleApplicationButton = vi.fn();
const mockHandleRolePickerButton = vi.fn();
const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock("../../interactions/application-button", () => ({
  handleApplicationButtonInteraction: (...args: unknown[]) => mockHandleApplicationButton(...args),
}));

vi.mock("../../interactions/role-picker-button", () => ({
  handleRolePickerButtonInteraction: (...args: unknown[]) => mockHandleRolePickerButton(...args),
}));

vi.mock("../../utils/app-hooks", () => ({
  botAppHookRegistry: { emit: (...args: unknown[]) => mockEmit(...args) },
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../i18n/messages", () => ({
  resolveBotLocale: () => "en",
  getBotMessages: () => ({
    interaction: {
      unknownCommand: "Unknown command: {commandName}",
      commandFailed: "Command failed.",
    },
  }),
  interpolate: (template: string, vars: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""),
}));

import { registerInteractionCreateEvent } from "../interactionCreate.js";
import { Collection } from "discord.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

type InteractionHandler = (interaction: unknown) => Promise<void>;

function captureHandler(commands = new Collection<string, any>()) {
  const client = { on: vi.fn() };
  registerInteractionCreateEvent(client as any, commands);
  const handler = client.on.mock.calls.find((c: unknown[]) => c[0] === "interactionCreate")![1];
  return handler as InteractionHandler;
}

function makeButtonInteraction(customId: string) {
  return {
    isButton: () => true,
    isChatInputCommand: () => false,
    customId,
    replied: false,
    deferred: false,
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

function makeChatInputInteraction(commandName: string) {
  return {
    isButton: () => false,
    isChatInputCommand: () => true,
    commandName,
    locale: "en",
    guildLocale: "en",
    guildId: "g1",
    channelId: "ch-1",
    user: { id: "user-1" },
    replied: false,
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("interactionCreate event", () => {
  let handler: InteractionHandler;
  let commands: Collection<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    commands = new Collection();
    handler = captureHandler(commands);
  });

  it("registers an interactionCreate listener on the client", () => {
    const client = { on: vi.fn() };
    registerInteractionCreateEvent(client as any, commands);
    expect(client.on).toHaveBeenCalledWith("interactionCreate", expect.any(Function));
  });

  // ─── Button routing ──────────────────────────────────────────────────────

  it("routes application_apply_ buttons to handleApplicationButtonInteraction", async () => {
    const interaction = makeButtonInteraction("application_apply_flow123");
    await handler(interaction);
    expect(mockHandleApplicationButton).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it("routes role_pick_ buttons to handleRolePickerButtonInteraction", async () => {
    const interaction = makeButtonInteraction("role_pick_group1_role1");
    await handler(interaction);
    expect(mockHandleRolePickerButton).toHaveBeenCalledWith(interaction);
  });

  it("ignores unknown button customIds", async () => {
    const interaction = makeButtonInteraction("unknown_button_id");
    await handler(interaction);
    expect(mockHandleApplicationButton).not.toHaveBeenCalled();
    expect(mockHandleRolePickerButton).not.toHaveBeenCalled();
  });

  it("replies with error when application button handler throws", async () => {
    mockHandleApplicationButton.mockRejectedValue(new Error("fail"));
    const interaction = makeButtonInteraction("application_apply_flow1");
    await handler(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("error") })
    );
  });

  it("replies with error when role picker button handler throws", async () => {
    mockHandleRolePickerButton.mockRejectedValue(new Error("fail"));
    const interaction = makeButtonInteraction("role_pick_g1_r1");
    await handler(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("error") })
    );
  });

  it("does not error-reply when button interaction was already replied", async () => {
    mockHandleApplicationButton.mockRejectedValue(new Error("fail"));
    const interaction = makeButtonInteraction("application_apply_flow1");
    interaction.replied = true;
    await handler(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  // ─── Chat commands ───────────────────────────────────────────────────────

  it("ignores non-button non-chatinput interactions", async () => {
    const interaction = { isButton: () => false, isChatInputCommand: () => false };
    await handler(interaction);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits onInteraction for chat input commands", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    commands.set("ping", { execute });
    handler = captureHandler(commands);

    const interaction = makeChatInputInteraction("ping");
    await handler(interaction);
    expect(mockEmit).toHaveBeenCalledWith(
      "onInteraction",
      expect.objectContaining({ commandName: "ping" })
    );
  });

  it("executes the matching command", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    commands.set("ping", { execute });
    handler = captureHandler(commands);

    const interaction = makeChatInputInteraction("ping");
    await handler(interaction);
    expect(execute).toHaveBeenCalledWith(interaction);
  });

  it("replies with unknown command message when command not found", async () => {
    const interaction = makeChatInputInteraction("nonexistent");
    await handler(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining("nonexistent"),
      })
    );
  });

  it("replies with failure message when command throws", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("oops"));
    commands.set("fail", { execute });
    handler = captureHandler(commands);

    const interaction = makeChatInputInteraction("fail");
    await handler(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: "Command failed." })
    );
  });

  it("does not double-reply when command has already replied", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("oops"));
    commands.set("fail", { execute });
    handler = captureHandler(commands);

    const interaction = makeChatInputInteraction("fail");
    interaction.replied = true;
    await handler(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
