/**
 * Test database infrastructure using testcontainers.
 * Provides a real PostgreSQL instance for integration tests in CI.
 *
 * Usage in globalSetup:
 *   import { setupTestDb, teardownTestDb, getTestConnectionString } from './db';
 *   export async function setup() { await setupTestDb(); }
 *   export async function teardown() { await teardownTestDb(); }
 *
 * When Docker is not available, tests should skip or use mocked DB.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { resolve } from "node:path";

let container: any = null;
let connectionString: string | null = null;

export function getTestConnectionString(): string {
  if (!connectionString) {
    throw new Error(
      "Test database not initialized. Call setupTestDb() first or set TEST_DATABASE_URL."
    );
  }
  return connectionString;
}

export function createTestDb() {
  const connStr = getTestConnectionString();
  const client = postgres(connStr, { max: 5, ssl: false });
  return drizzle(client, { schema });
}

export async function setupTestDb(): Promise<void> {
  // Allow using an external PostgreSQL instance via env var
  if (process.env.TEST_DATABASE_URL) {
    connectionString = process.env.TEST_DATABASE_URL;
    await runTestMigrations();
    return;
  }

  // Try to use testcontainers (requires Docker + testcontainers package)
  try {
    const { GenericContainer } = await import("testcontainers");

    const pgContainer = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_DB: "guildora_test",
        POSTGRES_USER: "test",
        POSTGRES_PASSWORD: "test",
      })
      .withExposedPorts(5432)
      .withStartupTimeout(120_000)
      .start();

    container = pgContainer;
    const host = pgContainer.getHost();
    const port = pgContainer.getMappedPort(5432);
    connectionString = `postgresql://test:test@${host}:${port}/guildora_test`;

    await runTestMigrations();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isModuleNotFound =
      message.includes("Cannot find module") ||
      message.includes("Cannot find package") ||
      message.includes("ERR_MODULE_NOT_FOUND") ||
      message.includes("Failed to load url testcontainers");
    const isDockerUnavailable =
      message.includes("Docker") ||
      message.includes("ECONNREFUSED") ||
      message.includes("socket");

    if (isModuleNotFound || isDockerUnavailable) {
      throw new Error(
        `Integration test database unavailable — skipping.\n` +
        `Reason: ${isModuleNotFound ? "testcontainers package not installed" : "Docker not running"}.\n` +
        `Fix: set TEST_DATABASE_URL env var, install testcontainers (pnpm add -D testcontainers), or start Docker.`
      );
    }

    throw new Error(
      `Failed to start test database container.\n${err}`
    );
  }
}

export async function teardownTestDb(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
  connectionString = null;
}

async function runTestMigrations(): Promise<void> {
  const { runMigrations } = await import("../db/run-migrations");
  const migrationsFolder = resolve(__dirname, "../../drizzle/migrations");
  await runMigrations(connectionString!, migrationsFolder);
}

/**
 * Resets test data between tests. Truncates all tables (except system tables)
 * while preserving the schema.
 */
export async function resetTestData(): Promise<void> {
  const connStr = getTestConnectionString();
  const client = postgres(connStr, { max: 1, ssl: false });
  const db = drizzle(client);

  await db.execute(
    // Truncate all user-data tables, keeping schema intact
    // CASCADE handles foreign key dependencies
    `TRUNCATE TABLE
      users, profiles, applications, application_flows,
      application_tokens, application_file_uploads,
      application_moderator_notifications,
      user_permission_roles, user_community_roles,
      permission_roles, community_roles
    CASCADE`
  );

  await client.end();
}
