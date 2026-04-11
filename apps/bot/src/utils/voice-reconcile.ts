import { desc, eq, inArray, isNull } from "drizzle-orm";
import type { Client, Guild } from "discord.js";
import { users, voiceSessions } from "@guildora/shared";
import { getDb } from "./db";
import {
  closeIfOpen,
  closeSessionById,
  isRegularVoiceChannel,
  openIfMissing,
  splitOnChannelMismatch
} from "./voice-session-lifecycle";
import { logger } from "./logger";

const RECONCILE_INTERVAL_MS = 60_000;
const STALE_SESSION_MAX_MINUTES = 8 * 60;

let reconcileTimer: NodeJS.Timeout | null = null;
let reconcileInProgress = false;

async function getConfiguredGuild(client: Client) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    logger.warn("DISCORD_GUILD_ID is missing. Voice reconcile loop is disabled.");
    return null;
  }

  const guild = await client.guilds.fetch(guildId);
  if (!guild.available) {
    logger.warn(`Guild ${guildId} is currently unavailable. Skipping voice reconcile.`);
    return null;
  }

  return guild;
}

async function getCurrentRegularChannelId(guild: Guild, discordId: string, afkChannelId: string | null) {
  let state = guild.voiceStates.cache.get(discordId) ?? null;
  if (!state) {
    try {
      state = await guild.voiceStates.fetch(discordId);
    } catch {
      return null;
    }
  }

  if (state.member?.user?.bot) {
    return null;
  }

  return isRegularVoiceChannel(state.channelId, afkChannelId) ? state.channelId : null;
}

async function closeDuplicateOpenSessions() {
  const db = getDb();
  const openRows = await db
    .select({
      id: voiceSessions.id,
      userId: voiceSessions.userId,
      channelId: voiceSessions.channelId,
      startedAt: voiceSessions.startedAt
    })
    .from(voiceSessions)
    .where(isNull(voiceSessions.endedAt))
    .orderBy(desc(voiceSessions.startedAt), desc(voiceSessions.createdAt));

  const seenUsers = new Set<string>();
  let closedDuplicates = 0;

  for (const row of openRows) {
    if (!seenUsers.has(row.userId)) {
      seenUsers.add(row.userId);
      continue;
    }

    // Conservative cleanup: older duplicate "open" sessions are closed with zero duration.
    await closeSessionById(db, row, row.startedAt, { maxDurationMinutes: 0 });
    closedDuplicates += 1;
  }

  return closedDuplicates;
}

async function reconcileOpenSessionsForGuild(guild: Guild, now: Date) {
  const db = getDb();
  const afkChannelId = process.env.AFK_VOICE_CHANNEL_ID || guild.afkChannelId || null;

  const openSessions = await db
    .select({
      userId: voiceSessions.userId,
      discordId: users.discordId,
      channelId: voiceSessions.channelId
    })
    .from(voiceSessions)
    .innerJoin(users, eq(voiceSessions.userId, users.id))
    .where(isNull(voiceSessions.endedAt));

  let closedSessions = 0;
  let splitSessions = 0;
  let openedSessions = 0;

  for (const row of openSessions) {
    if (!row.discordId) continue; // skip non-Discord users
    const currentChannelId = await getCurrentRegularChannelId(guild, row.discordId, afkChannelId);

    if (!currentChannelId) {
      if (await closeIfOpen(db, row.userId, now, { maxDurationMinutes: STALE_SESSION_MAX_MINUTES })) {
        closedSessions += 1;
      }
      continue;
    }

    if (row.channelId !== currentChannelId) {
      const result = await splitOnChannelMismatch(db, row.userId, currentChannelId, now, {
        maxDurationMinutes: STALE_SESSION_MAX_MINUTES
      });
      if (result === "split") {
        splitSessions += 1;
      } else if (result === "opened") {
        openedSessions += 1;
      }
    }
  }

  const regularVoiceStates = Array.from(guild.voiceStates.cache.values()).filter(
    (state) => !state.member?.user?.bot && isRegularVoiceChannel(state.channelId, afkChannelId)
  );
  const connectedDiscordIds = regularVoiceStates.map((state) => state.id);

  if (connectedDiscordIds.length > 0) {
    const mappedUsers = await db
      .select({
        id: users.id,
        discordId: users.discordId
      })
      .from(users)
      .where(inArray(users.discordId, connectedDiscordIds));
    const userByDiscordId = new Map(mappedUsers.map((row) => [row.discordId, row]));

    for (const state of regularVoiceStates) {
      const mappedUser = userByDiscordId.get(state.id);
      if (!mappedUser || !state.channelId) {
        continue;
      }
      if (await openIfMissing(db, mappedUser.id, state.channelId, now)) {
        openedSessions += 1;
      }
    }
  }

  return {
    closedSessions,
    splitSessions,
    openedSessions
  };
}

async function runReconcile(client: Client) {
  if (reconcileInProgress) {
    return;
  }
  reconcileInProgress = true;

  try {
    const guild = await getConfiguredGuild(client);
    if (!guild) {
      return;
    }

    const now = new Date();
    const duplicateSessionsClosed = await closeDuplicateOpenSessions();
    const result = await reconcileOpenSessionsForGuild(guild, now);

    if (duplicateSessionsClosed > 0 || result.closedSessions > 0 || result.splitSessions > 0 || result.openedSessions > 0) {
      logger.info("Voice reconcile completed", {
        duplicatesClosed: duplicateSessionsClosed,
        closed: result.closedSessions,
        split: result.splitSessions,
        opened: result.openedSessions,
        durationMs: Date.now() - now.getTime(),
      });
    }
  } catch (error) {
    logger.error("Voice session reconcile failed.", error);
  } finally {
    reconcileInProgress = false;
  }
}

export function startVoiceSessionReconcileLoop(client: Client) {
  if (reconcileTimer) {
    return;
  }
  if (!process.env.DISCORD_GUILD_ID) {
    logger.warn("DISCORD_GUILD_ID is missing. Voice reconcile loop is disabled.");
    return;
  }

  void runReconcile(client);

  reconcileTimer = setInterval(() => {
    void runReconcile(client);
  }, RECONCILE_INTERVAL_MS);
}

export function stopVoiceSessionReconcileLoop(): Promise<void> {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }

  if (!reconcileInProgress) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000);
    const check = setInterval(() => {
      if (!reconcileInProgress) {
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
}
