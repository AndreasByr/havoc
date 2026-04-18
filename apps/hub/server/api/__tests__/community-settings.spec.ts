/**
 * Tests for community-settings and apps endpoints:
 *   - GET /api/community-settings/display-name-template
 *   - GET /api/apps
 *   - GET /api/apps/navigation
 *   - POST /api/apps/[appId]/activate
 *   - POST /api/apps/[appId]/deactivate
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildSession,
  createMockEvent,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
} from "../../utils/__tests__/test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../utils/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../utils/community-settings", () => ({
  loadDisplayNameTemplate: vi.fn().mockResolvedValue([]),
  loadCommunitySettingsLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("../../utils/apps", () => ({
  buildAppNavigation: vi.fn().mockReturnValue({ rail: [], panelGroups: [] }),
  hasRequiredRoles: vi.fn().mockReturnValue(true),
  setInstalledAppStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/http", () => ({
  requireRouterParam: vi.fn().mockReturnValue("test-app-id"),
}));

vi.mock("../../utils/core-navigation", () => ({
  getLocalizedCoreNavigation: vi.fn().mockReturnValue({ coreRailItems: [], corePanelGroups: [] }),
  resolveNavigationLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("../../utils/landing-access", () => ({
  loadLandingAccessConfig: vi.fn().mockResolvedValue({
    allowModeratorAccess: false,
    allowModeratorAppsAccess: false,
  }),
}));

vi.mock("../../utils/application-access", () => ({
  loadApplicationAccessConfig: vi.fn().mockResolvedValue({
    allowModeratorAccess: false,
  }),
}));

vi.mock("../../utils/membership-settings", () => ({
  loadMembershipSettings: vi.fn().mockResolvedValue({ applicationsRequired: true }),
}));

vi.mock("../../../utils/locale-preference", () => ({
  normalizeUserLocalePreference: vi.fn().mockReturnValue(null),
  readLegacyLocalePreferenceFromCustomFields: vi.fn().mockReturnValue(null),
  resolveEffectiveLocale: vi.fn().mockReturnValue({ locale: "en", source: "default" }),
}));

vi.mock("@guildora/shared", () => ({
  installedApps: {
    id: "id",
    appId: "app_id",
    name: "name",
    version: "version",
    status: "status",
    source: "source",
    verified: "verified",
    repositoryUrl: "repository_url",
    installedAt: "installed_at",
    updatedAt: "updated_at",
  },
  profiles: {
    userId: "user_id",
    localePreference: "locale_preference",
    customFields: "custom_fields",
  },
}));

// ─── Helper: mock DB chain ──────────────────────────────────────────────────

function mockDbChain(returnValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(returnValue);
  return chain;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks = stubNuxtAutoImports();
  vi.stubGlobal("getRouterParam", vi.fn().mockReturnValue("test-app-id"));
  vi.stubGlobal("desc", vi.fn());
  vi.stubGlobal("eq", vi.fn());
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── GET /api/community-settings/display-name-template ──────────────────────

describe("GET /api/community-settings/display-name-template", () => {
  async function importHandler() {
    return (await import("../community-settings/display-name-template.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns display name template for authenticated user (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("displayNameTemplate");
  });
});

// ─── GET /api/apps ───────────────────────────────────────────────────────────

describe("GET /api/apps", () => {
  async function importHandler() {
    return (await import("../apps/index.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns apps list for authenticated user (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "GET" }));
    expect(result).toBeDefined();
    expect(result).toHaveProperty("items");
  });
});

// ─── GET /api/apps/navigation ────────────────────────────────────────────────

describe("GET /api/apps/navigation", () => {
  async function importHandler() {
    return (await import("../apps/navigation.get")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "GET" }))).rejects.toThrow();
  });

  it("returns navigation for authenticated user (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    mocks.useRuntimeConfig.mockReturnValue({ public: { isDev: false }, enableSideloading: false });
    const { getDb } = await import("../../utils/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain([]));
    const handler = await importHandler();
    const event = createMockEvent({ method: "GET" });
    (event as unknown as Record<string, unknown>).context = { installedApps: [] };
    const result = await handler(event);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("rail");
    expect(result).toHaveProperty("panelGroups");
  });
});

// ─── POST /api/apps/[appId]/activate ────────────────────────────────────────

describe("POST /api/apps/[appId]/activate", () => {
  async function importHandler() {
    return (await import("../apps/[appId]/activate.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("requires admin role (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("activates app for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "POST" }));
    expect(result).toEqual({ ok: true });
  });
});

// ─── POST /api/apps/[appId]/deactivate ──────────────────────────────────────

describe("POST /api/apps/[appId]/deactivate", () => {
  async function importHandler() {
    return (await import("../apps/[appId]/deactivate.post")).default;
  }

  it("rejects unauthenticated requests (401)", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("requires admin role (403 for non-admin)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("user"));
    const handler = await importHandler();
    await expect(handler(createMockEvent({ method: "POST" }))).rejects.toThrow();
  });

  it("deactivates app for admin (200)", async () => {
    mocks.requireUserSession.mockResolvedValue(buildSession("admin"));
    const handler = await importHandler();
    const result = await handler(createMockEvent({ method: "POST" }));
    expect(result).toEqual({ ok: true });
  });
});
