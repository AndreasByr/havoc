import { eq, and, like } from "drizzle-orm";
import { appKv } from "@guildora/shared";
import { getDb } from "./db.js";
import type { AppDb } from "@guildora/app-sdk";

export function createAppDb(appId: string): AppDb {
  const db = getDb();

  return {
    async get(key: string): Promise<unknown | null> {
      const rows = await db
        .select()
        .from(appKv)
        .where(and(eq(appKv.appId, appId), eq(appKv.key, key)))
        .limit(1);
      return rows[0]?.value ?? null;
    },

    async set(key: string, value: unknown): Promise<void> {
      await db
        .insert(appKv)
        .values({ appId, key, value: value as never })
        .onConflictDoUpdate({
          target: [appKv.appId, appKv.key],
          set: { value: value as never }
        });
    },

    async delete(key: string): Promise<void> {
      await db.delete(appKv).where(and(eq(appKv.appId, appId), eq(appKv.key, key)));
    },

    async list(prefix: string): Promise<Array<{ key: string; value: unknown }>> {
      const rows = await db
        .select()
        .from(appKv)
        .where(and(eq(appKv.appId, appId), like(appKv.key, `${prefix}%`)));
      return rows.map((r) => ({ key: r.key, value: r.value }));
    }
  };
}
