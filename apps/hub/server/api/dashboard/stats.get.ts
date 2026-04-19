import { and, desc, eq, gte, lte, sum } from "drizzle-orm";

import {
  communityRoles,
  profileChangeLogs,
  profiles,
  userCommunityRoles,
  users,
  voiceSessions
} from "@guildora/shared";
import { z } from "zod";
import { requireSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { formatMinutesToHours, getSessionMinutes } from "../../utils/voice";

const querySchema = z.object({
  voiceRangeStart: z.string().optional(),
  voiceRangeEnd: z.string().optional()
});

function parseDateOnly(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default defineCachedEventHandler(
  async (event) => {
    try {
      const db = getDb();
      await requireSession(event);

      const parsed = querySchema.safeParse(getQuery(event));
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      defaultStart.setUTCHours(0, 0, 0, 0);

      const inputStart = parsed.success && parsed.data.voiceRangeStart ? parseDateOnly(parsed.data.voiceRangeStart) : null;
      const inputEnd = parsed.success && parsed.data.voiceRangeEnd ? parseDateOnly(parsed.data.voiceRangeEnd) : null;
      const rangeStart = inputStart ?? defaultStart;
      const rangeEnd = new Date((inputEnd ?? now).getTime());
      rangeEnd.setUTCHours(23, 59, 59, 999);

      const sessions = await db
        .select({
          userId: users.id,
          discordId: users.discordId,
          discordName: users.displayName,
          startedAt: voiceSessions.startedAt,
          endedAt: voiceSessions.endedAt,
          durationMinutes: voiceSessions.durationMinutes
        })
        .from(voiceSessions)
        .innerJoin(users, eq(voiceSessions.userId, users.id))
        .where(and(gte(voiceSessions.startedAt, rangeStart), lte(voiceSessions.startedAt, rangeEnd)));

      const byDay = new Map<string, number>();
      const activeMembers = new Set<string>();
      let totalMinutes = 0;
      let sessionCount = 0;
      for (const session of sessions) {
        const minutes = getSessionMinutes(session);
        const day = toDateKey(new Date(session.startedAt));
        byDay.set(day, (byDay.get(day) || 0) + minutes);
        if (minutes > 0) {
          totalMinutes += minutes;
          sessionCount += 1;
          activeMembers.add(session.userId);
        }
      }

      const voiceActivityDaily: Array<{ date: string; value: number }> = [];
      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const key = toDateKey(cursor);
        voiceActivityDaily.push({
          date: key,
          value: formatMinutesToHours(byDay.get(key) || 0)
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const leaderboardScope = await db
        .select({
          userId: users.id,
          discordId: users.discordId,
          discordName: users.displayName,
          totalMinutes: sum(voiceSessions.durationMinutes)
        })
        .from(voiceSessions)
        .innerJoin(users, eq(voiceSessions.userId, users.id))
        .where(gte(voiceSessions.startedAt, sevenDaysAgo))
        .groupBy(users.id, users.discordId, users.displayName);

      const voiceLeaderboardTop25 = leaderboardScope
        .sort((a, b) => (Number(b.totalMinutes) || 0) - (Number(a.totalMinutes) || 0))
        .slice(0, 25)
        .map((item) => ({
          discordId: item.discordId,
          discordName: item.discordName,
          hours7d: formatMinutesToHours(Number(item.totalMinutes) || 0)
        }));

      const profilesWithRole = await db
        .select({
          userId: users.id,
          createdAt: users.createdAt,
          communityRole: communityRoles.name
        })
        .from(users)
        .leftJoin(userCommunityRoles, eq(userCommunityRoles.userId, users.id))
        .leftJoin(communityRoles, eq(communityRoles.id, userCommunityRoles.communityRoleId));

      const applicants = profilesWithRole.filter((row) => row.communityRole === "Bewerber").length;
      const members = profilesWithRole.filter((row) => row.communityRole && !["Bewerber", "Freund"].includes(row.communityRole))
        .length;
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const newPlayers = profilesWithRole.filter(
        (row) => row.createdAt >= fourWeeksAgo && row.communityRole && !["Bewerber", "Freund"].includes(row.communityRole)
      ).length;

      const monthlyMap = new Map<string, number>();
      for (const row of profilesWithRole) {
        if (!row.communityRole || ["Bewerber", "Freund"].includes(row.communityRole)) {
          continue;
        }
        const monthKey = row.createdAt.toISOString().slice(0, 7);
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
      }

      const sortedMonths = Array.from(monthlyMap.keys()).sort();
      let cumulative = 0;
      const profileTotalsDaily = sortedMonths.map((month) => {
        cumulative += monthlyMap.get(month) || 0;
        return {
          date: `${month}-01`,
          value: cumulative,
          monthlyNew: monthlyMap.get(month) || 0
        };
      });

      const changeRows = await db
        .select({
          id: profileChangeLogs.id,
          created: profileChangeLogs.createdAt,
          profileId: profileChangeLogs.profileId,
          profileName: users.displayName,
          changeType: profileChangeLogs.changeType,
          previousValue: profileChangeLogs.previousValue,
          newValue: profileChangeLogs.newValue,
          isGrowth: profileChangeLogs.isGrowth,
          isDeparture: profileChangeLogs.isDeparture
        })
        .from(profileChangeLogs)
        .innerJoin(profiles, eq(profileChangeLogs.profileId, profiles.id))
        .innerJoin(users, eq(profiles.userId, users.id))
        .orderBy(desc(profileChangeLogs.createdAt))
        .limit(50);

      const totalGrowth = changeRows.filter((row) => row.isGrowth).length;
      const totalDepartures = changeRows.filter((row) => row.isDeparture).length;

      return {
        voiceActivityDaily,
        voiceSummary: {
          totalHours: formatMinutesToHours(totalMinutes),
          sessionCount,
          activeMembers: activeMembers.size
        },
        profileTotalsDaily,
        profileSummary: {
          newPlayers,
          applicants,
          members
        },
        voiceLeaderboardTop25,
        profileChangeLogs: changeRows,
        profileChangeSummary: {
          totalGrowth,
          totalDepartures,
          netChange: totalGrowth - totalDepartures
        },
        meta: {
          profileCount: profilesWithRole.length,
          rangeDays: Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
        }
      };
    } catch (error) {
      if (error && (error as any).statusCode) throw error;
      throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
    }
  },
  {
    maxAge: 30,
    getKey: (event) => {
      const query = getQuery(event);
      const start = typeof query.voiceRangeStart === "string" ? query.voiceRangeStart : "";
      const end = typeof query.voiceRangeEnd === "string" ? query.voiceRangeEnd : "";
      const sessionHint = getRequestHeader(event, "cookie") || "anonymous";
      return `dashboard:${start}:${end}:${sessionHint.slice(0, 64)}`;
    }
  }
);