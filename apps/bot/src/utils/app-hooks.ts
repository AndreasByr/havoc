import type { Client } from "discord.js";
import { eq } from "drizzle-orm";
import { installedApps, safeParseAppManifest, type GuildoraAppBotHook } from "@guildora/shared";
import type { BotContext, VoiceActivityPayload, RoleChangePayload, MemberJoinPayload, InteractionPayload, MessagePayload } from "@guildora/app-sdk";
import { getDb } from "./db";
import { createAppDb } from "./app-db";
import { createBotClient } from "./bot-client";
import { logger } from "./logger";

async function loadAppConfig(appId: string): Promise<Record<string, unknown>> {
  try {
    const db = getDb();
    const rows = await db.select({ config: installedApps.config }).from(installedApps).where(eq(installedApps.appId, appId)).limit(1);
    return (rows[0]?.config as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

// ─── Hook payload types (aligned with @guildora/app-sdk) ─────────────────

export type BotHookEventMap = {
  onMemberJoin: MemberJoinPayload;
  onRoleChange: RoleChangePayload;
  onVoiceActivity: VoiceActivityPayload;
  onInteraction: InteractionPayload;
  onMessage: MessagePayload;
};

type BotHookEventName = keyof BotHookEventMap;
type BotHookHandler<K extends BotHookEventName> = (
  payload: BotHookEventMap[K],
  ctx: BotContext
) => Promise<void> | void;

// ─── Registry ────────────────────────────────────────────────────────────────

class BotAppHookRegistry {
  private handlers = new Map<
    BotHookEventName,
    Map<string, { handler: BotHookHandler<BotHookEventName>; ctx: BotContext }>
  >();

  register<K extends BotHookEventName>(
    appId: string,
    eventName: K,
    handler: BotHookHandler<K>,
    ctx: BotContext
  ) {
    let scopedHandlers = this.handlers.get(eventName);
    if (!scopedHandlers) {
      scopedHandlers = new Map();
      this.handlers.set(eventName, scopedHandlers);
    }
    scopedHandlers.set(appId, { handler: handler as BotHookHandler<BotHookEventName>, ctx });
  }

  unregister(appId: string, eventName?: BotHookEventName) {
    if (eventName) {
      this.handlers.get(eventName)?.delete(appId);
      return;
    }
    for (const handlers of this.handlers.values()) {
      handlers.delete(appId);
    }
  }

  clearAll() {
    this.handlers.clear();
  }

  async emit<K extends BotHookEventName>(eventName: K, payload: BotHookEventMap[K]) {
    const scopedHandlers = this.handlers.get(eventName);
    if (!scopedHandlers || scopedHandlers.size === 0) {
      return;
    }

    for (const [appId, { handler, ctx }] of scopedHandlers.entries()) {
      try {
        // Refresh config from DB before each hook invocation so config
        // changes (e.g. toggling read-only mode) take effect immediately
        const freshConfig = await loadAppConfig(appId);
        if (Object.keys(freshConfig).length > 0) {
          ctx.config = freshConfig;
        }
        await (handler as BotHookHandler<K>)(payload, ctx);
      } catch (error) {
        logger.error("App hook failed", { appId, hookName: eventName, error });
      }
    }
  }
}

export const botAppHookRegistry = new BotAppHookRegistry();

// ─── Load all hooks from DB ────────────────────────────────────────────────────

export async function loadInstalledAppHooks(discordClient: Client) {
  const db = getDb();
  const rows = await db.select().from(installedApps).where(eq(installedApps.status, "active"));
  botAppHookRegistry.clearAll();

  for (const row of rows) {
    const parsed = safeParseAppManifest(row.manifest);
    if (!parsed.success) {
      logger.warn(`Skipping app hooks for ${row.appId}: invalid manifest.`);
      continue;
    }

    if (!parsed.data.botHooks?.length) continue;

    const codeBundle = (row.codeBundle as Record<string, string>) || {};
    const code = codeBundle["src/bot/hooks.ts"];
    if (!code) {
      logger.warn(`[app-hooks] No hooks bundle found for app '${row.appId}'. Skipping.`);
      continue;
    }

    // Evaluate the CJS bundle once per app, then register each declared hook.
    // SECURITY: Executes bot hook code from the database (codeBundle).
    // Mitigations: require() is blocked, app must be active with valid manifest.
    // The executed code receives a scoped app DB and a BotClient wrapper.
    // Risk: No true sandboxing — code shares the Node.js process. Accepted trade-off
    // for the plugin system. Consider isolated-vm for stricter isolation in the future.
    const mod = { exports: {} as Record<string, unknown> };
    try {
      // eslint-disable-next-line no-new-func
      new Function("module", "exports", "require", code)(
        mod,
        mod.exports,
        (id: string) => { throw new Error(`require('${id}') is not available in app hooks.`); }
      );
    } catch (err) {
      logger.error(`[app-hooks] Failed to load hooks bundle for app '${row.appId}'`, err);
      continue;
    }

    const config = (row.config as Record<string, unknown>) || {};
    const ctx: BotContext = {
      config,
      db: createAppDb(row.appId),
      bot: createBotClient(discordClient),
      botUserId: discordClient.user?.id || "",
      guildId: process.env.DISCORD_GUILD_ID || "",
      platform: "discord"
    };

    for (const hookName of parsed.data.botHooks as GuildoraAppBotHook[]) {
      const fn = mod.exports[hookName];
      if (typeof fn !== "function") {
        logger.warn(`[app-hooks] App '${row.appId}' declares hook '${hookName}' but has no exported function.`);
        continue;
      }
      botAppHookRegistry.register(row.appId, hookName, fn as BotHookHandler<typeof hookName>, ctx);
    }
  }

  logger.info(`Loaded bot hooks for ${rows.length} active app(s).`);
}
