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

  it("throws 401 when getUserSession throws for non-public path", async () => {
    mocks.getUserSession.mockRejectedValue(new Error("Session expired"));

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when session has no user.id (empty session object)", async () => {
    mocks.getUserSession.mockResolvedValue({});

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("preserves existing context properties for authenticated requests", async () => {
    const session = buildSession("user");
    mocks.getUserSession.mockResolvedValue(session);

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    event.context.existingProp = "keep me";
    await handler(event);

    expect(event.context.existingProp).toBe("keep me");
    expect(event.context.userSession).toEqual(session);
  });

  it("handles session with user but no roles", async () => {
    mocks.getUserSession.mockResolvedValue({ user: { id: "u1" } });

    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/test" });
    await handler(event);

    expect(event.context.userSession).toEqual({ user: { id: "u1" } });
  });

  it("passes through requests to /api/public/ without calling getUserSession", async () => {
    const handler = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/public/branding" });
    await expect(handler(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });
});
