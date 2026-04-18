import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AppSessionUser } from "../auth";
import {
  buildSessionUser,
  buildSession,
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

// Re-import after globals are stubbed so the module picks them up
async function importAuth() {
  return import("../auth");
}

// ─── requireRole ────────────────────────────────────────────────────────────

describe("requireRole", () => {
  it("allows a user whose permissionRoles include the required role", async () => {
    const { requireRole } = await importAuth();
    const user = buildSessionUser("admin");
    expect(() => requireRole(user, ["admin"])).not.toThrow();
  });

  it("allows when any of multiple required roles matches", async () => {
    const { requireRole } = await importAuth();
    const user = buildSessionUser("moderator");
    expect(() => requireRole(user, ["admin", "moderator"])).not.toThrow();
  });

  it("throws 403 when user has none of the required roles", async () => {
    const { requireRole } = await importAuth();
    const user = buildSessionUser("user");
    expect(() => requireRole(user, ["admin"])).toThrow();
    try {
      requireRole(user, ["admin"]);
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(403);
    }
  });

  it("throws 403 for empty permissionRoles", async () => {
    const { requireRole } = await importAuth();
    const user: AppSessionUser = { id: "u1", permissionRoles: [] };
    expect(() => requireRole(user, ["admin"])).toThrow();
  });

  it("falls back to legacy roles field when permissionRoles is undefined", async () => {
    const { requireRole } = await importAuth();
    const user: AppSessionUser = { id: "u1", roles: ["admin"] };
    expect(() => requireRole(user, ["admin"])).not.toThrow();
  });

  it("treats undefined permissionRoles AND roles as empty", async () => {
    const { requireRole } = await importAuth();
    const user: AppSessionUser = { id: "u1" };
    expect(() => requireRole(user, ["admin"])).toThrow();
  });

  it("superadmin does NOT pass admin check (strict role matching)", async () => {
    const { requireRole } = await importAuth();
    const user = buildSessionUser("superadmin");
    // superadmin's permissionRoles is ["superadmin"], not ["admin"]
    // requireRole checks includes(), not hierarchy
    expect(() => requireRole(user, ["admin"])).toThrow();
  });

  it("user with multiple roles can access any of them", async () => {
    const { requireRole } = await importAuth();
    const user = buildSessionUser(["admin", "moderator"]);
    expect(() => requireRole(user, ["admin"])).not.toThrow();
    expect(() => requireRole(user, ["moderator"])).not.toThrow();
  });
});

// ─── requireSession ─────────────────────────────────────────────────────────

describe("requireSession", () => {
  it("returns the session when requireUserSession succeeds", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireSession } = await importAuth();
    const event = createMockEvent();
    const result = await requireSession(event);

    expect(result).toEqual(session);
    expect(result.user.id).toBe("test-user-admin");
  });

  it("throws 401 when requireUserSession rejects", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { requireSession } = await importAuth();
    const event = createMockEvent();

    await expect(requireSession(event)).rejects.toThrow();
    try {
      await requireSession(event);
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(401);
    }
  });

  it("throws 401 when session has no user id", async () => {
    mocks.requireUserSession.mockResolvedValue({ user: {} });

    const { requireSession } = await importAuth();
    const event = createMockEvent();

    await expect(requireSession(event)).rejects.toThrow();
    try {
      await requireSession(event);
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(401);
    }
  });

  it("throws 401 when session user is null", async () => {
    mocks.requireUserSession.mockResolvedValue({ user: null });

    const { requireSession } = await importAuth();
    const event = createMockEvent();

    await expect(requireSession(event)).rejects.toThrow();
  });
});

// ─── requireAdminSession ────────────────────────────────────────────────────

describe("requireAdminSession", () => {
  it("returns session for admin user", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireAdminSession } = await importAuth();
    const result = await requireAdminSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("admin");
  });

  it("returns session for superadmin user", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireAdminSession } = await importAuth();
    const result = await requireAdminSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("superadmin");
  });

  it("throws 403 for moderator user", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireAdminSession } = await importAuth();
    await expect(requireAdminSession(createMockEvent())).rejects.toThrow();
  });

  it("throws 403 for regular user", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireAdminSession } = await importAuth();
    await expect(requireAdminSession(createMockEvent())).rejects.toThrow();
  });

  it("throws 401 for unauthenticated request", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { requireAdminSession } = await importAuth();
    await expect(requireAdminSession(createMockEvent())).rejects.toThrow();
    try {
      await requireAdminSession(createMockEvent());
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(401);
    }
  });
});

// ─── requireModeratorSession ────────────────────────────────────────────────

describe("requireModeratorSession", () => {
  it("returns session for moderator user", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireModeratorSession } = await importAuth();
    const result = await requireModeratorSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("moderator");
  });

  it("returns session for admin user", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireModeratorSession } = await importAuth();
    const result = await requireModeratorSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("admin");
  });

  it("returns session for superadmin user", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireModeratorSession } = await importAuth();
    const result = await requireModeratorSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("superadmin");
  });

  it("throws 403 for regular user", async () => {
    const session = buildSession("user");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireModeratorSession } = await importAuth();
    await expect(requireModeratorSession(createMockEvent())).rejects.toThrow();
  });

  it("throws 403 for temporaer user", async () => {
    const session = buildSession("temporaer");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireModeratorSession } = await importAuth();
    await expect(requireModeratorSession(createMockEvent())).rejects.toThrow();
  });
});

// ─── requireSuperadminSession ───────────────────────────────────────────────

describe("requireSuperadminSession", () => {
  it("returns session for superadmin user", async () => {
    const session = buildSession("superadmin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireSuperadminSession } = await importAuth();
    const result = await requireSuperadminSession(createMockEvent());
    expect(result.user.permissionRoles).toContain("superadmin");
  });

  it("throws 403 for admin user (strict — superadmin only)", async () => {
    const session = buildSession("admin");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireSuperadminSession } = await importAuth();
    await expect(requireSuperadminSession(createMockEvent())).rejects.toThrow();
  });

  it("throws 403 for moderator user", async () => {
    const session = buildSession("moderator");
    mocks.requireUserSession.mockResolvedValue(session);

    const { requireSuperadminSession } = await importAuth();
    await expect(requireSuperadminSession(createMockEvent())).rejects.toThrow();
  });
});

// ─── requireStaffRole ───────────────────────────────────────────────────────

describe("requireStaffRole", () => {
  it("allows admin", async () => {
    const { requireStaffRole } = await importAuth();
    expect(() => requireStaffRole(buildSessionUser("admin"))).not.toThrow();
  });

  it("allows moderator", async () => {
    const { requireStaffRole } = await importAuth();
    expect(() => requireStaffRole(buildSessionUser("moderator"))).not.toThrow();
  });

  it("allows superadmin", async () => {
    const { requireStaffRole } = await importAuth();
    expect(() => requireStaffRole(buildSessionUser("superadmin"))).not.toThrow();
  });

  it("throws 403 for regular user", async () => {
    const { requireStaffRole } = await importAuth();
    expect(() => requireStaffRole(buildSessionUser("user"))).toThrow();
  });

  it("throws 403 for temporaer", async () => {
    const { requireStaffRole } = await importAuth();
    expect(() => requireStaffRole(buildSessionUser("temporaer"))).toThrow();
  });
});

// ─── Role constants ─────────────────────────────────────────────────────────

describe("role constants", () => {
  it("adminPermissionRoles includes admin and superadmin", async () => {
    const { adminPermissionRoles } = await importAuth();
    expect(adminPermissionRoles).toContain("admin");
    expect(adminPermissionRoles).toContain("superadmin");
    expect(adminPermissionRoles).not.toContain("moderator");
  });

  it("moderatorPermissionRoles includes moderator, admin, superadmin", async () => {
    const { moderatorPermissionRoles } = await importAuth();
    expect(moderatorPermissionRoles).toContain("moderator");
    expect(moderatorPermissionRoles).toContain("admin");
    expect(moderatorPermissionRoles).toContain("superadmin");
  });

  it("staffPermissionRoles includes admin, moderator, superadmin", async () => {
    const { staffPermissionRoles } = await importAuth();
    expect(staffPermissionRoles).toContain("admin");
    expect(staffPermissionRoles).toContain("moderator");
    expect(staffPermissionRoles).toContain("superadmin");
    expect(staffPermissionRoles).not.toContain("user");
  });
});
