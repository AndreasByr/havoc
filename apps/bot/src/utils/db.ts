import { createDb } from "@guildora/shared/db/client";

let dbInstance: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDb(process.env.DATABASE_URL);
  }

  return dbInstance;
}
