/**
 * Test helpers for Hub server utils.
 * Provides mock H3 events and stubs for Nuxt/Nitro auto-imported functions.
 */

import { vi } from "vitest";
import type { H3Event } from "h3";
import type { AppSession, AppSessionUser } from "../auth";

// ─── Role types ─────────────────────────────────────────────────────────────

export type PermissionRole = "temporaer" | "user" | "moderator" | "admin" | "superadmin";

// ─── Session user factory ───────────────────────────────────────────────────

export function buildSessionUser(
  role: PermissionRole | PermissionRole[],
  overrides?: Partial<AppSessionUser>
): AppSessionUser {
  const roles = Array.isArray(role) ? role : [role];
  return {
    id: overrides?.id ?? `test-user-${roles[0]}`,
    discordId: overrides?.discordId ?? `discord-${roles[0]}`,
    profileName: overrides?.profileName ?? `Test ${roles[0]}`,
    avatarUrl: overrides?.avatarUrl ?? null,
    permissionRoles: roles,
    communityRole: overrides?.communityRole ?? null,
    moderationRights: overrides?.moderationRights ?? {
      modDeleteUsers: false,
      modManageApplications: false,
      modAccessCommunitySettings: false,
      modAccessDesign: false,
      modAccessApps: false,
      modAccessDiscordRoles: false,
    },
  };
}

export function buildSession(
  role: PermissionRole | PermissionRole[],
  overrides?: Partial<AppSession> & { userOverrides?: Partial<AppSessionUser> }
): AppSession {
  return {
    user: buildSessionUser(role, overrides?.userOverrides),
    csrfToken: overrides?.csrfToken ?? "test-csrf-token-abc123",
    originalUserId: overrides?.originalUserId,
  };
}

// ─── Mock H3 Event ──────────────────────────────────────────────────────────

export interface MockEventOptions {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export function createMockEvent(opts: MockEventOptions = {}): H3Event {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    headers[k.toLowerCase()] = v;
  }

  return {
    method: opts.method ?? "GET",
    path: opts.path ?? "/api/test",
    node: {
      req: {
        method: opts.method ?? "GET",
        url: opts.path ?? "/api/test",
        headers,
        socket: { remoteAddress: "127.0.0.1" },
      },
      res: {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        end: vi.fn(),
        statusCode: 200,
      },
    },
    context: {},
    _headers: headers,
    _body: opts.body,
  } as unknown as H3Event;
}

export function createAuthenticatedEvent(
  role: PermissionRole | PermissionRole[],
  opts: MockEventOptions = {}
): { event: H3Event; session: AppSession } {
  const session = buildSession(role);
  const event = createMockEvent(opts);
  return { event, session };
}

// ─── Nitro/Nuxt auto-import stubs ──────────────────────────────────────────

/**
 * Sets up vi.stubGlobal for all Nitro/Nuxt auto-imported functions
 * used by auth.ts, auth-session.ts, internal-auth.ts, and middleware files.
 * Call in beforeEach and reset in afterEach.
 */
export function stubNuxtAutoImports() {
  const mocks = {
    // nuxt-auth-utils
    requireUserSession: vi.fn(),
    getUserSession: vi.fn(),
    replaceUserSession: vi.fn(),

    // h3 auto-imports (those used without explicit import)
    createError: vi.fn((opts: { statusCode: number; statusMessage: string }) => {
      const err = new Error(opts.statusMessage) as Error & {
        statusCode: number;
        statusMessage: string;
      };
      err.statusCode = opts.statusCode;
      err.statusMessage = opts.statusMessage;
      return err;
    }),
    readBody: vi.fn(),
    defineEventHandler: vi.fn((handler: (...args: unknown[]) => unknown) => handler),
    getMethod: vi.fn((event: H3Event) => event.method ?? "GET"),
    getHeader: vi.fn(
      (event: H3Event, name: string) =>
        (event as unknown as { _headers: Record<string, string> })._headers?.[
          name.toLowerCase()
        ] ?? null
    ),
    setResponseHeader: vi.fn(),
    getRequestIP: vi.fn(() => "127.0.0.1"),

    // Nuxt auto-imports
    useRuntimeConfig: vi.fn(() => ({})),
    defineNitroPlugin: vi.fn((handler: (...args: unknown[]) => unknown) => handler),

    // Re-exported from csrf.ts (used in middleware)
    validateCsrfToken: vi.fn(),
  };

  for (const [name, fn] of Object.entries(mocks)) {
    vi.stubGlobal(name, fn);
  }

  return mocks;
}

/**
 * Cleans up all stubbed globals.
 */
export function cleanupAutoImportStubs() {
  vi.unstubAllGlobals();
}
