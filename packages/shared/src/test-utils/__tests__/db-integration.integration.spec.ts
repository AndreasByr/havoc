/**
 * Minimal integration test proving the DB test infrastructure works end-to-end.
 *
 * Requires either:
 *   - TEST_DATABASE_URL env var pointing to a PostgreSQL instance, or
 *   - Docker running + testcontainers installed (pnpm add -D testcontainers)
 *
 * Skips gracefully when neither is available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { GuildoraDatabase } from "../../db/client";

let db: GuildoraDatabase | null = null;
let teardown: (() => Promise<void>) | null = null;
let skipReason: string | null = null;

beforeAll(async () => {
  try {
    const { setupTestDb, createTestDb, teardownTestDb } = await import("../db");
    await setupTestDb();
    db = createTestDb();
    teardown = teardownTestDb;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("unavailable") ||
      msg.includes("Cannot find module") ||
      msg.includes("Cannot find package") ||
      msg.includes("Docker") ||
      msg.includes("ECONNREFUSED")
    ) {
      skipReason = msg.split("\n")[0] ?? "DB not available";
    } else {
      throw err;
    }
  }
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("integration: test database infrastructure", () => {
  it("connects and runs a basic query", async () => {
    if (skipReason || !db) {
      console.log(`⏭ Skipping integration test: ${skipReason}`);
      return;
    }

    const result = await db.execute<{ val: number }>(
      // Raw SQL to avoid schema dependency
      /* sql */ `SELECT 1 AS val`
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.val).toBe(1);
  });

  it("migrations create expected tables", async () => {
    if (skipReason || !db) {
      console.log(`⏭ Skipping integration test: ${skipReason}`);
      return;
    }

    const tables = await db.execute<{ tablename: string }>(
      /* sql */ `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tableNames = tables.map((t) => t.tablename);

    // Core tables that must exist after migrations
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("profiles");
    expect(tableNames).toContain("permission_roles");
    expect(tableNames).toContain("community_roles");
  });

  it("seed data creates users with correct roles", async () => {
    if (skipReason || !db) {
      console.log(`⏭ Skipping integration test: ${skipReason}`);
      return;
    }

    const { seedTestData } = await import("../seed");
    const { resetTestData } = await import("../db");

    await resetTestData();
    const seeded = await seedTestData(db);

    expect(seeded.users.superadmin.discordId).toBe("discord-superadmin");
    expect(seeded.users.admin.discordId).toBe("discord-admin");
    expect(seeded.users.moderator.discordId).toBe("discord-moderator");
    expect(seeded.users.user.discordId).toBe("discord-user");
    expect(seeded.users.temporaer.discordId).toBe("discord-temporaer");

    expect(seeded.permissionRoles.superadmin.id).toBeGreaterThan(0);
    expect(seeded.permissionRoles.admin.id).toBeGreaterThan(0);
  });

  it("factories produce well-formed test data", async () => {
    // This test doesn't need DB — validates factory output shapes
    const {
      buildUser,
      buildProfile,
      buildMinimalFlowGraph,
      buildLinearFlowGraph,
      resetFactoryCounters,
    } = await import("../factories");

    resetFactoryCounters();

    const user = buildUser();
    expect(user.id).toMatch(/^user_\d+$/);
    expect(user.discordId).toMatch(/^discord_\d+$/);
    expect(user.email).toContain("@test.guildora.dev");

    const profile = buildProfile({ userId: user.id });
    expect(profile.userId).toBe(user.id);
    expect(profile.customFields).toEqual({});

    const minGraph = buildMinimalFlowGraph();
    expect(minGraph.nodes).toHaveLength(2);
    expect(minGraph.edges).toHaveLength(1);
    expect(minGraph.version).toBe(1);

    const linearGraph = buildLinearFlowGraph();
    expect(linearGraph.nodes.length).toBeGreaterThan(2);
    expect(linearGraph.nodes[0]!.type).toBe("start");
    expect(linearGraph.nodes[linearGraph.nodes.length - 1]!.type).toBe("end");
  });
});
