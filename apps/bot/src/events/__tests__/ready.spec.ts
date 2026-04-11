import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockStartLoop = vi.fn();

vi.mock("../../utils/voice-reconcile", () => ({
  startVoiceSessionReconcileLoop: (...args: unknown[]) => mockStartLoop(...args),
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerReadyEvent } from "../ready.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ready event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a once-ready listener", () => {
    const client = { once: vi.fn(), user: { tag: "Bot#1234" } };
    registerReadyEvent(client as any);
    expect(client.once).toHaveBeenCalledWith("ready", expect.any(Function));
  });

  it("starts the voice reconcile loop on ready", () => {
    const client = { once: vi.fn(), user: { tag: "Bot#1234" } };
    registerReadyEvent(client as any);
    const readyHandler = client.once.mock.calls[0][1];
    readyHandler();
    expect(mockStartLoop).toHaveBeenCalledWith(client);
  });

  it("works when client.user is null", () => {
    const client = { once: vi.fn(), user: null };
    registerReadyEvent(client as any);
    const readyHandler = client.once.mock.calls[0][1];
    expect(() => readyHandler()).not.toThrow();
    expect(mockStartLoop).toHaveBeenCalled();
  });
});
