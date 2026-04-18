import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AppSessionUser } from "../auth";
import {
  buildSessionUser,
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
  type PermissionRole,
} from "./test-helpers";

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

async function importAuth() {
  return import("../auth");
}

// ─── Permission Matrix ──────────────────────────────────────────────────────
//
// Table-driven tests that verify every role × route-group combination.
// Route groups map to the session-level guard functions:
//   - public: no guard (anyone can access)
//   - authenticated: requireSession
//   - moderator: requireModeratorSession (moderator, admin, superadmin)
//   - admin: requireAdminSession (admin, superadmin)
//   - superadmin: requireSuperadminSession (superadmin only)
//   - staff: requireStaffRole (admin, moderator, superadmin)

type RouteGroup = "moderator" | "admin" | "superadmin" | "staff";

const roleAccessMatrix: Record<RouteGroup, Record<PermissionRole, boolean>> = {
  moderator: {
    temporaer: false,
    user: false,
    moderator: true,
    admin: true,
    superadmin: true,
  },
  admin: {
    temporaer: false,
    user: false,
    moderator: false,
    admin: true,
    superadmin: true,
  },
  superadmin: {
    temporaer: false,
    user: false,
    moderator: false,
    admin: false,
    superadmin: true,
  },
  staff: {
    temporaer: false,
    user: false,
    moderator: true,
    admin: true,
    superadmin: true,
  },
};

const roles: PermissionRole[] = ["temporaer", "user", "moderator", "admin", "superadmin"];

// ─── requireRole-based guards (synchronous, using role constants) ───────────

describe("permission matrix — requireRole with role constants", () => {
  describe.each(["moderator", "admin", "superadmin", "staff"] as RouteGroup[])(
    "route group: %s",
    (routeGroup) => {
      it.each(roles)(
        "role '%s' → " + (routeGroup === "moderator" ? "moderatorPermissionRoles" : routeGroup === "admin" ? "adminPermissionRoles" : routeGroup === "superadmin" ? '["superadmin"]' : "staffPermissionRoles"),
        async (role) => {
          const {
            requireRole,
            adminPermissionRoles,
            moderatorPermissionRoles,
            staffPermissionRoles,
          } = await importAuth();

          const user = buildSessionUser(role);
          const expected = roleAccessMatrix[routeGroup][role];

          const rolesForGroup: Record<RouteGroup, readonly string[]> = {
            moderator: moderatorPermissionRoles,
            admin: adminPermissionRoles,
            superadmin: ["superadmin"],
            staff: staffPermissionRoles,
          };

          if (expected) {
            expect(() => requireRole(user, rolesForGroup[routeGroup])).not.toThrow();
          } else {
            expect(() => requireRole(user, rolesForGroup[routeGroup])).toThrow();
          }
        }
      );
    }
  );
});

// ─── Async session guards ───────────────────────────────────────────────────

describe("permission matrix — async session guards", () => {
  describe.each(roles)("role: %s", (role) => {
    it("requireModeratorSession " + (roleAccessMatrix.moderator[role] ? "allows" : "blocks"), async () => {
      const session = { user: buildSessionUser(role), csrfToken: "t" };
      mocks.requireUserSession.mockResolvedValue(session);

      const { requireModeratorSession } = await importAuth();
      const event = { method: "GET", path: "/api/test", context: {} } as unknown as import("h3").H3Event;

      if (roleAccessMatrix.moderator[role]) {
        await expect(requireModeratorSession(event)).resolves.toBeDefined();
      } else {
        await expect(requireModeratorSession(event)).rejects.toThrow();
      }
    });

    it("requireAdminSession " + (roleAccessMatrix.admin[role] ? "allows" : "blocks"), async () => {
      const session = { user: buildSessionUser(role), csrfToken: "t" };
      mocks.requireUserSession.mockResolvedValue(session);

      const { requireAdminSession } = await importAuth();
      const event = { method: "GET", path: "/api/test", context: {} } as unknown as import("h3").H3Event;

      if (roleAccessMatrix.admin[role]) {
        await expect(requireAdminSession(event)).resolves.toBeDefined();
      } else {
        await expect(requireAdminSession(event)).rejects.toThrow();
      }
    });

    it("requireSuperadminSession " + (roleAccessMatrix.superadmin[role] ? "allows" : "blocks"), async () => {
      const session = { user: buildSessionUser(role), csrfToken: "t" };
      mocks.requireUserSession.mockResolvedValue(session);

      const { requireSuperadminSession } = await importAuth();
      const event = { method: "GET", path: "/api/test", context: {} } as unknown as import("h3").H3Event;

      if (roleAccessMatrix.superadmin[role]) {
        await expect(requireSuperadminSession(event)).resolves.toBeDefined();
      } else {
        await expect(requireSuperadminSession(event)).rejects.toThrow();
      }
    });
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("permission matrix — edge cases", () => {
  it("user with multiple roles gets highest access", async () => {
    const { requireRole, adminPermissionRoles } = await importAuth();
    const user = buildSessionUser(["user", "admin"]);
    expect(() => requireRole(user, adminPermissionRoles)).not.toThrow();
  });

  it("legacy roles field is respected when permissionRoles is undefined", async () => {
    const { requireRole, staffPermissionRoles } = await importAuth();
    const user: AppSessionUser = { id: "legacy-user", roles: ["moderator"] };
    expect(() => requireRole(user, staffPermissionRoles)).not.toThrow();
  });

  it("empty permissionRoles array denies all access", async () => {
    const { requireRole, moderatorPermissionRoles } = await importAuth();
    const user: AppSessionUser = { id: "empty", permissionRoles: [] };
    expect(() => requireRole(user, moderatorPermissionRoles)).toThrow();
  });

  it("undefined both roles and permissionRoles denies all access", async () => {
    const { requireRole, adminPermissionRoles } = await importAuth();
    const user: AppSessionUser = { id: "noroles" };
    expect(() => requireRole(user, adminPermissionRoles)).toThrow();
  });

  it("unauthenticated request is rejected before role check", async () => {
    mocks.requireUserSession.mockRejectedValue(new Error("No session"));

    const { requireAdminSession } = await importAuth();
    const event = { method: "GET", path: "/api/test", context: {} } as unknown as import("h3").H3Event;

    try {
      await requireAdminSession(event);
    } catch (e: unknown) {
      // Should be 401, not 403 — auth failure happens before role check
      expect((e as { statusCode?: number }).statusCode).toBe(401);
    }
  });
});
