type SyncUserPayload = {
  discordId: string;
  profileName?: string | null;
  permissionRoles?: string[];
};

export type BotInternalErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_JSON_BODY"
  | "MISSING_DISCORD_ID"
  | "MISSING_ROLE_ID"
  | "MISSING_ROLE_IDS"
  | "INVALID_SELECTED_ROLE_IDS"
  | "NON_EDITABLE_ALLOWED_ROLES"
  | "NOT_FOUND"
  | "REQUEST_BODY_TOO_LARGE"
  | "SYNC_FAILED";

export type DiscordUserSyncResult = {
  ok: boolean;
  nicknameUpdated?: boolean;
  nicknameReason?: "not_requested" | "missing_permissions" | "member_not_manageable" | "nickname_too_long" | null;
  appliedNickname?: string | null;
};

type RemoveRolesPayload = {
  roleIds?: string[];
  removeAllManageable?: boolean;
};

type SyncCommunityRolesPayload = {
  allowedRoleIds: string[];
  selectedRoleIds: string[];
};

export type DiscordGuildRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
  color: number;
  unicodeEmoji: string | null;
};

export type DiscordGuildMember = {
  discordId: string;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  roleIds: string[];
};

export class BotBridgeError extends Error {
  readonly code: BotInternalErrorCode | "UNKNOWN";
  readonly statusCode?: number;

  constructor(code: BotInternalErrorCode | "UNKNOWN", message: string, statusCode?: number) {
    super(message);
    this.name = "BotBridgeError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getBotRequestConfigSync() {
  const runtime = useRuntimeConfig();
  const baseUrl = typeof runtime.botInternalUrl === "string" ? runtime.botInternalUrl : "";
  const token = typeof runtime.botInternalToken === "string" ? runtime.botInternalToken : "";
  return { baseUrl, token };
}

/**
 * Get bot connection config. Tries platform_connections DB first, falls back to .env.
 * This is async because it may read from the database.
 */
async function getBotRequestConfig(): Promise<{ baseUrl: string; token: string }> {
  try {
    const { getPlatformBotConfig } = await import("./platformConfig");
    const dbConfig = await getPlatformBotConfig("discord");
    if (dbConfig) return dbConfig;
  } catch {
    // platformConfig not available (e.g. during early startup) — fall through to ENV
  }
  return getBotRequestConfigSync();
}

async function requestBotInternal<T>(path: string, options?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }) {
  const { baseUrl, token } = await getBotRequestConfig();
  if (!baseUrl) {
    throw new Error("BOT_INTERNAL_URL is not configured.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    return await $fetch<T>(`${baseUrl}${path}`, {
      method: options?.method || "GET",
      headers,
      body: (options?.body ?? undefined) as Record<string, unknown> | undefined,
      signal: controller.signal
    });
  } catch (error) {
    const maybeError = error as {
      statusCode?: number;
      data?: {
        errorCode?: BotInternalErrorCode;
        error?: string;
      };
      message?: string;
    };

    const errorCode = maybeError?.data?.errorCode;
    if (errorCode) {
      throw new BotBridgeError(
        errorCode,
        maybeError.data?.error || maybeError.message || "Bot bridge request failed.",
        maybeError.statusCode
      );
    }

    throw new BotBridgeError("UNKNOWN", maybeError?.message || "Bot bridge request failed.", maybeError?.statusCode);
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncDiscordUserFromWebsite(payload: SyncUserPayload): Promise<DiscordUserSyncResult | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) {
    return null;
  }

  try {
    return await requestBotInternal<DiscordUserSyncResult>("/internal/sync-user", { method: "POST", body: payload });
  } catch (error) {
    console.error("Bot sync failed:", error);
    return null;
  }
}

export async function fetchDiscordGuildRolesFromBot() {
  return requestBotInternal<{ roles: DiscordGuildRole[] }>("/internal/guild/roles");
}

export type DiscordGuildChannel = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
};

export async function fetchDiscordGuildChannelsFromBot() {
  return requestBotInternal<{ channels: DiscordGuildChannel[] }>("/internal/guild/channels/list");
}

export async function fetchDiscordGuildMembersByRoleFromBot(roleId: string) {
  const encodedRoleId = encodeURIComponent(roleId);
  return requestBotInternal<{ members: DiscordGuildMember[] }>(`/internal/guild/roles/${encodedRoleId}/members`);
}

export async function fetchDiscordGuildMemberFromBot(discordId: string) {
  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ member: DiscordGuildMember | null }>(`/internal/guild/members/${encodedDiscordId}`);
}

export async function removeDiscordRolesFromBot(discordId: string, payload: RemoveRolesPayload) {
  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean; removedRoleIds: string[] }>(`/internal/guild/members/${encodedDiscordId}/remove-roles`, {
    method: "POST",
    body: payload
  });
}

export async function refreshBotCommands(): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;
  await requestBotInternal<{ ok: boolean }>("/internal/sync-commands", { method: "POST" });
}

export async function reloadBotHooks(): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;
  await requestBotInternal<{ ok: boolean }>("/internal/reload-hooks", { method: "POST" });
}

export async function syncDiscordCommunityRolesFromBot(discordId: string, payload: SyncCommunityRolesPayload) {
  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean; addedRoleIds: string[]; removedRoleIds: string[]; currentRoleIds: string[] }>(
    `/internal/guild/members/${encodedDiscordId}/sync-community-roles`,
    {
      method: "POST",
      body: payload
    }
  );
}

// ─── Application Flow Bridge Functions ────────────────────────────────────

export type EmbedConfig = {
  description?: string;
  buttonLabel?: string;
  color?: string;
};

export async function postApplicationEmbed(
  flowId: string,
  channelId: string,
  embed: EmbedConfig
): Promise<{ messageId: string } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  try {
    return await requestBotInternal<{ messageId: string }>("/internal/applications/embed", {
      method: "POST",
      body: { flowId, channelId, ...embed }
    });
  } catch (error) {
    console.error("[botSync] Failed to post application embed:", error);
    throw error;
  }
}

export async function patchApplicationEmbed(
  channelId: string,
  messageId: string,
  flowId: string,
  embed: EmbedConfig
): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;

  await requestBotInternal<{ ok: boolean }>("/internal/applications/embed", {
    method: "PATCH",
    body: { channelId, messageId, flowId, ...embed }
  });
}

export async function deleteApplicationEmbed(channelId: string, messageId: string): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;

  await requestBotInternal<{ ok: boolean }>("/internal/applications/embed", {
    method: "DELETE",
    body: { channelId, messageId }
  });
}

export async function addDiscordRolesToMember(
  discordId: string,
  roleIds: string[]
): Promise<{ ok: boolean; addedRoleIds: string[] } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;
  if (roleIds.length === 0) return { ok: true, addedRoleIds: [] };

  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean; addedRoleIds: string[] }>(
    `/internal/guild/members/${encodedDiscordId}/add-roles`,
    { method: "POST", body: { roleIds } }
  );
}

export async function setDiscordNickname(
  discordId: string,
  nickname: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean }>(
    `/internal/guild/members/${encodedDiscordId}/set-nickname`,
    { method: "POST", body: { nickname } }
  );
}

export async function sendDiscordDm(
  discordId: string,
  message: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedDiscordId = encodeURIComponent(discordId);
  try {
    return await requestBotInternal<{ ok: boolean }>(
      `/internal/guild/members/${encodedDiscordId}/dm`,
      { method: "POST", body: { message } }
    );
  } catch (error) {
    console.error("[botSync] Failed to send DM:", error);
    return null;
  }
}

// ─── Role Picker Embed Bridge Functions ──────────────────────────────────

export type RolePickerEmbedPayload = {
  groupId: string;
  channelId: string;
  title: string;
  description?: string;
  color?: string;
  roles: Array<{ discordRoleId: string; emoji: string | null; roleName: string }>;
};

export async function postRolePickerEmbed(
  payload: RolePickerEmbedPayload
): Promise<{ messageId: string } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  try {
    return await requestBotInternal<{ messageId: string }>("/internal/role-picker/embed", {
      method: "POST",
      body: payload
    });
  } catch (error) {
    console.error("[botSync] Failed to post role picker embed:", error);
    throw error;
  }
}

export async function patchRolePickerEmbed(
  channelId: string,
  messageId: string,
  payload: Omit<RolePickerEmbedPayload, "channelId">
): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;

  await requestBotInternal<{ ok: boolean }>("/internal/role-picker/embed", {
    method: "PATCH",
    body: { channelId, messageId, ...payload }
  });
}

export async function deleteRolePickerEmbed(channelId: string, messageId: string): Promise<void> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return;

  await requestBotInternal<{ ok: boolean }>("/internal/role-picker/embed", {
    method: "DELETE",
    body: { channelId, messageId }
  });
}

// ─── GuildAI Action Bridge Functions ──────────────────────────────────────

export async function kickDiscordMember(
  discordId: string,
  reason?: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean }>(
    `/internal/guild/members/${encodedDiscordId}/kick`,
    { method: "POST", body: { reason } }
  );
}

export async function banDiscordMember(
  discordId: string,
  reason?: string,
  deleteMessageSeconds?: number
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedDiscordId = encodeURIComponent(discordId);
  return requestBotInternal<{ ok: boolean }>(
    `/internal/guild/members/${encodedDiscordId}/ban`,
    { method: "POST", body: { reason, deleteMessageSeconds } }
  );
}

export async function createDiscordChannel(
  name: string,
  type?: string,
  parentId?: string,
  options?: { denyEveryone?: boolean; permissionOverwrites?: Array<{ id: string; type: number; allow: string; deny: string }> }
): Promise<{ ok: boolean; channelId: string; channelName: string } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  return requestBotInternal<{ ok: boolean; channelId: string; channelName: string }>(
    "/internal/guild/channels/create",
    { method: "POST", body: { name, type, parentId, ...options } }
  );
}

export async function createDiscordThread(
  parentChannelId: string,
  name: string,
  options?: { type?: "public" | "private"; memberUserIds?: string[] }
): Promise<{ ok: boolean; threadId: string; threadName: string } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedChannelId = encodeURIComponent(parentChannelId);
  return requestBotInternal<{ ok: boolean; threadId: string; threadName: string }>(
    `/internal/guild/channels/${encodedChannelId}/threads/create`,
    { method: "POST", body: { name, type: options?.type || "private", memberUserIds: options?.memberUserIds || [] } }
  );
}

export async function moveDiscordChannel(
  channelId: string,
  parentId: string | null
): Promise<{ ok: boolean; channelId: string; parentId: string | null } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedChannelId = encodeURIComponent(channelId);
  return requestBotInternal<{ ok: boolean; channelId: string; parentId: string | null }>(
    `/internal/guild/channels/${encodedChannelId}`,
    { method: "PATCH", body: { parentId } }
  );
}

export async function deleteDiscordChannel(
  channelId: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedChannelId = encodeURIComponent(channelId);
  return requestBotInternal<{ ok: boolean }>(
    `/internal/guild/channels/${encodedChannelId}`,
    { method: "DELETE" }
  );
}

export async function deleteDiscordMessage(
  channelId: string,
  messageId: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedChannelId = encodeURIComponent(channelId);
  const encodedMessageId = encodeURIComponent(messageId);
  return requestBotInternal<{ ok: boolean }>(
    `/internal/guild/channels/${encodedChannelId}/messages/${encodedMessageId}`,
    { method: "DELETE" }
  );
}

export async function sendChannelMessage(
  channelId: string,
  message: string
): Promise<{ ok: boolean } | null> {
  const { baseUrl } = await getBotRequestConfig();
  if (!baseUrl) return null;

  const encodedChannelId = encodeURIComponent(channelId);
  try {
    return await requestBotInternal<{ ok: boolean }>(
      `/internal/guild/channels/${encodedChannelId}/send`,
      { method: "POST", body: { message } }
    );
  } catch (error) {
    console.error("[botSync] Failed to send channel message:", error);
    return null;
  }
}
