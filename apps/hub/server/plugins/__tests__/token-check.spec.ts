import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  // Spy on process.exit — throw instead of actually exiting so test runner continues
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit called with code ${code}`);
  });
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  exitSpy.mockRestore();
});

async function loadPlugin() {
  const mod = await import("../00-b-token-check");
  // defineNitroPlugin is stubbed to return its handler directly
  return mod.default;
}

describe("00-b-token-check Nitro plugin", () => {
  it("exits when botInternalToken is empty", async () => {
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalToken: "",
      mcpInternalToken: ""
    });
    const plugin = await loadPlugin();
    expect(() => plugin({})).toThrow("process.exit called with code 1");
  });

  it("exits when botInternalToken is a placeholder", async () => {
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalToken: "replace_with_internal_sync_token",
      mcpInternalToken: ""
    });
    const plugin = await loadPlugin();
    expect(() => plugin({})).toThrow("process.exit called with code 1");
  });

  it("does not exit when botInternalToken is valid and mcpInternalToken is absent", async () => {
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalToken: "a1b2c3d4securetokenvalue",
      mcpInternalToken: ""
    });
    const plugin = await loadPlugin();
    expect(() => plugin({})).not.toThrow();
  });

  it("exits when botInternalToken is valid but mcpInternalToken is a placeholder", async () => {
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalToken: "a1b2c3d4securetokenvalue",
      mcpInternalToken: "changeme"
    });
    const plugin = await loadPlugin();
    expect(() => plugin({})).toThrow("process.exit called with code 1");
  });

  it("does not exit when both tokens are valid", async () => {
    mocks.useRuntimeConfig.mockReturnValue({
      botInternalToken: "a1b2c3d4securetokenvalue",
      mcpInternalToken: "z9y8x7w6validmcptoken"
    });
    const plugin = await loadPlugin();
    expect(() => plugin({})).not.toThrow();
  });
});
