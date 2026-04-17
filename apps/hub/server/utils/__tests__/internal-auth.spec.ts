import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

async function importInternalAuth() {
  return import("../internal-auth");
}

describe("requireInternalToken", () => {
  it("throws 503 when mcpInternalToken is not configured", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "" });

    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();

    expect(() => requireInternalToken(event)).toThrow();
    try {
      requireInternalToken(event);
    } catch (e: any) {
      expect(e.statusCode).toBe(503);
    }
  });

  it("throws 401 when no authorization header is provided", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token" });
    mocks.getHeader.mockReturnValue(undefined);

    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();

    expect(() => requireInternalToken(event)).toThrow();
    try {
      requireInternalToken(event);
    } catch (e: any) {
      expect(e.statusCode).toBe(401);
    }
  });

  it("succeeds with valid Bearer token in Authorization header", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token" });
    mocks.getHeader.mockImplementation((_event: any, name: string) => {
      if (name === "authorization") return "Bearer secret-token";
      return undefined;
    });

    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();

    expect(() => requireInternalToken(event)).not.toThrow();
  });

  it("succeeds with valid x-internal-token header", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token" });
    mocks.getHeader.mockImplementation((_event: any, name: string) => {
      if (name === "authorization") return "";
      if (name === "x-internal-token") return "secret-token";
      return undefined;
    });

    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();

    expect(() => requireInternalToken(event)).not.toThrow();
  });

  it("throws 401 when token does not match", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token" });
    mocks.getHeader.mockImplementation((_event: any, name: string) => {
      if (name === "authorization") return "Bearer wrong-token";
      return undefined;
    });

    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();

    expect(() => requireInternalToken(event)).toThrow();
    try {
      requireInternalToken(event);
    } catch (e: any) {
      expect(e.statusCode).toBe(401);
    }
  });

  it("uses timing-safe comparison (equal-length wrong token still rejected)", async () => {
    mocks.useRuntimeConfig.mockReturnValue({ mcpInternalToken: "secret-token-abc" });
    mocks.getHeader.mockImplementation((_event: any, name: string) => {
      if (name === "authorization") return "Bearer secret-token-xyz"; // same byte length
      return undefined;
    });
    const { requireInternalToken } = await importInternalAuth();
    const event = createMockEvent();
    expect(() => requireInternalToken(event)).toThrow();
    try {
      requireInternalToken(event);
    } catch (e: any) {
      expect(e.statusCode).toBe(401);
    }
  });
});
