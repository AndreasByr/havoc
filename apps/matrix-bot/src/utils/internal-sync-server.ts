/**
 * Internal HTTP API for the Matrix bot.
 * Exposes the same contract as the Discord bot's internal sync server.
 * This allows the Hub's platformBridge to route requests to either bot transparently.
 */

import crypto from "node:crypto";
import http from "node:http";
import type { MatrixClient } from "matrix-bot-sdk";
import { getSpaceHierarchy } from "./matrix-helpers.js";
import { loadInstalledAppHooks } from "./app-hooks.js";

interface ServerConfig {
  client: MatrixClient;
  spaceId: string | null;
  port: number;
  token: string;
}

type RouteHandler = (
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
) => Promise<unknown>;

export function startInternalSyncServer(config: ServerConfig) {
  const { client, spaceId, port, token } = config;

  const routes: Array<{
    method: string;
    pattern: RegExp;
    paramNames: string[];
    handler: RouteHandler;
  }> = [
    {
      method: "GET",
      pattern: /^\/internal\/health$/,
      paramNames: [],
      handler: handleHealth,
    },
    {
      method: "GET",
      pattern: /^\/internal\/guild\/roles$/,
      paramNames: [],
      handler: handleGetRoles,
    },
    {
      method: "GET",
      pattern: /^\/internal\/guild\/channels\/list$/,
      paramNames: [],
      handler: handleGetChannels,
    },
    {
      method: "GET",
      pattern: /^\/internal\/guild\/members\/([^/]+)$/,
      paramNames: ["memberId"],
      handler: handleGetMember,
    },
    {
      method: "POST",
      pattern: /^\/internal\/sync-user$/,
      paramNames: [],
      handler: handleSyncUser,
    },
    {
      method: "POST",
      pattern: /^\/internal\/reload-hooks$/,
      paramNames: [],
      handler: handleReloadHooks,
    },
  ];

  const server = http.createServer(async (req, res) => {
    // Auth check — fail-loud when token not configured (mirrors Hub's requireInternalToken)
    if (!token || token.length === 0) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Server misconfigured: internal token not set",
          errorCode: "MISCONFIGURED"
        })
      );
      return;
    }
    const authHeader = req.headers.authorization;
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      !timingSafeEqualString(authHeader.slice("Bearer ".length), token)
    ) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
      return;
    }

    const method = req.method || "GET";
    const url = req.url || "/";
    const pathname = url.split("?")[0];

    // Route matching
    for (const route of routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      // Parse body for POST/PATCH
      let body: unknown = null;
      if (method === "POST" || method === "PATCH" || method === "PUT") {
        body = await parseBody(req);
      }

      try {
        const result = await route.handler(client, spaceId, params, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        console.error(`[matrix-bot] ${method} ${pathname} error:`, message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, errorCode: "SYNC_FAILED" }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[matrix-bot] Internal sync server listening on :${port}`);
  });

  return server;
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleHealth(): Promise<unknown> {
  return { ok: true, status: "connected", platform: "matrix" };
}

async function handleGetRoles(
  client: MatrixClient,
  spaceId: string | null
): Promise<unknown> {
  if (!spaceId) return { roles: [] };

  try {
    const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
    const roles = [];
    const users = (powerLevels.users as Record<string, number>) || {};

    // Derive role definitions from power level thresholds
    const levels = new Set<number>([0, 50, 100]);
    Object.values(users).forEach((level) => levels.add(level));

    const sortedLevels = Array.from(levels).sort((a, b) => b - a);
    for (let i = 0; i < sortedLevels.length; i++) {
      const level = sortedLevels[i];
      let name = `Power Level ${level}`;
      if (level === 100) name = "Admin";
      else if (level >= 50) name = "Moderator";
      else if (level === 0) name = "Default";

      roles.push({
        id: `pl_${level}`,
        name,
        position: sortedLevels.length - i,
        managed: false,
        editable: true,
        color: 0,
        unicodeEmoji: null,
      });
    }

    return { roles };
  } catch {
    return { roles: [] };
  }
}

async function handleGetChannels(
  client: MatrixClient,
  spaceId: string | null
): Promise<unknown> {
  if (!spaceId) return { channels: [] };

  try {
    // Get rooms in the space via space hierarchy
    const hierarchy = await getSpaceHierarchy(client, spaceId);
    const channels = hierarchy
      .filter((room: { room_id: string }) => room.room_id !== spaceId)
      .map((room: { room_id: string; name?: string; room_type?: string; canonical_alias?: string }) => ({
        id: room.room_id,
        name: room.name || room.canonical_alias || room.room_id,
        type: room.room_type === "m.space" ? "category" : "text",
        parentId: spaceId,
      }));

    return { channels };
  } catch {
    return { channels: [] };
  }
}

async function handleGetMember(
  client: MatrixClient,
  _spaceId: string | null,
  params: Record<string, string>
): Promise<unknown> {
  const mxid = params.memberId;
  if (!mxid) return { member: null };

  try {
    const profile = await client.getUserProfile(mxid);
    return {
      member: {
        platformUserId: mxid,
        discordId: mxid, // backward compat key
        displayName: profile.displayname || mxid,
        nickname: null,
        avatarUrl: profile.avatar_url || null,
        roleIds: [], // Matrix uses power levels, not discrete roles
      },
    };
  } catch {
    return { member: null };
  }
}

async function handleSyncUser(
  client: MatrixClient,
  spaceId: string | null,
  _params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const payload = body as { discordId?: string; profileName?: string; permissionRoles?: string[] } | null;
  if (!payload?.discordId) {
    return { ok: false, nicknameUpdated: false, nicknameReason: "not_requested" };
  }

  const mxid = payload.discordId; // In Matrix context, this is the MXID

  // Set display name if provided
  if (payload.profileName && spaceId) {
    try {
      // We can't set other users' display names in Matrix directly.
      // Instead, we could set room-level display names, but that's limited.
      // For now, this is a no-op for non-bot users.
    } catch {
      // Ignore
    }
  }

  // Set power levels based on permission roles
  if (payload.permissionRoles && spaceId) {
    try {
      let targetLevel = 0;
      if (payload.permissionRoles.includes("superadmin")) targetLevel = 100;
      else if (payload.permissionRoles.includes("admin")) targetLevel = 100;
      else if (payload.permissionRoles.includes("moderator")) targetLevel = 50;
      else if (payload.permissionRoles.includes("user")) targetLevel = 0;

      const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
      const users = (powerLevels.users as Record<string, number>) || {};
      users[mxid] = targetLevel;
      await client.sendStateEvent(spaceId, "m.room.power_levels", "", { ...powerLevels, users });
    } catch {
      // Power level update failed — may lack permissions
    }
  }

  return { ok: true, nicknameUpdated: false, nicknameReason: "not_requested" };
}

async function handleReloadHooks(client: MatrixClient): Promise<unknown> {
  await loadInstalledAppHooks(client);
  return { ok: true };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : null);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
