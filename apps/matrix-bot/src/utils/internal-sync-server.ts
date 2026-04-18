/**
 * Internal HTTP API for the Matrix bot.
 * Exposes the same contract as the Discord bot's internal sync server.
 * This allows the Hub's platformBridge to route requests to either bot transparently.
 */

import crypto from "node:crypto";
import http from "node:http";
import type { MatrixClient } from "matrix-bot-sdk";
import { getSpaceHierarchy } from "./matrix-helpers.js";
import { loadInstalledAppHooks, botAppHookRegistry } from "./app-hooks.js";

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

class SyncServerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = "INVALID_REQUEST"
  ) {
    super(message);
    this.name = "SyncServerError";
  }
}

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
      pattern: /^\/internal\/guild\/roles\/([^/]+)\/members$/,
      paramNames: ["roleId"],
      handler: handleGetRoleMembers,
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
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/add-roles$/,
      paramNames: ["mxid"],
      handler: handleAddRoles,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/remove-roles$/,
      paramNames: ["mxid"],
      handler: handleRemoveRoles,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/sync-community-roles$/,
      paramNames: ["mxid"],
      handler: handleSyncCommunityRoles,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/channels\/([^/]+)\/send$/,
      paramNames: ["channelId"],
      handler: handleChannelSend,
    },
    {
      method: "DELETE",
      pattern: /^\/internal\/guild\/channels\/([^/]+)\/messages\/([^/]+)$/,
      paramNames: ["channelId", "messageId"],
      handler: handleDeleteMessage,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/kick$/,
      paramNames: ["memberId"],
      handler: handleKick,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/ban$/,
      paramNames: ["memberId"],
      handler: handleBan,
    },
    {
      method: "POST",
      pattern: /^\/internal\/guild\/members\/([^/]+)\/dm$/,
      paramNames: ["memberId"],
      handler: handleDm,
    },
  ];

  const server = http.createServer(async (req, res) => {
    // Auth check — fail-loud when token not configured (mirrors Hub's requireInternalToken)
    if (!token || token.length === 0) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          "code": "MISCONFIGURED",
          "message": "Server misconfigured: internal token not set",
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
      res.end(JSON.stringify({ code: "UNAUTHORIZED", message: "Unauthorized", error: "Unauthorized", errorCode: "UNAUTHORIZED" }));
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
        const isClientError = err instanceof SyncServerError;
        const statusCode = isClientError ? err.statusCode : 500;
        const code = isClientError ? err.code : "SYNC_FAILED";
        const message = err instanceof Error ? err.message : "Internal error";
        console.error(`[matrix-bot] ${method} ${pathname} error:`, message);
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code, message, error: message, errorCode: code }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "NOT_FOUND", message: "Not found", error: "Not found", errorCode: "NOT_FOUND" }));
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
      const previousLevel = users[mxid] ?? (powerLevels.users_default as number | undefined) ?? 0;
      users[mxid] = targetLevel;
      await client.sendStateEvent(spaceId, "m.room.power_levels", "", { ...powerLevels, users });

      if (previousLevel !== targetLevel) {
        const addedRoles = targetLevel > previousLevel ? [`pl_${targetLevel}`] : [];
        const removedRoles = [`pl_${previousLevel}`];
        botAppHookRegistry.emit("onRoleChange", {
          guildId: spaceId,
          memberId: mxid,
          addedRoles,
          removedRoles,
          platform: "matrix"
        });
      }
    } catch {
      // Power level update failed — may lack permissions; onRoleChange is intentionally not emitted
    }
  }

  return { ok: true, nicknameUpdated: false, nicknameReason: "not_requested" };
}

async function handleReloadHooks(client: MatrixClient): Promise<unknown> {
  await loadInstalledAppHooks(client);
  return { ok: true };
}

async function handleGetRoleMembers(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>
): Promise<unknown> {
  if (!spaceId) return { members: [] };

  const { roleId } = params;
  const targetLevel = parseVirtualRoleLevel(roleId);
  if (targetLevel === null) {
    throw new SyncServerError(`Invalid virtual role ID: ${roleId}`, 400, "INVALID_ROLE_ID");
  }

  const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
  const users = (powerLevels.users as Record<string, number>) || {};
  const usersDefault = (powerLevels.users_default as number | undefined) ?? 0;

  const allMembers = await client.getJoinedRoomMembers(spaceId);

  const members = allMembers
    .map((mxid: string) => ({ mxid, level: users[mxid] ?? usersDefault }))
    .filter(({ level }: { level: number }) => {
      if (targetLevel === 100) return level === 100;
      if (targetLevel === 50) return level >= 50 && level < 100;
      if (targetLevel === 0) return level < 50;
      return level === targetLevel;
    })
    .map(({ mxid }: { mxid: string }) => ({
      platformUserId: mxid,
      discordId: mxid,
      displayName: mxid,
      nickname: null,
      avatarUrl: null,
      roleIds: [roleId],
    }));

  return { members };
}

async function handleAddRoles(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const payload = body as { roleIds?: unknown } | null;
  const mxid = params.mxid;

  if (!mxid) throw new SyncServerError("Missing mxid parameter", 400, "INVALID_REQUEST");
  if (!spaceId) throw new SyncServerError("No space configured", 400, "INVALID_REQUEST");
  if (!payload?.roleIds || !Array.isArray(payload.roleIds) || payload.roleIds.length === 0) {
    throw new SyncServerError("Missing or empty roleIds", 400, "INVALID_REQUEST");
  }

  const roleIds = payload.roleIds as string[];
  const levels = roleIds.map(parseVirtualRoleLevel);
  if (levels.some((l) => l === null)) {
    throw new SyncServerError(
      `Invalid virtual role ID format in: ${roleIds.join(", ")}`,
      400,
      "INVALID_ROLE_ID"
    );
  }

  const targetLevel = Math.max(...(levels as number[]));

  const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
  const users = (powerLevels.users as Record<string, number>) || {};
  const usersDefault = (powerLevels.users_default as number | undefined) ?? 0;
  const previousLevel = users[mxid] ?? usersDefault;

  const addedRoleIds: string[] = [];
  if (targetLevel > previousLevel) {
    users[mxid] = targetLevel;
    await client.sendStateEvent(spaceId, "m.room.power_levels", "", { ...powerLevels, users });
    addedRoleIds.push(`pl_${targetLevel}`);
    botAppHookRegistry.emit("onRoleChange", {
      guildId: spaceId,
      memberId: mxid,
      addedRoles: addedRoleIds,
      removedRoles: previousLevel > usersDefault ? [`pl_${previousLevel}`] : [],
      platform: "matrix",
    });
  }

  return { ok: true, addedRoleIds };
}

async function handleRemoveRoles(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const payload = body as { roleIds?: unknown; removeAllManageable?: boolean } | null;
  const mxid = params.mxid;

  if (!mxid) throw new SyncServerError("Missing mxid parameter", 400, "INVALID_REQUEST");
  if (!spaceId) throw new SyncServerError("No space configured", 400, "INVALID_REQUEST");

  const hasRoleIds = Array.isArray(payload?.roleIds) && (payload.roleIds as unknown[]).length > 0;
  const hasRemoveAll = payload?.removeAllManageable === true;
  if (!hasRoleIds && !hasRemoveAll) {
    throw new SyncServerError(
      "Missing roleIds or removeAllManageable",
      400,
      "INVALID_REQUEST"
    );
  }

  const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
  const users = (powerLevels.users as Record<string, number>) || {};
  const usersDefault = (powerLevels.users_default as number | undefined) ?? 0;
  const previousLevel = users[mxid] ?? usersDefault;

  const removedRoleIds: string[] = [];
  if (previousLevel !== usersDefault) {
    users[mxid] = usersDefault;
    await client.sendStateEvent(spaceId, "m.room.power_levels", "", { ...powerLevels, users });
    removedRoleIds.push(`pl_${previousLevel}`);
    botAppHookRegistry.emit("onRoleChange", {
      guildId: spaceId,
      memberId: mxid,
      addedRoles: [],
      removedRoles: removedRoleIds,
      platform: "matrix",
    });
  }

  return { ok: true, removedRoleIds };
}

async function handleSyncCommunityRoles(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const payload = body as { allowedRoleIds?: unknown; selectedRoleIds?: unknown } | null;
  const mxid = params.mxid;

  if (!mxid) throw new SyncServerError("Missing mxid parameter", 400, "INVALID_REQUEST");
  if (!spaceId) throw new SyncServerError("No space configured", 400, "INVALID_REQUEST");

  const allowedRoleIds = Array.isArray(payload?.allowedRoleIds)
    ? (payload.allowedRoleIds as string[])
    : [];
  const selectedRoleIds = Array.isArray(payload?.selectedRoleIds)
    ? (payload.selectedRoleIds as string[])
    : [];

  const notAllowed = selectedRoleIds.filter((id) => !allowedRoleIds.includes(id));
  if (notAllowed.length > 0) {
    throw new SyncServerError(
      `selectedRoleIds contains roles not in allowedRoleIds: ${notAllowed.join(", ")}`,
      400,
      "INVALID_REQUEST"
    );
  }

  for (const id of [...allowedRoleIds, ...selectedRoleIds]) {
    if (parseVirtualRoleLevel(id) === null) {
      throw new SyncServerError(`Invalid virtual role ID: ${id}`, 400, "INVALID_ROLE_ID");
    }
  }

  const powerLevels = await client.getRoomStateEvent(spaceId, "m.room.power_levels", "");
  const users = (powerLevels.users as Record<string, number>) || {};
  const usersDefault = (powerLevels.users_default as number | undefined) ?? 0;
  const previousLevel = users[mxid] ?? usersDefault;

  let targetLevel = usersDefault;
  if (selectedRoleIds.length > 0) {
    targetLevel = Math.max(...selectedRoleIds.map((id) => parseVirtualRoleLevel(id) as number));
  }

  const addedRoleIds: string[] = [];
  const removedRoleIds: string[] = [];

  if (previousLevel !== targetLevel) {
    users[mxid] = targetLevel;
    await client.sendStateEvent(spaceId, "m.room.power_levels", "", { ...powerLevels, users });

    if (targetLevel > previousLevel) {
      addedRoleIds.push(`pl_${targetLevel}`);
      if (previousLevel > usersDefault) removedRoleIds.push(`pl_${previousLevel}`);
    } else {
      removedRoleIds.push(`pl_${previousLevel}`);
    }

    botAppHookRegistry.emit("onRoleChange", {
      guildId: spaceId,
      memberId: mxid,
      addedRoles: addedRoleIds,
      removedRoles: removedRoleIds,
      platform: "matrix",
    });
  }

  const currentRoleIds = targetLevel > usersDefault ? [`pl_${targetLevel}`] : [];

  return { ok: true, addedRoleIds, removedRoleIds, currentRoleIds };
}

async function handleChannelSend(
  client: MatrixClient,
  _spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const { channelId } = params;
  const payload = body as { message?: string } | null;
  if (!payload?.message) {
    throw new SyncServerError("Missing message", 400, "INVALID_REQUEST");
  }
  await client.sendMessage(channelId, { msgtype: "m.text", body: payload.message });
  return { ok: true };
}

async function handleDeleteMessage(
  client: MatrixClient,
  _spaceId: string | null,
  params: Record<string, string>
): Promise<unknown> {
  const { channelId, messageId } = params;
  await client.redactEvent(channelId, messageId);
  return { ok: true };
}

async function handleKick(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  if (!spaceId) throw new SyncServerError("No space configured", 400, "SYNC_FAILED");
  const { memberId } = params;
  const payload = body as { reason?: string } | null;
  await client.kickUser(memberId, spaceId, payload?.reason || "Kicked via hub");
  return { ok: true };
}

async function handleBan(
  client: MatrixClient,
  spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  if (!spaceId) throw new SyncServerError("No space configured", 400, "SYNC_FAILED");
  const { memberId } = params;
  const payload = body as { reason?: string; deleteMessageSeconds?: number } | null;
  await client.banUser(memberId, spaceId, payload?.reason || "Banned via hub");
  return { ok: true };
}

async function handleDm(
  client: MatrixClient,
  _spaceId: string | null,
  params: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const { memberId } = params;
  const payload = body as { message?: string } | null;
  if (!payload?.message) {
    throw new SyncServerError("Missing message", 400, "INVALID_REQUEST");
  }
  try {
    const dmRoomId = await client.dms.getOrCreateDm(memberId);
    await client.sendMessage(dmRoomId, { msgtype: "m.text", body: payload.message });
    return { ok: true };
  } catch {
    return { ok: false, reason: "dm_failed" };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseVirtualRoleLevel(roleId: string): number | null {
  const match = roleId.match(/^pl_(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

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
