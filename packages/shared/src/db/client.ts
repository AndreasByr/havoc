import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type GuildoraDatabase = ReturnType<typeof createDb>;

function resolveDatabaseUrl(connectionString?: string): string {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  // In Docker containers, guildora-db hostname may not be resolvable.
  // The database is exposed on host port 5433.
  // Check synchronous DNS resolution using Node's built-in lookup.
  if (url.includes("@guildora-db:")) {
    try {
      const { lookupSync } = require("node:dns");
      lookupSync("guildora-db");
    } catch {
      // guildora-db is not resolvable - use localhost:5433 fallback
      return url.replace("guildora-db:5432", "localhost:5433").replace("guildora-db:5433", "localhost:5433");
    }
  }

  return url;
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  const resolvedUrl = resolveDatabaseUrl(connectionString);

  const ssl =
    process.env.DATABASE_SSL === "true"
      ? "require"
      : false;

  const client = postgres(resolvedUrl, {
    max: 10,
    ssl
  });

  return drizzle(client, { schema });
}