import crypto from "node:crypto";
import { createServer } from "node:http";
import { ChannelType, type GuildChannelTypes, Collection, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from "discord.js";
import { eq } from "drizzle-orm";
import { installedApps, safeParseAppManifest, applicationTokens } from "@guildora/shared";
import type { BotCommand } from "../types";
import { setupCommand } from "../commands/setup";
import { getDb } from "./db";
import { botAppHookRegistry, loadInstalledAppHooks } from "./app-hooks";
import { getUserProfileByDiscordId } from "./community";
import { logger } from "./logger";
import { signTokenId } from "./application-tokens";

type SyncPayload = {
  discordId?: string;
  profileName?: string | null;
  permissionRoles?: string[];
};

type RemoveRolesPayload = {
  roleIds?: string[];
  removeAllManageable?: boolean;
};

type SyncCommunityRolesPayload = {
  allowedRoleIds?: string[];
  selectedRoleIds?: string[];
};

type BotGuildMemberPayload = {
  discordId: string;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  roleIds: string[];
};

type SyncUserResult = {
  nicknameUpdated: boolean;
  nicknameReason: "not_requested" | "missing_permissions" | "member_not_manageable" | "nickname_too_long" | null;
  appliedNickname: string | null;
};

const maxRequestBodyBytes = 64 * 1024;

/** TTL in ms: avoid repeated guild.members.fetch() to prevent Discord Gateway rate limit (opcode 8). */
const GUILD_MEMBERS_CACHE_TTL_MS = 35_000;

const lastGuildMembersFetchTime = new Map<string, number>();

function readBody(req: import("node:http").IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      const buffer = Buffer.from(chunk);
      totalBytes += chunk.length;
      if (totalBytes > maxRequestBodyBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidAuthorization(headers: import("node:http").IncomingHttpHeaders) {
  const configuredToken = process.env.BOT_INTERNAL_TOKEN;
  if (!configuredToken) {
    return false;
  }
  const authorization = headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const incomingToken = authorization.slice("Bearer ".length);
  return timingSafeEqualString(incomingToken, configuredToken);
}

function json(res: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

type InternalSyncErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_JSON_BODY"
  | "MISSING_DISCORD_ID"
  | "MISSING_ROLE_ID"
  | "MISSING_ROLE_IDS"
  | "MISSING_CHANNEL_ID"
  | "MISSING_MESSAGE_ID"
  | "MISSING_FLOW_ID"
  | "MISSING_MESSAGE"
  | "MISSING_NICKNAME"
  | "INVALID_SELECTED_ROLE_IDS"
  | "NON_EDITABLE_ALLOWED_ROLES"
  | "NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "REQUEST_BODY_TOO_LARGE"
  | "SYNC_FAILED";

function jsonError(
  res: import("node:http").ServerResponse,
  statusCode: number,
  errorCode: InternalSyncErrorCode,
  error: string,
  extra: Record<string, unknown> = {}
) {
  json(res, statusCode, {
    ok: false,
    errorCode,
    error,
    ...extra
  });
}

function toMemberPayload(member: import("discord.js").GuildMember): BotGuildMemberPayload {
  return {
    discordId: member.user.id,
    displayName: member.displayName || member.user.globalName || member.user.username,
    nickname: member.nickname,
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 256 }) || null,
    roleIds: member.roles.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id)
  };
}

function parseRoleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function isMissingPermissionsError(error: unknown) {
  const maybe = error as { code?: unknown; status?: unknown };
  return maybe?.code === 50013 || maybe?.status === 403;
}

async function getGuild(client: Client, guildId: string) {
  const guild = await client.guilds.fetch(guildId);
  await guild.roles.fetch();
  return guild;
}

function buildRolePickerEmbedAndButtons(
  groupId: string,
  title: string,
  description: string | undefined,
  color: string | undefined,
  roles: Array<{ discordRoleId: string; emoji: string | null; roleName: string }>
) {
  const roleLines = roles.map((r) => {
    const emoji = r.emoji ? `${r.emoji} ` : "";
    return `${emoji}**${r.roleName}**`;
  });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ? `${description}\n\n${roleLines.join("\n")}` : roleLines.join("\n"))
    .setColor(color ? (parseInt(color.replace("#", ""), 16) || 0x7C3AED) : 0x7C3AED);

  // Discord allows max 5 buttons per row, max 5 rows = 25 buttons
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < roles.length && components.length < 5; i += 5) {
    const chunk = roles.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const role of chunk) {
      const btn = new ButtonBuilder()
        .setCustomId(`role_pick_${groupId}_${role.discordRoleId}`)
        .setLabel(role.roleName)
        .setStyle(ButtonStyle.Secondary);
      if (role.emoji) {
        try { btn.setEmoji(role.emoji); } catch { /* skip invalid emoji */ }
      }
      row.addComponents(btn);
    }
    components.push(row);
  }

  return { embeds: [embed], components };
}

export async function loadAndDeployAppCommands(commands: Collection<string, BotCommand>) {
  const db = getDb();
  const rows = await db.select().from(installedApps).where(eq(installedApps.status, "active"));

  commands.clear();
  commands.set(setupCommand.data.name, setupCommand);

  for (const row of rows) {
    const parsed = safeParseAppManifest(row.manifest);
    if (!parsed.success) continue;
    for (const cmd of parsed.data.botCommands ?? []) {
      const builder = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description);
      if (cmd.nameLocalizations) builder.setNameLocalizations(cmd.nameLocalizations);
      if (cmd.descriptionLocalizations) builder.setDescriptionLocalizations(cmd.descriptionLocalizations);
      commands.set(cmd.name, {
        data: builder,
        execute: async (interaction) => {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ ephemeral: true, content: `/${cmd.name}` });
          }
        }
      });
    }
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (token && clientId && guildId) {
    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [...commands.values()].map((c) => c.data.toJSON())
    });
    logger.info(`Deployed ${commands.size} slash command(s) to Discord.`);
  }

  return commands.size;
}

export function startInternalSyncServer(client: Client, commands: Collection<string, BotCommand>) {
  const portValue = process.env.BOT_INTERNAL_PORT || "3050";
  const port = Number.parseInt(portValue, 10);
  if (!Number.isFinite(port) || port <= 0) {
    logger.warn("BOT_INTERNAL_PORT is invalid. Internal sync server is disabled.");
    return;
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    logger.warn("DISCORD_GUILD_ID is missing. Internal sync server is disabled.");
    return;
  }

  const token = process.env.BOT_INTERNAL_TOKEN;
  if (!token) {
    logger.warn("BOT_INTERNAL_TOKEN is not set. Internal sync server is disabled for security.");
    return;
  }

  const server = createServer(async (req, res) => {
    if (!hasValidAuthorization(req.headers)) {
      jsonError(res, 401, "UNAUTHORIZED", "Unauthorized");
      return;
    }

    const method = req.method || "GET";
    const rawUrl = req.url || "/";
    const requestUrl = new URL(rawUrl, "http://internal.bot");
    const pathname = requestUrl.pathname;
    const requestStart = Date.now();

    try {
      if (method === "POST" && pathname === "/internal/sync-user") {
        const bodyRaw = await readBody(req);
        let body: SyncPayload = {};
        if (bodyRaw) {
          try {
            body = JSON.parse(bodyRaw) as SyncPayload;
          } catch {
            jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body");
            return;
          }
        }
        if (!body.discordId) {
          jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discordId");
          return;
        }

        const guild = await getGuild(client, guildId);
        const member = await guild.members.fetch(body.discordId);
        const syncResult: SyncUserResult = {
          nicknameUpdated: false,
          nicknameReason: "not_requested",
          appliedNickname: member.nickname
        };

        if (Object.prototype.hasOwnProperty.call(body, "profileName")) {
          const requestedNickname = body.profileName || null;
          const nicknameLength = requestedNickname?.length ?? 0;
          if (!member.manageable) {
            syncResult.nicknameUpdated = false;
            syncResult.nicknameReason = "member_not_manageable";
          } else if (nicknameLength > 32) {
            syncResult.nicknameUpdated = false;
            syncResult.nicknameReason = "nickname_too_long";
          } else {
            try {
              await member.setNickname(requestedNickname);
              syncResult.nicknameUpdated = true;
              syncResult.nicknameReason = null;
              syncResult.appliedNickname = requestedNickname;
            } catch (error) {
              if (isMissingPermissionsError(error)) {
                syncResult.nicknameUpdated = false;
                syncResult.nicknameReason = "missing_permissions";
              } else {
                throw error;
              }
            }
          }
        }

        if (Array.isArray(body.permissionRoles) && body.permissionRoles.length > 0) {
          const manageableRoleNames = ["temporaer", "user", "moderator", "admin"];
          const roleMap = new Map(guild.roles.cache.map((role) => [role.name.toLowerCase(), role.id]));

          const toRemove = member.roles.cache
            .filter((role) => manageableRoleNames.includes(role.name.toLowerCase()))
            .map((role) => role.id);
          if (toRemove.length > 0) {
            await member.roles.remove(toRemove);
          }

          const toAdd = body.permissionRoles
            .map((roleName) => roleMap.get(roleName.toLowerCase()))
            .filter((roleId): roleId is string => Boolean(roleId));
          if (toAdd.length > 0) {
            await member.roles.add(toAdd);
          }

          await botAppHookRegistry.emit("onRoleChange", {
            guildId: guild.id,
            memberId: member.user.id,
            addedRoles: toAdd,
            removedRoles: toRemove
          });
        }

        json(res, 200, {
          ok: true,
          ...syncResult
        });
        return;
      }

      if (method === "GET" && pathname === "/internal/guild/roles") {
        const guild = await getGuild(client, guildId);
        const roles = guild.roles.cache
          .filter((role) => role.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map((role) => ({
            id: role.id,
            name: role.name,
            position: role.position,
            managed: role.managed,
            editable: role.editable,
            color: role.color,
            unicodeEmoji: role.unicodeEmoji ?? null
          }));

        json(res, 200, { roles });
        return;
      }

      const roleMembersMatch = pathname.match(/^\/internal\/guild\/roles\/([^/]+)\/members$/);
      if (method === "GET" && roleMembersMatch) {
        const roleId = decodeURIComponent(roleMembersMatch[1] || "");
        if (!roleId) {
          jsonError(res, 400, "MISSING_ROLE_ID", "Missing role id");
          return;
        }

        const guild = await getGuild(client, guildId);
        const lastFetch = lastGuildMembersFetchTime.get(guildId) ?? 0;
        if (Date.now() - lastFetch > GUILD_MEMBERS_CACHE_TTL_MS) {
          await guild.members.fetch();
          lastGuildMembersFetchTime.set(guildId, Date.now());
        }
        const members = guild.members.cache
          .filter((member) => member.roles.cache.has(roleId))
          .map((member) => toMemberPayload(member));
        json(res, 200, { members });
        return;
      }

      const memberMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)$/);
      if (method === "GET" && memberMatch) {
        const discordId = decodeURIComponent(memberMatch[1] || "");
        if (!discordId) {
          jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id");
          return;
        }

        const guild = await getGuild(client, guildId);
        try {
          const member = await guild.members.fetch(discordId);
          json(res, 200, { member: toMemberPayload(member) });
        } catch {
          json(res, 200, { member: null });
        }
        return;
      }

      // GET /internal/guild/members/:discordId/permission-roles
      const permissionRolesMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/permission-roles$/);
      if (method === "GET" && permissionRolesMatch) {
        const discordId = decodeURIComponent(permissionRolesMatch[1] || "");
        if (!discordId) {
          jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id");
          return;
        }

        const roleLevels: Record<string, number> = {
          temporaer: 0, user: 10, moderator: 50, admin: 80, superadmin: 100
        };

        try {
          const profile = await getUserProfileByDiscordId(discordId);
          if (!profile) {
            json(res, 200, { permissionRoles: [], highestRole: null });
            return;
          }

          const roles = profile.roles || [];
          let highestRole: string | null = null;
          let highestLevel = -1;
          for (const r of roles) {
            const level = roleLevels[r] ?? -1;
            if (level > highestLevel) {
              highestRole = r;
              highestLevel = level;
            }
          }

          json(res, 200, { permissionRoles: roles, highestRole });
        } catch {
          json(res, 200, { permissionRoles: [], highestRole: null });
        }
        return;
      }

      const syncCommunityRolesMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/sync-community-roles$/);
      if (method === "POST" && syncCommunityRolesMatch) {
        const discordId = decodeURIComponent(syncCommunityRolesMatch[1] || "");
        if (!discordId) {
          jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id");
          return;
        }

        const bodyRaw = await readBody(req);
        let body: SyncCommunityRolesPayload = {};
        if (bodyRaw) {
          try {
            body = JSON.parse(bodyRaw) as SyncCommunityRolesPayload;
          } catch {
            jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body");
            return;
          }
        }

        const allowedRoleIds = parseRoleIds(body.allowedRoleIds);
        const selectedRoleIds = parseRoleIds(body.selectedRoleIds);
        const allowedSet = new Set(allowedRoleIds);
        const selectedSet = new Set(selectedRoleIds);

        for (const selectedRoleId of selectedSet) {
          if (!allowedSet.has(selectedRoleId)) {
            jsonError(res, 400, "INVALID_SELECTED_ROLE_IDS", "selectedRoleIds must be a subset of allowedRoleIds");
            return;
          }
        }

        const guild = await getGuild(client, guildId);
        const member = await guild.members.fetch(discordId);

        const invalidAllowedRoleIds = allowedRoleIds.filter((roleId) => {
          const role = guild.roles.cache.get(roleId);
          return !role || !role.editable || role.managed || role.id === guild.id;
        });
        if (invalidAllowedRoleIds.length > 0) {
          jsonError(
            res,
            400,
            "NON_EDITABLE_ALLOWED_ROLES",
            "allowedRoleIds contains non-editable roles",
            { invalidRoleIds: invalidAllowedRoleIds }
          );
          return;
        }

        const toRemove = member.roles.cache
          .filter((role) => allowedSet.has(role.id))
          .filter((role) => !selectedSet.has(role.id))
          .map((role) => role.id);

        const toAdd = selectedRoleIds
          .filter((roleId) => !member.roles.cache.has(roleId));

        if (toRemove.length > 0) {
          await member.roles.remove(toRemove);
        }
        if (toAdd.length > 0) {
          await member.roles.add(toAdd);
        }

        if (toAdd.length > 0 || toRemove.length > 0) {
          await botAppHookRegistry.emit("onRoleChange", {
            guildId: guild.id,
            memberId: member.user.id,
            addedRoles: toAdd,
            removedRoles: toRemove
          });
        }

        const refreshedMember = await guild.members.fetch(discordId);
        json(res, 200, {
          ok: true,
          addedRoleIds: toAdd,
          removedRoleIds: toRemove,
          currentRoleIds: toMemberPayload(refreshedMember).roleIds
        });
        return;
      }

      const removeRolesMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/remove-roles$/);
      if (method === "POST" && removeRolesMatch) {
        const discordId = decodeURIComponent(removeRolesMatch[1] || "");
        if (!discordId) {
          jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id");
          return;
        }

        const bodyRaw = await readBody(req);
        let body: RemoveRolesPayload = {};
        if (bodyRaw) {
          try {
            body = JSON.parse(bodyRaw) as RemoveRolesPayload;
          } catch {
            jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body");
            return;
          }
        }

        const requestedRoleIds = parseRoleIds(body.roleIds);
        const removeAllManageable = body.removeAllManageable === true;
        if (!removeAllManageable && requestedRoleIds.length === 0) {
          jsonError(res, 400, "MISSING_ROLE_IDS", "Missing roleIds");
          return;
        }

        const guild = await getGuild(client, guildId);
        const member = await guild.members.fetch(discordId);
        const requestedSet = new Set(requestedRoleIds);

        const removableRoleIds = member.roles.cache
          .filter((role) => role.id !== guild.id)
          .filter((role) => role.editable && !role.managed)
          .filter((role) => removeAllManageable || requestedSet.has(role.id))
          .map((role) => role.id);

        if (removableRoleIds.length > 0) {
          await member.roles.remove(removableRoleIds);
          await botAppHookRegistry.emit("onRoleChange", {
            guildId: guild.id,
            memberId: member.user.id,
            addedRoles: [],
            removedRoles: removableRoleIds
          });
        }

        json(res, 200, { ok: true, removedRoleIds: removableRoleIds });
        return;
      }

      if (method === "POST" && pathname === "/internal/sync-commands") {
        const deployedCount = await loadAndDeployAppCommands(commands);
        json(res, 200, { ok: true, deployedCount });
        return;
      }

      if (method === "POST" && pathname === "/internal/reload-hooks") {
        await loadInstalledAppHooks(client);
        logger.info("App hooks reloaded via internal sync.");
        json(res, 200, { ok: true });
        return;
      }

      // ─── Application Flow Endpoints ─────────────────────────────────

      // POST /internal/applications/embed — post embed with button
      if (method === "POST" && pathname === "/internal/applications/embed") {
        const bodyRaw = await readBody(req);
        let body: { flowId?: string; channelId?: string; description?: string; buttonLabel?: string; color?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.flowId) { jsonError(res, 400, "MISSING_FLOW_ID", "Missing flowId"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (!channel || !("send" in channel)) { jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found or not text-based"); return; }

        const embed = new EmbedBuilder()
          .setDescription(body.description || "Click the button below to apply.")
          .setColor(body.color ? (parseInt(body.color.replace("#", ""), 16) || 0x7C3AED) : 0x7C3AED);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`application_apply_${body.flowId}`)
            .setLabel(body.buttonLabel || "Apply")
            .setStyle(ButtonStyle.Primary)
        );

        const message = await (channel as { send: Function }).send({ embeds: [embed], components: [row] });
        json(res, 200, { ok: true, messageId: (message as { id: string }).id });
        return;
      }

      // PATCH /internal/applications/embed — update existing embed
      if (method === "PATCH" && pathname === "/internal/applications/embed") {
        const bodyRaw = await readBody(req);
        let body: { channelId?: string; messageId?: string; flowId?: string; description?: string; buttonLabel?: string; color?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.messageId) { jsonError(res, 400, "MISSING_MESSAGE_ID", "Missing messageId"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (!channel || !("messages" in channel)) { jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found"); return; }

        const ch = channel as { messages: { fetch: Function } };
        const msg = await ch.messages.fetch(body.messageId).catch(() => null);
        if (!msg || !("edit" in msg)) { jsonError(res, 404, "NOT_FOUND", "Message not found"); return; }

        const embed = new EmbedBuilder()
          .setDescription(body.description || "Click the button below to apply.")
          .setColor(body.color ? (parseInt(body.color.replace("#", ""), 16) || 0x7C3AED) : 0x7C3AED);

        const editPayload: { embeds: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder>[] } = { embeds: [embed] };

        if (body.flowId) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`application_apply_${body.flowId}`)
              .setLabel(body.buttonLabel || "Apply")
              .setStyle(ButtonStyle.Primary)
          );
          editPayload.components = [row];
        }

        await (msg as { edit: Function }).edit(editPayload);
        json(res, 200, { ok: true });
        return;
      }

      // DELETE /internal/applications/embed — delete embed message
      if (method === "DELETE" && pathname === "/internal/applications/embed") {
        const bodyRaw = await readBody(req);
        let body: { channelId?: string; messageId?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.messageId) { jsonError(res, 400, "MISSING_MESSAGE_ID", "Missing messageId"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (channel && "messages" in channel) {
          const ch = channel as { messages: { fetch: Function } };
          const msg = await ch.messages.fetch(body.messageId).catch(() => null);
          if (msg && "delete" in msg) {
            await (msg as { delete: Function }).delete().catch(() => {});
          }
        }

        json(res, 200, { ok: true });
        return;
      }

      // ─── Role Picker Embed Endpoints ──────────────────────────────

      // POST /internal/role-picker/embed — post role picker embed with buttons
      if (method === "POST" && pathname === "/internal/role-picker/embed") {
        const bodyRaw = await readBody(req);
        let body: { groupId?: string; channelId?: string; title?: string; description?: string; color?: string; roles?: Array<{ discordRoleId: string; emoji: string | null; roleName: string }> } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.groupId) { jsonError(res, 400, "INVALID_JSON_BODY", "Missing groupId"); return; }
        if (!body.roles || body.roles.length === 0) { jsonError(res, 400, "INVALID_JSON_BODY", "Missing roles"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (!channel || !("send" in channel)) { jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found or not text-based"); return; }

        const { embeds, components } = buildRolePickerEmbedAndButtons(body.groupId, body.title || "Role Selection", body.description, body.color, body.roles);
        const message = await (channel as { send: Function }).send({ embeds, components });
        json(res, 200, { ok: true, messageId: (message as { id: string }).id });
        return;
      }

      // PATCH /internal/role-picker/embed — update existing role picker embed
      if (method === "PATCH" && pathname === "/internal/role-picker/embed") {
        const bodyRaw = await readBody(req);
        let body: { channelId?: string; messageId?: string; groupId?: string; title?: string; description?: string; color?: string; roles?: Array<{ discordRoleId: string; emoji: string | null; roleName: string }> } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.messageId) { jsonError(res, 400, "MISSING_MESSAGE_ID", "Missing messageId"); return; }
        if (!body.groupId) { jsonError(res, 400, "INVALID_JSON_BODY", "Missing groupId"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (!channel || !("messages" in channel)) { jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found"); return; }

        const ch = channel as { messages: { fetch: Function } };
        const msg = await ch.messages.fetch(body.messageId).catch(() => null);
        if (!msg || !("edit" in msg)) { jsonError(res, 404, "NOT_FOUND", "Message not found"); return; }

        const { embeds, components } = buildRolePickerEmbedAndButtons(body.groupId, body.title || "Role Selection", body.description, body.color, body.roles || []);
        await (msg as { edit: Function }).edit({ embeds, components });
        json(res, 200, { ok: true });
        return;
      }

      // DELETE /internal/role-picker/embed — delete role picker embed
      if (method === "DELETE" && pathname === "/internal/role-picker/embed") {
        const bodyRaw = await readBody(req);
        let body: { channelId?: string; messageId?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channelId"); return; }
        if (!body.messageId) { jsonError(res, 400, "MISSING_MESSAGE_ID", "Missing messageId"); return; }

        const channel = await client.channels.fetch(body.channelId).catch(() => null);
        if (channel && "messages" in channel) {
          const ch = channel as { messages: { fetch: Function } };
          const msg = await ch.messages.fetch(body.messageId).catch(() => null);
          if (msg && "delete" in msg) {
            await (msg as { delete: Function }).delete().catch(() => {});
          }
        }

        json(res, 200, { ok: true });
        return;
      }

      // POST /internal/applications/token — create DB-backed token
      if (method === "POST" && pathname === "/internal/applications/token") {
        const bodyRaw = await readBody(req);
        let body: { flowId?: string; discordId?: string; discordUsername?: string; discordAvatarUrl?: string; expiryMinutes?: number } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.flowId) { jsonError(res, 400, "MISSING_FLOW_ID", "Missing flowId"); return; }
        if (!body.discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discordId"); return; }

        const db = getDb();
        const expiryMinutes = body.expiryMinutes || 60;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        const tokenSecret = process.env.APPLICATION_TOKEN_SECRET;
        if (!tokenSecret) {
          jsonError(res, 500, "SYNC_FAILED", "APPLICATION_TOKEN_SECRET not configured");
          return;
        }

        const tokenId = crypto.randomUUID();
        const signedToken = signTokenId(tokenId, expiresAt, tokenSecret);

        await db.insert(applicationTokens).values({
          id: tokenId,
          flowId: body.flowId,
          discordId: body.discordId,
          discordUsername: body.discordUsername || "Unknown",
          discordAvatarUrl: body.discordAvatarUrl || null,
          token: signedToken,
          expiresAt
        });

        json(res, 200, { ok: true, tokenId, signedToken, expiresAt: expiresAt.toISOString() });
        return;
      }

      // POST /internal/guild/members/:discordId/add-roles
      const addRolesMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/add-roles$/);
      if (method === "POST" && addRolesMatch) {
        const discordId = decodeURIComponent(addRolesMatch[1] || "");
        if (!discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id"); return; }

        const bodyRaw = await readBody(req);
        let body: { roleIds?: string[] } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        const roleIds = parseRoleIds(body.roleIds);
        if (roleIds.length === 0) { jsonError(res, 400, "MISSING_ROLE_IDS", "Missing roleIds"); return; }

        const guild = await getGuild(client, guildId);
        const member = await guild.members.fetch(discordId);

        const validRoleIds = roleIds.filter((roleId) => {
          if (member.roles.cache.has(roleId)) return false;
          const role = guild.roles.cache.get(roleId);
          return role && role.editable && !role.managed;
        });

        if (validRoleIds.length > 0) {
          await member.roles.add(validRoleIds);
        }
        const addedRoleIds = validRoleIds;

        if (addedRoleIds.length > 0) {
          await botAppHookRegistry.emit("onRoleChange", {
            guildId: guild.id,
            memberId: member.user.id,
            addedRoles: addedRoleIds,
            removedRoles: []
          });
        }

        json(res, 200, { ok: true, addedRoleIds });
        return;
      }

      // POST /internal/guild/members/:discordId/set-nickname
      const setNicknameMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/set-nickname$/);
      if (method === "POST" && setNicknameMatch) {
        const discordId = decodeURIComponent(setNicknameMatch[1] || "");
        if (!discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id"); return; }

        const bodyRaw = await readBody(req);
        let body: { nickname?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.nickname) { jsonError(res, 400, "MISSING_NICKNAME", "Missing nickname"); return; }

        const guild = await getGuild(client, guildId);
        const member = await guild.members.fetch(discordId);

        if (!member.manageable) {
          json(res, 200, { ok: false, reason: "member_not_manageable" });
          return;
        }

        const nickname = body.nickname.slice(0, 32);
        await member.setNickname(nickname);
        json(res, 200, { ok: true, appliedNickname: nickname });
        return;
      }

      // POST /internal/guild/members/:discordId/dm
      const dmMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/dm$/);
      if (method === "POST" && dmMatch) {
        const discordId = decodeURIComponent(dmMatch[1] || "");
        if (!discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id"); return; }

        const bodyRaw = await readBody(req);
        let body: { message?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.message) { jsonError(res, 400, "MISSING_MESSAGE", "Missing message"); return; }

        try {
          const user = await client.users.fetch(discordId);
          await user.send(body.message);
          json(res, 200, { ok: true });
        } catch (error) {
          logger.warn(`Failed to send DM to ${discordId}:`, error);
          json(res, 200, { ok: false, reason: "dm_failed" });
        }
        return;
      }

      // POST /internal/guild/channels/:channelId/send
      const channelSendMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)\/send$/);
      if (method === "POST" && channelSendMatch) {
        const channelId = decodeURIComponent(channelSendMatch[1] || "");
        if (!channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel id"); return; }

        const bodyRaw = await readBody(req);
        let body: { message?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.message) { jsonError(res, 400, "MISSING_MESSAGE", "Missing message"); return; }

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !("send" in channel)) {
          jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found or not text-based");
          return;
        }

        await (channel as { send: Function }).send(body.message);
        json(res, 200, { ok: true });
        return;
      }

      // ─── GuildAI Action Endpoints ──────────────────────────────────

      // POST /internal/guild/members/:discordId/kick
      const kickMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/kick$/);
      if (method === "POST" && kickMatch) {
        const discordId = decodeURIComponent(kickMatch[1] || "");
        if (!discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id"); return; }

        const bodyRaw = await readBody(req);
        let body: { reason?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { /* no body is ok */ }

        const guild = await getGuild(client, guildId);
        try {
          const member = await guild.members.fetch(discordId);
          if (!member.kickable) {
            jsonError(res, 400, "SYNC_FAILED", "Member is not kickable (higher role or bot owner)");
            return;
          }
          await member.kick(body.reason || "Kicked via GuildAI");
          json(res, 200, { ok: true });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to kick this member");
          } else {
            throw error;
          }
        }
        return;
      }

      // POST /internal/guild/members/:discordId/ban
      const banMatch = pathname.match(/^\/internal\/guild\/members\/([^/]+)\/ban$/);
      if (method === "POST" && banMatch) {
        const discordId = decodeURIComponent(banMatch[1] || "");
        if (!discordId) { jsonError(res, 400, "MISSING_DISCORD_ID", "Missing discord id"); return; }

        const bodyRaw = await readBody(req);
        let body: { reason?: string; deleteMessageSeconds?: number } = {};
        try { body = JSON.parse(bodyRaw); } catch { /* no body is ok */ }

        const guild = await getGuild(client, guildId);
        try {
          const member = await guild.members.fetch(discordId);
          if (!member.bannable) {
            jsonError(res, 400, "SYNC_FAILED", "Member is not bannable (higher role or bot owner)");
            return;
          }
          await member.ban({
            reason: body.reason || "Banned via GuildAI",
            deleteMessageSeconds: body.deleteMessageSeconds
          });
          json(res, 200, { ok: true });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to ban this member");
          } else {
            throw error;
          }
        }
        return;
      }

      // GET /internal/guild/channels/list — list text, voice, and category channels
      if (method === "GET" && pathname === "/internal/guild/channels/list") {
        const guild = await getGuild(client, guildId);
        const channels = await guild.channels.fetch();
        const typeMap: Record<number, string> = {
          [ChannelType.GuildText]: "text",
          [ChannelType.GuildVoice]: "voice",
          [ChannelType.GuildCategory]: "category",
        };
        const result: Array<{ id: string; name: string; type: string; parentId: string | null }> = [];
        for (const [, channel] of channels) {
          if (!channel) continue;
          if (!(channel.type in typeMap)) continue;
          result.push({ id: channel.id, name: channel.name, type: typeMap[channel.type]!, parentId: channel.parentId || null });
        }
        json(res, 200, { channels: result });
        return;
      }

      // POST /internal/guild/channels/create
      if (method === "POST" && pathname === "/internal/guild/channels/create") {
        const bodyRaw = await readBody(req);
        let body: { name?: string; type?: string; parentId?: string; topic?: string; denyEveryone?: boolean; permissionOverwrites?: Array<{ id: string; type: number; allow: string; deny: string }> } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.name || typeof body.name !== "string") {
          jsonError(res, 400, "INVALID_JSON_BODY", "Missing channel name");
          return;
        }

        const typeMap: Record<string, ChannelType> = {
          text: ChannelType.GuildText,
          voice: ChannelType.GuildVoice,
          category: ChannelType.GuildCategory,
          forum: ChannelType.GuildForum,
          stage: ChannelType.GuildStageVoice
        };
        const channelType = (typeMap[body.type || "text"] || ChannelType.GuildText) as GuildChannelTypes;

        // Auto-inject @everyone deny if requested
        const overwrites = [...(body.permissionOverwrites || [])];
        if (body.denyEveryone && guildId) {
          overwrites.unshift({ id: guildId, type: 0, allow: "0", deny: "1024" }); // deny ViewChannel
        }

        const guild = await getGuild(client, guildId);
        try {
          const channel = await guild.channels.create({
            name: body.name,
            type: channelType,
            parent: body.parentId || undefined,
            topic: body.topic || undefined,
            permissionOverwrites: overwrites.length > 0 ? overwrites.map((o) => ({ id: o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) })) : undefined
          });
          json(res, 200, { ok: true, channelId: channel.id, channelName: channel.name });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to create channel");
          } else {
            throw error;
          }
        }
        return;
      }

      // POST /internal/guild/channels/:channelId/threads/create
      const threadCreateMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)\/threads\/create$/);
      if (method === "POST" && threadCreateMatch) {
        const parentChannelId = decodeURIComponent(threadCreateMatch[1] || "");
        if (!parentChannelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel ID"); return; }

        const bodyRaw = await readBody(req);
        let body: { name?: string; type?: string; memberUserIds?: string[] } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        if (!body.name) { jsonError(res, 400, "INVALID_JSON_BODY", "Missing thread name"); return; }

        const channel = await client.channels.fetch(parentChannelId).catch(() => null);
        if (!channel || !("threads" in channel)) {
          jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found or does not support threads");
          return;
        }

        try {
          const threadType = body.type === "public" ? ChannelType.PublicThread : ChannelType.PrivateThread;
          const thread = await (channel as { threads: { create: Function } }).threads.create({
            name: body.name.slice(0, 100),
            autoArchiveDuration: 10080,
            type: threadType,
            reason: "Application ticket"
          });

          // Add members to the thread
          for (const userId of (body.memberUserIds || [])) {
            await (thread as { members: { add: Function } }).members.add(userId).catch(() => {});
          }

          json(res, 200, { ok: true, threadId: (thread as { id: string }).id, threadName: (thread as { name: string }).name });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to create thread");
          } else {
            throw error;
          }
        }
        return;
      }

      // GET /internal/guild/channels/:channelId/permissions — get channel permission overwrites
      const permissionsMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)\/permissions$/);
      if (method === "GET" && permissionsMatch) {
        const channelId = decodeURIComponent(permissionsMatch[1] || "");
        if (!channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel id"); return; }

        const guild = await getGuild(client, guildId);
        try {
          const channel = await guild.channels.fetch(channelId);
          if (!channel) {
            jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found");
            return;
          }
          const overwrites = "permissionOverwrites" in channel && channel.permissionOverwrites
            ? channel.permissionOverwrites.cache.map((o) => ({
                id: o.id,
                type: o.type,
                allow: o.allow.bitfield.toString(),
                deny: o.deny.bitfield.toString()
              }))
            : [];
          json(res, 200, { channelId, channelName: channel.name, permissionOverwrites: overwrites });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to read channel");
          } else {
            throw error;
          }
        }
        return;
      }

      // PATCH /internal/guild/channels/:channelId — move or rename channel
      const patchChannelMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)$/);
      if (method === "PATCH" && patchChannelMatch) {
        const channelId = decodeURIComponent(patchChannelMatch[1] || "");
        if (!channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel id"); return; }

        const bodyRaw = await readBody(req);
        let body: { parentId?: string | null; name?: string } = {};
        try { body = JSON.parse(bodyRaw); } catch { jsonError(res, 400, "INVALID_JSON_BODY", "Invalid JSON body"); return; }

        const guild = await getGuild(client, guildId);
        try {
          const channel = await guild.channels.fetch(channelId);
          if (!channel) {
            jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found");
            return;
          }

          if (body.name) {
            if (!("setName" in channel)) {
              jsonError(res, 400, "SYNC_FAILED", "Channel type does not support renaming");
              return;
            }
            await (channel as { setName: Function }).setName(body.name);
          }

          if (body.parentId !== undefined) {
            if (!("setParent" in channel)) {
              jsonError(res, 400, "SYNC_FAILED", "Channel type does not support moving");
              return;
            }
            await (channel as { setParent: Function }).setParent(body.parentId ?? null);
          }

          json(res, 200, { ok: true, channelId: channel.id, name: body.name, parentId: body.parentId ?? null });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to modify channel");
          } else {
            throw error;
          }
        }
        return;
      }

      // DELETE /internal/guild/channels/:channelId
      const deleteChannelMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)$/);
      if (method === "DELETE" && deleteChannelMatch) {
        const channelId = decodeURIComponent(deleteChannelMatch[1] || "");
        if (!channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel id"); return; }

        const guild = await getGuild(client, guildId);
        try {
          const channel = await guild.channels.fetch(channelId);
          if (!channel) {
            jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found");
            return;
          }
          if (!("deletable" in channel) || !channel.deletable) {
            jsonError(res, 400, "SYNC_FAILED", "Channel is not deletable");
            return;
          }
          await channel.delete();
          json(res, 200, { ok: true });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to delete channel");
          } else {
            throw error;
          }
        }
        return;
      }

      // DELETE /internal/guild/channels/:channelId/messages/:messageId
      const deleteMessageMatch = pathname.match(/^\/internal\/guild\/channels\/([^/]+)\/messages\/([^/]+)$/);
      if (method === "DELETE" && deleteMessageMatch) {
        const channelId = decodeURIComponent(deleteMessageMatch[1] || "");
        const messageId = decodeURIComponent(deleteMessageMatch[2] || "");
        if (!channelId) { jsonError(res, 400, "MISSING_CHANNEL_ID", "Missing channel id"); return; }
        if (!messageId) { jsonError(res, 400, "MISSING_MESSAGE_ID", "Missing message id"); return; }

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !("messages" in channel)) {
          jsonError(res, 404, "CHANNEL_NOT_FOUND", "Channel not found or not text-based");
          return;
        }

        try {
          const ch = channel as { messages: { fetch: Function } };
          const msg = await ch.messages.fetch(messageId).catch(() => null);
          if (!msg || !("delete" in msg)) {
            jsonError(res, 404, "NOT_FOUND", "Message not found");
            return;
          }
          await (msg as { delete: Function }).delete();
          json(res, 200, { ok: true });
        } catch (error) {
          if (isMissingPermissionsError(error)) {
            jsonError(res, 403, "SYNC_FAILED", "Missing permissions to delete message");
          } else {
            throw error;
          }
        }
        return;
      }

      jsonError(res, 404, "NOT_FOUND", "Not found");
    } catch (error) {
      if (error instanceof Error && error.message === "Body too large") {
        jsonError(res, 413, "REQUEST_BODY_TOO_LARGE", "Request body too large");
        return;
      }
      logger.error("Internal sync request failed", { method, path: pathname, error, durationMs: Date.now() - requestStart });
      jsonError(res, 500, "SYNC_FAILED", "Sync failed");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info(`Internal sync server listening on ${port}.`);
  });
}
