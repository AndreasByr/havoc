/**
 * Validates a Discord bot token against the Discord API.
 * Called server-side before persisting credentials during setup wizard.
 *
 * Threat surface: untrusted user-supplied bot token reaches an external API.
 * Mitigation: 10s timeout enforced; token is NEVER echoed back in errors.
 */
import { ofetch } from "ofetch";

export interface DiscordTokenValidationResult {
  ok: boolean;
  reason?: string;
  botUserId?: string;
}

/**
 * Validate a Discord bot token by calling GET /users/@me with Bot auth.
 * Returns { ok: true, botUserId } on success.
 * Returns { ok: false, reason } on failure — reason is user-facing but safe.
 */
export async function validateDiscordToken(token: string): Promise<DiscordTokenValidationResult> {
  if (!token || token.trim().length < 20) {
    return { ok: false, reason: "Bot token is too short — expected a 50+ character Discord bot token." };
  }

  try {
    const response = await ofetch<{ id: string; username: string }>(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bot ${token.trim()}`,
        },
        // Enforce 10s timeout — Discord API down should surface as actionable 400, not 500
        timeout: 10_000,
      }
    );

    return { ok: true, botUserId: response.id };
  } catch (error: unknown) {
    // Discord API rejects unknown bot tokens with 401
    if (error instanceof Error && error.message.includes("401")) {
      return { ok: false, reason: "Discord rejected the bot token — check your Bot token and ensure the bot is in your application." };
    }
    // Network timeout or unreachable
    if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("fetch"))) {
      return { ok: false, reason: "Discord API is unreachable — check your network/firewall and try again." };
    }
    // Catch-all: surface as generic actionable failure
    return { ok: false, reason: "Discord rejected the bot token — ensure the bot is active in your Discord application." };
  }
}
