import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

async function importSessionMiddleware() {
  const mod = await import("../03-session");
  return mod.default;
}

describe("03-session middleware", () => {
  it("throws 401 for unauthenticated requests to non-public /api/ routes", async () => {
    mocks.getUserSession.mockResolvedValue({});
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/dashboard" });
    await expect(middleware(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("passes through requests to /api/public/", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/public/branding" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/auth/", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/auth/discord" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/csrf-token", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/csrf-token" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/setup/", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/setup/status" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/theme.get", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/theme.get" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/apply/", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/apply/abc123/validate-token" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through requests to /api/internal/", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/internal/branding" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through non-/api/ requests without calling getUserSession", async () => {
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/login" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(mocks.getUserSession).not.toHaveBeenCalled();
  });

  it("passes through authenticated requests to /api/ routes", async () => {
    mocks.getUserSession.mockResolvedValue({ user: { id: "user-123" } });
    const middleware = await importSessionMiddleware();
    const event = createMockEvent({ path: "/api/dashboard" });
    await expect(middleware(event)).resolves.toBeUndefined();
    expect(event.context.userSession).toEqual({ user: { id: "user-123" } });
  });
});
