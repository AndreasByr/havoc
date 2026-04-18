/**
 * Session Rotation Structural Verification (F-09)
 *
 * Security Finding F-09: Verify that session rotation after login prevents session fixation.
 *
 * Architecture finding (h3@1.15.11 source, verified 2026-04-17):
 * replaceUserSession(event, data) calls:
 *   1. session.clear()   — deletes event.context.sessions[name], sets cookie to empty string
 *   2. session.update()  — session.id = crypto.randomUUID() (NEW), sealSession → new HMAC blob
 *
 * Since nuxt-auth-utils uses sealed cookie sessions (no server-side session store), the cookie
 * value IS the session. After replaceUserSession(), the old cookie value is no longer valid:
 * the new cookie is a completely different HMAC-sealed blob with a new session.id.
 *
 * Session fixation is structurally impossible: an attacker who captures the old cookie
 * cannot reuse it after login, because the sealed value is invalidated by the new seal.
 *
 * These tests document the architecture and surface regressions if the session
 * replacement logic is accidentally changed to a mutation instead of full replacement.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  stubNuxtAutoImports,
  cleanupAutoImportStubs,
  createMockEvent,
  buildSession
} from "./test-helpers";

// Mock dependencies of auth-session.ts (same mocks as auth-session.spec.ts)
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock("../community", () => ({
  getCommunityRoleName: vi.fn().mockResolvedValue(null),
  getUserRoles: vi.fn().mockResolvedValue(["user"])
}));

vi.mock("../moderation-rights", () => ({
  loadModerationRights: vi.fn().mockResolvedValue({
    modDeleteUsers: false,
    modManageApplications: false,
    modAccessCommunitySettings: false,
    modAccessDesign: false,
    modAccessApps: false,
    modAccessDiscordRoles: false
  }),
  defaultModerationRights: {
    modDeleteUsers: false,
    modManageApplications: false,
    modAccessCommunitySettings: false,
    modAccessDesign: false,
    modAccessApps: false,
    modAccessDiscordRoles: false
  }
}));

vi.mock("@guildora/shared", () => ({
  users: { id: "id" }
}));

let mocks: ReturnType<typeof stubNuxtAutoImports>;

beforeEach(() => {
  mocks = stubNuxtAutoImports();
});

afterEach(() => {
  cleanupAutoImportStubs();
  vi.resetModules();
});

describe("Session rotation (F-09 structural verification)", () => {
  it("replaceUserSession is called during auth session replacement (not mutation)", async () => {
    // replaceAuthSession calls replaceUserSession (not getUserSession + mutate).
    // This ensures the h3 sealed-session replacement path is taken on every login.
    const { replaceAuthSession } = await import("../auth-session");

    const event = createMockEvent();
    const existingSession = buildSession("user", { csrfToken: "csrf-abc-123" });
    mocks.getUserSession.mockResolvedValue(existingSession);
    mocks.replaceUserSession.mockResolvedValue(undefined);

    // Build a minimal user object matching what replaceAuthSession expects
    const newUser = {
      id: "new-user-id",
      discordId: "discord-123",
      profileName: "new_user",
      avatarUrl: null,
      permissionRoles: ["user"],
      roles: ["user"],
      communityRole: null,
      moderationRights: {
        modDeleteUsers: false,
        modManageApplications: false,
        modAccessCommunitySettings: false,
        modAccessDesign: false,
        modAccessApps: false,
        modAccessDiscordRoles: false
      }
    } as unknown as import("../auth").AppSessionUser;

    await replaceAuthSession(event, newUser);

    // Verify replaceUserSession was called (not just getUserSession + merge)
    expect(mocks.replaceUserSession).toHaveBeenCalledOnce();
  });

  it("replaceAuthSession preserves csrfToken from existing session (prevents CSRF failure after login)", async () => {
    // Pitfall 5 from RESEARCH.md: after session replacement, the new session must carry
    // the existing csrfToken, otherwise all state-changing requests after login fail with 403.
    // replaceAuthSession reads existingSession.csrfToken and includes it in the new session data.
    const { replaceAuthSession } = await import("../auth-session");

    const event = createMockEvent();
    const existingSession = buildSession("user", { csrfToken: "csrf-preserved-token" });
    mocks.getUserSession.mockResolvedValue(existingSession);
    mocks.replaceUserSession.mockResolvedValue(undefined);

    const newUser = {
      id: "new-user-id",
      discordId: "discord-456",
      profileName: "another_user",
      avatarUrl: null,
      permissionRoles: ["moderator"],
      roles: ["moderator"],
      communityRole: null,
      moderationRights: {
        modDeleteUsers: false,
        modManageApplications: false,
        modAccessCommunitySettings: false,
        modAccessDesign: false,
        modAccessApps: false,
        modAccessDiscordRoles: false
      }
    } as unknown as import("../auth").AppSessionUser;

    await replaceAuthSession(event, newUser);

    // The new session passed to replaceUserSession must include the csrfToken
    const callArg = mocks.replaceUserSession.mock.calls[0][1] as Record<string, unknown>;
    expect(callArg.csrfToken).toBe("csrf-preserved-token");
  });
});
