import dotenv from "dotenv";
import { createRequire } from "node:module";
import type { MatrixClient } from "matrix-bot-sdk";
import { startInternalSyncServer } from "./utils/internal-sync-server.js";
import { isPlaceholderToken } from "./utils/startup-checks.js";
import { registerRoomMessageHandler } from "./events/roomMessage.js";
import { registerRoomMemberHandler } from "./events/roomMember.js";
import { loadInstalledAppHooks } from "./utils/app-hooks.js";

dotenv.config();

const HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL;
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN;
const SPACE_ID = process.env.MATRIX_SPACE_ID;
const BOT_INTERNAL_PORT = parseInt(process.env.BOT_INTERNAL_PORT || "3051", 10);
const BOT_INTERNAL_TOKEN = process.env.BOT_INTERNAL_TOKEN || "";
const IS_PROD = process.env.NODE_ENV === "production";
const require = createRequire(import.meta.url);

if (!HOMESERVER_URL || !ACCESS_TOKEN) {
  if (IS_PROD) {
    console.error("MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN are required.");
    process.exit(1);
  }
  console.warn("[matrix-bot] MATRIX_HOMESERVER_URL/MATRIX_ACCESS_TOKEN not set; skipping startup in development.");
  process.exit(0);
}

interface MatrixSdkRuntime {
  MatrixClient: new (homeserverUrl: string, accessToken: string, storage?: unknown) => MatrixClient;
  SimpleFsStorageProvider: new (filename: string) => unknown;
  AutojoinRoomsMixin: { setupOnClient(client: MatrixClient): void };
}

function isMissingNativeCrypto(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("matrix-sdk-crypto-nodejs");
}

async function loadMatrixSdkRuntime(): Promise<MatrixSdkRuntime | null> {
  try {
    const { MatrixClient } = require("matrix-bot-sdk/lib/MatrixClient");
    const { SimpleFsStorageProvider } = require("matrix-bot-sdk/lib/storage/SimpleFsStorageProvider");
    const { AutojoinRoomsMixin } = require("matrix-bot-sdk/lib/mixins/AutojoinRoomsMixin");
    return { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin };
  } catch (error) {
    if (!IS_PROD && isMissingNativeCrypto(error)) {
      console.warn("[matrix-bot] Missing native Matrix crypto module; skipping startup in development.");
      return null;
    }
    throw error;
  }
}

if (!BOT_INTERNAL_TOKEN || isPlaceholderToken(BOT_INTERNAL_TOKEN)) {
  console.error(
    "[matrix-bot] Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value. Set a real secret in your .env file."
  );
  process.exit(1);
}

async function main() {
  const sdk = await loadMatrixSdkRuntime();
  if (!sdk) return;

  const { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } = sdk;
  const storage = new SimpleFsStorageProvider("matrix-bot-state.json");
  const client: MatrixClient = new MatrixClient(HOMESERVER_URL!, ACCESS_TOKEN!, storage);

  // Auto-join rooms the bot is invited to
  AutojoinRoomsMixin.setupOnClient(client);

  // Register event handlers
  registerRoomMessageHandler(client, SPACE_ID || null);
  registerRoomMemberHandler(client, SPACE_ID || null);

  // Start the internal HTTP API (same contract as Discord bot)
  startInternalSyncServer({
    client,
    spaceId: SPACE_ID || null,
    port: BOT_INTERNAL_PORT,
    token: BOT_INTERNAL_TOKEN!,
  });

  // Start syncing
  await client.start();

  const userId = await client.getUserId();
  await loadInstalledAppHooks(client);
  console.log(`[matrix-bot] Connected as ${userId}`);
  console.log(`[matrix-bot] Internal sync server on port ${BOT_INTERNAL_PORT}`);
  if (SPACE_ID) {
    console.log(`[matrix-bot] Bound to space: ${SPACE_ID}`);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[matrix-bot] Shutting down...");
    client.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[matrix-bot] Fatal error:", err);
  process.exit(1);
});
