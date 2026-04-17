/**
 * Tests for the Matrix bot's internal sync server.
 * Verifies that the HTTP API matches the Discord bot's contract.
 */

import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createMockMatrixClient } from "./mock-matrix-client.js";

// We test the server by starting it on a random port and making HTTP requests.

let server: http.Server;
let port: number;
const TEST_TOKEN = "test-bot-token";

function fetch(path: string, options?: { method?: string; body?: unknown; token?: string }): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const method = options?.method || "GET";
    const bodyStr = options?.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options?.token ?? TEST_TOKEN}`,
    };

    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode || 500, data: raw ? JSON.parse(raw) : null });
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

beforeAll(async () => {
  const mockClient = createMockMatrixClient();

  // Dynamic import to avoid issues with module-level side effects
  const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
  server = startInternalSyncServer({
    client: mockClient as any,
    spaceId: "!space:example.org",
    port: 0, // Let OS assign a port
    token: TEST_TOKEN,
  });

  // Wait for server to start and get assigned port
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

describe("internal sync server", () => {
  it("rejects requests without auth token", async () => {
    const res = await fetch("/internal/health", { token: "" });
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong auth token", async () => {
    const res = await fetch("/internal/health", { token: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects requests with equal-length wrong auth token (timing-safe, same-length)", async () => {
    const sameLength = "X".repeat(TEST_TOKEN.length); // same byte length, different value
    const res = await fetch("/internal/health", { token: sameLength });
    expect(res.status).toBe(401);
  });

  it("GET /internal/health returns ok", async () => {
    const res = await fetch("/internal/health");
    expect(res.status).toBe(200);
    expect(res.data).toEqual(expect.objectContaining({ ok: true, platform: "matrix" }));
  });

  it("GET /internal/guild/roles returns role-like objects from power levels", async () => {
    const res = await fetch("/internal/guild/roles");
    expect(res.status).toBe(200);
    const data = res.data as { roles: unknown[] };
    expect(data.roles).toBeInstanceOf(Array);
    // Should have at least Default, Moderator, Admin
    expect(data.roles.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /internal/guild/channels/list returns rooms in space", async () => {
    const res = await fetch("/internal/guild/channels/list");
    expect(res.status).toBe(200);
    const data = res.data as { channels: { id: string; name: string }[] };
    expect(data.channels).toBeInstanceOf(Array);
    expect(data.channels.length).toBe(2); // General, Random from mock
    expect(data.channels[0].name).toBe("General");
  });

  it("GET /internal/guild/members/:mxid returns member profile", async () => {
    const res = await fetch("/internal/guild/members/%40user%3Aexample.org");
    expect(res.status).toBe(200);
    const data = res.data as { member: { displayName: string } };
    expect(data.member).not.toBeNull();
    expect(data.member.displayName).toBe("Test User");
  });

  it("POST /internal/sync-user handles power level sync", async () => {
    const res = await fetch("/internal/sync-user", {
      method: "POST",
      body: { discordId: "@user:example.org", permissionRoles: ["moderator"] },
    });
    expect(res.status).toBe(200);
    const data = res.data as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch("/internal/unknown");
    expect(res.status).toBe(404);
  });
});
