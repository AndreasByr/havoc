import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits } from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
} catch {
  // dotenv not available in production Docker — env vars injected by container
}

import type { BotCommand } from "./types";
import { setupCommand } from "./commands/setup";
import { registerGuildMemberAddEvent } from "./events/guildMemberAdd";
import { registerInteractionCreateEvent } from "./events/interactionCreate";
import { registerReadyEvent } from "./events/ready";
import { registerVoiceStateUpdateEvent } from "./events/voiceStateUpdate";
import { registerMessageCreateEvent } from "./events/messageCreate";
import { loadInstalledAppHooks } from "./utils/app-hooks";
import { ensureBaseRoles } from "./utils/community";
import { loadAndDeployAppCommands, startInternalSyncServer } from "./utils/internal-sync-server";
import { logger } from "./utils/logger";
import { isPlaceholderToken } from "./utils/startup-checks";
import { stopVoiceSessionReconcileLoop } from "./utils/voice-reconcile";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const botInternalToken = process.env.BOT_INTERNAL_TOKEN;

if (!botInternalToken || isPlaceholderToken(botInternalToken)) {
  logger.error(
    "Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value. Set a real secret in your .env file."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const commands = new Collection<string, BotCommand>();
for (const command of [setupCommand]) {
  commands.set(command.data.name, command);
}

registerReadyEvent(client);
registerInteractionCreateEvent(client, commands);
registerGuildMemberAddEvent(client);
registerVoiceStateUpdateEvent(client);
registerMessageCreateEvent(client);

ensureBaseRoles()
  .then(() => logger.info("Base roles ensured."))
  .catch((error) => logger.error("Role initialization failed.", error));

loadInstalledAppHooks(client)
  .then(() => logger.info("App hooks loaded."))
  .catch((error) => logger.error("App hook loading failed.", error));

loadAndDeployAppCommands(commands)
  .then(() => logger.info("App commands loaded and deployed."))
  .catch((error) => logger.error("App command loading failed.", error));

startInternalSyncServer(client, commands);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await stopVoiceSessionReconcileLoop();
    client.destroy();
    logger.info("Shutdown complete");
  } catch (error) {
    logger.error("Error during shutdown", error);
  }

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

client.login(token).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("disallowed intents")) {
    logger.error(
      "Discord login failed: Privileged Intents sind nicht aktiviert. " +
        "Im Discord Developer Portal (https://discord.com/developers/applications) → deine App → Bot → " +
        "„Privileged Gateway Intents“: „SERVER MEMBERS INTENT“ und ggf. „PRESENCE INTENT“ aktivieren."
    );
  } else {
    logger.error("Discord login failed.", error);
  }
  process.exit(1);
});
