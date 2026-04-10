import { and, desc, eq, isNull } from "drizzle-orm";
import { voiceSessions } from "@guildora/shared";
import type { GuildoraDatabase } from "@guildora/shared/db/client";
import { logger } from "./logger";

const MINUTE_MS = 60_000;

type OpenSessionRow = {
  id: string;
  channelId: string | null;
  startedAt: Date;
};

type CloseSessionOptions = {
  maxDurationMinutes?: number;
};

function isUniqueViolation(error: unknown) {
  const maybe = error as { code?: unknown };
  return maybe?.code === "23505";
}

function calculateDurationMinutes(startedAt: Date, endedAt: Date, maxDurationMinutes?: number) {
  const raw = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / MINUTE_MS));
  if (typeof maxDurationMinutes !== "number" || !Number.isFinite(maxDurationMinutes)) {
    return raw;
  }
  return Math.max(0, Math.min(raw, Math.round(maxDurationMinutes)));
}

async function getNewestOpenSession(db: GuildoraDatabase, userId: string): Promise<OpenSessionRow | null> {
  const rows = await db
    .select({
      id: voiceSessions.id,
      channelId: voiceSessions.channelId,
      startedAt: voiceSessions.startedAt
    })
    .from(voiceSessions)
    .where(and(eq(voiceSessions.userId, userId), isNull(voiceSessions.endedAt)))
    .orderBy(desc(voiceSessions.startedAt), desc(voiceSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export function isRegularVoiceChannel(channelId: string | null | undefined, afkChannelId: string | null) {
  return Boolean(channelId && channelId !== afkChannelId);
}

export async function closeSessionById(
  db: GuildoraDatabase,
  session: OpenSessionRow,
  endedAt: Date,
  options: CloseSessionOptions = {}
) {
  const startedAt = session.startedAt instanceof Date ? session.startedAt : new Date(session.startedAt);
  const durationMinutes = calculateDurationMinutes(startedAt, endedAt, options.maxDurationMinutes);

  await db
    .update(voiceSessions)
    .set({
      endedAt,
      durationMinutes
    })
    .where(and(eq(voiceSessions.id, session.id), isNull(voiceSessions.endedAt)));

  logger.info("Voice session closed", { sessionId: session.id, channelId: session.channelId, durationMinutes });
}

export async function closeIfOpen(
  db: GuildoraDatabase,
  userId: string,
  endedAt: Date,
  options: CloseSessionOptions = {}
) {
  const openSession = await getNewestOpenSession(db, userId);
  if (!openSession) {
    return false;
  }

  await closeSessionById(db, openSession, endedAt, options);
  return true;
}

export async function openIfMissing(
  db: GuildoraDatabase,
  userId: string,
  channelId: string,
  startedAt: Date = new Date()
) {
  const openSession = await getNewestOpenSession(db, userId);
  if (openSession) {
    return false;
  }

  try {
    await db.insert(voiceSessions).values({
      userId,
      channelId,
      startedAt
    });
    logger.info("Voice session opened", { userId, channelId });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}

export async function splitOnChannelMismatch(
  db: GuildoraDatabase,
  userId: string,
  nextChannelId: string,
  now: Date,
  options: CloseSessionOptions = {}
) {
  const openSession = await getNewestOpenSession(db, userId);

  if (!openSession) {
    await openIfMissing(db, userId, nextChannelId, now);
    return "opened";
  }

  if (openSession.channelId === nextChannelId) {
    return "noop";
  }

  await closeSessionById(db, openSession, now, options);
  await openIfMissing(db, userId, nextChannelId, now);
  return "split";
}
