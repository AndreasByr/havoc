/**
 * Platform Bridge — routes internal bot requests to the correct platform connector.
 * Replaces direct botSync.ts calls with platform-aware routing.
 *
 * Usage:
 *   import { requestPlatform } from "./platformBridge";
 *   const roles = await requestPlatform<{ roles: PlatformRole[] }>("discord", "/internal/guild/roles");
 */

import { getPlatformBotConfig, type PlatformType } from "./platformConfig";
import { BotBridgeError, type BotInternalErrorCode } from "./botSync";

/**
 * Make a request to the correct platform bot connector.
 * Reads the bot URL + token from platform_connections (or ENV fallback).
 */
export async function requestPlatform<T>(
  platform: PlatformType,
  path: string,
  options?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }
): Promise<T> {
  const config = await getPlatformBotConfig(platform);
  if (!config) {
    throw new BotBridgeError(
      "UNKNOWN",
      `No ${platform} bot connection configured.`,
      503
    );
  }

  const { baseUrl, token } = config;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
      data?: { errorCode?: BotInternalErrorCode; error?: string };
      message?: string;
    };

    const errorCode = maybeError?.data?.errorCode;
    if (errorCode) {
      throw new BotBridgeError(
        errorCode,
        maybeError.data?.error || maybeError.message || `${platform} bot request failed.`,
        maybeError.statusCode
      );
    }

    throw new BotBridgeError(
      "UNKNOWN",
      maybeError?.message || `${platform} bot request failed.`,
      maybeError?.statusCode
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Platform-Agnostic Convenience Wrappers ─────────────────────────────────

export type PlatformRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
  color: number;
};

export type PlatformMember = {
  platformUserId: string;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  roleIds: string[];
};

export type PlatformChannel = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
};

export async function fetchPlatformRoles(platform: PlatformType) {
  return requestPlatform<{ roles: PlatformRole[] }>(platform, "/internal/guild/roles");
}

export async function fetchPlatformChannels(platform: PlatformType) {
  return requestPlatform<{ channels: PlatformChannel[] }>(platform, "/internal/guild/channels/list");
}

export async function fetchPlatformMember(platform: PlatformType, platformUserId: string) {
  const encoded = encodeURIComponent(platformUserId);
  return requestPlatform<{ member: PlatformMember | null }>(platform, `/internal/guild/members/${encoded}`);
}

export async function syncPlatformUser(
  platform: PlatformType,
  platformUserId: string,
  payload: { profileName?: string | null; permissionRoles?: string[] }
) {
  return requestPlatform<{ ok: boolean }>(platform, "/internal/sync-user", {
    method: "POST",
    body: { discordId: platformUserId, ...payload } // discordId key for backward compat with Discord bot
  });
}

export async function sendPlatformMessage(platform: PlatformType, channelId: string, content: string) {
  const encoded = encodeURIComponent(channelId);
  return requestPlatform<{ ok: boolean }>(platform, `/internal/guild/channels/${encoded}/send`, {
    method: "POST",
    body: { message: content }
  });
}

export async function checkPlatformHealth(platform: PlatformType) {
  return requestPlatform<{ ok: boolean; status?: string }>(platform, "/internal/health");
}
