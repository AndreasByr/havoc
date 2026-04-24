/**
 * Setup endpoint: triggers bot credential reload after platform credentials are saved.
 * Called by the wizard after POST /api/setup/platform succeeds for Discord.
 * Forwards the reload request to the bot's internal endpoint if the bot is reachable.
 */
export default defineEventHandler(async () => {
  const botInternalUrl = process.env.NUXT_BOT_INTERNAL_URL;
  const botInternalToken = process.env.NUXT_BOT_INTERNAL_TOKEN;

  if (!botInternalUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Bot internal URL is not configured. Set NUXT_BOT_INTERNAL_URL in .env."
    });
  }

  if (!botInternalToken) {
    throw createError({
      statusCode: 503,
      statusMessage: "Bot internal token is not configured. Set BOT_INTERNAL_TOKEN in .env."
    });
  }

  try {
    const response = await $fetch<{ ok?: boolean; guildId?: string }>(
      `${botInternalUrl}/internal/bot/reload-credentials`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botInternalToken}`
        },
        timeout: 15_000
      }
    );

    return { ok: true, reloaded: response?.ok === true };
  } catch (error: unknown) {
    const fetchError = error as { response?: { status?: number }; message?: string };
    const statusCode = fetchError?.response?.status;

    // If bot is unreachable (connection refused, timeout) or returns 5xx,
    // provide actionable instructions to restart the bot container.
    const isUnreachable = statusCode === undefined || statusCode >= 500;
    const message = isUnreachable
      ? "Bot is unreachable. Restart the bot container to apply new credentials: docker compose restart bot"
      : "Bot reload failed. Check bot logs and restart if needed: docker compose restart bot";

    throw createError({
      statusCode: 502,
      statusMessage: message
    });
  }
});