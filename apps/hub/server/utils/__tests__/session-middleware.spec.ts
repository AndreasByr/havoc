import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
  buildSession,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

describe("session middleware behavior", () => {
  async function importSessionMiddleware() {
    const mod = await import("../../middleware/03-session");
    return mod.default;
  }

  it("attaches session to event.context when getUserSession succeeds", async () => {
    const session = buildSession("admin");
    mocks.getUserSession.mockResolvedValue(session);

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);

    expect(mocks.getUserSession).toHaveBeenCalledWith(event);
    expect(event.context.userSession).toEqual(session);
  });

  it("sets event.context.userSession to null when session validation fails", async () => {
    mocks.getUserSession.mockRejectedValue(new Error("Session expired"));

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);

    expect(event.context.userSession).toBeNull();
  });

  it("does not throw when getUserSession throws (graceful degradation)", async () => {
    mocks.getUserSession.mockRejectedValue(new Error("Corrupted session cookie"));

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });

    await expect(handler(event)).resolves.not.toThrow();
  });

  it("preserves existing context properties", async () => {
    const session = buildSession("user");
    mocks.getUserSession.mockResolvedValue(session);

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    event.context.existingProp = "keep me";
    await handler(event);

    expect(event.context.existingProp).toBe("keep me");
    expect(event.context.userSession).toEqual(session);
  });

  it("handles empty session object from getUserSession", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);

    expect(event.context.userSession).toEqual({});
  });

  it("handles session with user but no roles", async () => {
    mocks.getUserSession.mockResolvedValue({ user: { id: "u1" } });

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);

    expect(event.context.userSession).toEqual({ user: { id: "u1" } });
  });
});
