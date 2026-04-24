import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";

vi.mock("../utils/app-hooks.js", () => ({
  botAppHookRegistry: { emit: vi.fn() },
  loadInstalledAppHooks: vi.fn().mockResolvedValue(undefined),
}));

import { createMockMatrixClient } from "./mock-matrix-client.js";

const TEST_TOKEN = "app-role-embeds-test-token";
const SPACE_ID = "!space:example.org";
const CHANNEL_ID = "!channel:example.org";
const MESSAGE_ID = "$event123";
const FLOW_ID = "flow-123";
const GROUP_ID = "group-123";

type JsonResponse = { status: number; data: unknown };

function fetchPort(
  port: number,
  path: string,
  options?: { method?: string; body?: unknown; token?: string }
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const method = options?.method ?? "GET";
    const bodyStr = options && "body" in options ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options?.token ?? TEST_TOKEN}`,
    };
    if (bodyStr !== undefined) {
      headers["Content-Length"] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode ?? 500, data: raw ? JSON.parse(raw) : null });
        });
      }
    );

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

let server: http.Server;
let port: number;
let mockClient: ReturnType<typeof createMockMatrixClient>;

beforeAll(async () => {
  mockClient = createMockMatrixClient();

  const { startInternalSyncServer } = await import("../utils/internal-sync-server.js");
  server = startInternalSyncServer({
    client: mockClient as never,
    spaceId: SPACE_ID,
    port: 0,
    token: TEST_TOKEN,
  });

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

beforeEach(() => {
  mockClient.sendMessage.mockReset();
  mockClient.sendMessage.mockResolvedValue("$new-event");
  mockClient.redactEvent.mockReset();
  mockClient.redactEvent.mockResolvedValue(undefined);
});

describe("POST /internal/applications/embed", () => {
  it("returns { ok: true, messageId } and sends an HTML-formatted application message", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "POST",
      body: {
        channelId: CHANNEL_ID,
        flowId: FLOW_ID,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true, messageId: "$new-event" });
    expect(mockClient.sendMessage).toHaveBeenCalledOnce();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({
        msgtype: "m.text",
        format: "org.matrix.custom.html",
        body: expect.stringContaining(`Flow ID: ${FLOW_ID}`),
        formatted_body: expect.stringContaining(`<code>${FLOW_ID}</code>`),
      })
    );
  });

  it("includes a custom description in the formatted HTML body", async () => {
    const description = "Apply here for the spring cohort.";

    await fetchPort(port, "/internal/applications/embed", {
      method: "POST",
      body: {
        channelId: CHANNEL_ID,
        flowId: FLOW_ID,
        description,
        buttonLabel: "Start application",
      },
    });

    const [, content] = mockClient.sendMessage.mock.calls[0] as [string, { formatted_body: string; body: string }];
    expect(content.formatted_body).toContain(description);
    expect(content.formatted_body).toContain("Start application");
    expect(content.body).toContain(description);
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "POST",
      body: { flowId: FLOW_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
    expect(mockClient.sendMessage).not.toHaveBeenCalled();
  });

  it("returns 400 MISSING_FLOW_ID when flowId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "POST",
      body: { channelId: CHANNEL_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_FLOW_ID",
        message: "Missing flowId",
      })
    );
    expect(mockClient.sendMessage).not.toHaveBeenCalled();
  });

  it("returns 500 SYNC_FAILED when sendMessage rejects", async () => {
    mockClient.sendMessage.mockRejectedValueOnce(new Error("M_FORBIDDEN"));

    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "POST",
      body: { channelId: CHANNEL_ID, flowId: FLOW_ID },
    });

    expect(res.status).toBe(500);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "SYNC_FAILED",
        message: "M_FORBIDDEN",
      })
    );
  });
});

describe("PATCH /internal/applications/embed", () => {
  it("returns { ok: true } and sends a replacement HTML-formatted application message", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "PATCH",
      body: {
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        flowId: FLOW_ID,
        description: "Updated application text",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({
        format: "org.matrix.custom.html",
        formatted_body: expect.stringContaining("Updated application text"),
      })
    );
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "PATCH",
      body: { messageId: MESSAGE_ID, flowId: FLOW_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
  });

  it("returns 400 MISSING_MESSAGE_ID when messageId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "PATCH",
      body: { channelId: CHANNEL_ID, flowId: FLOW_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_MESSAGE_ID",
        message: "Missing messageId",
      })
    );
  });
});

describe("DELETE /internal/applications/embed", () => {
  it("returns { ok: true } and redacts the application embed event", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "DELETE",
      body: {
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(mockClient.redactEvent).toHaveBeenCalledOnce();
    expect(mockClient.redactEvent).toHaveBeenCalledWith(CHANNEL_ID, MESSAGE_ID);
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "DELETE",
      body: { messageId: MESSAGE_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
  });

  it("returns 400 MISSING_MESSAGE_ID when messageId is missing", async () => {
    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "DELETE",
      body: { channelId: CHANNEL_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_MESSAGE_ID",
        message: "Missing messageId",
      })
    );
  });

  it("returns 500 SYNC_FAILED when redactEvent rejects", async () => {
    mockClient.redactEvent.mockRejectedValueOnce(new Error("Cannot redact event"));

    const res = await fetchPort(port, "/internal/applications/embed", {
      method: "DELETE",
      body: { channelId: CHANNEL_ID, messageId: MESSAGE_ID },
    });

    expect(res.status).toBe(500);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "SYNC_FAILED",
        message: "Cannot redact event",
      })
    );
  });
});

describe("POST /internal/role-picker/embed", () => {
  const roles = [
    { discordRoleId: "r1", roleName: "Raid Leader", emoji: "🎯" },
    { discordRoleId: "r2", roleName: "Healer", emoji: null },
  ];

  it("returns { ok: true, messageId } and sends an HTML-formatted role picker message", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "POST",
      body: {
        channelId: CHANNEL_ID,
        groupId: GROUP_ID,
        title: "Choose your raid roles",
        description: "Pick every role that applies.",
        roles,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true, messageId: "$new-event" });
    expect(mockClient.sendMessage).toHaveBeenCalledOnce();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({
        msgtype: "m.text",
        format: "org.matrix.custom.html",
        body: expect.stringContaining("Raid Leader"),
        formatted_body: expect.stringContaining("Healer"),
      })
    );
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "POST",
      body: { groupId: GROUP_ID, roles },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
  });

  it("returns 400 MISSING_GROUP_ID when groupId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "POST",
      body: { channelId: CHANNEL_ID, roles },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_GROUP_ID",
        message: "Missing groupId",
      })
    );
  });

  it("returns 400 INVALID_REQUEST when roles is an empty array", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "POST",
      body: { channelId: CHANNEL_ID, groupId: GROUP_ID, roles: [] },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "Missing roles",
      })
    );
  });

  it("returns 400 INVALID_REQUEST when roles is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "POST",
      body: { channelId: CHANNEL_ID, groupId: GROUP_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "Missing roles",
      })
    );
  });
});

describe("PATCH /internal/role-picker/embed", () => {
  const roles = [{ discordRoleId: "r3", roleName: "Tank", emoji: "🛡️" }];

  it("returns { ok: true } and sends a replacement HTML-formatted role picker message", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "PATCH",
      body: {
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        groupId: GROUP_ID,
        title: "Updated roles",
        roles,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({
        format: "org.matrix.custom.html",
        formatted_body: expect.stringContaining("Tank"),
      })
    );
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "PATCH",
      body: { messageId: MESSAGE_ID, groupId: GROUP_ID, roles },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
  });

  it("returns 400 MISSING_MESSAGE_ID when messageId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "PATCH",
      body: { channelId: CHANNEL_ID, groupId: GROUP_ID, roles },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_MESSAGE_ID",
        message: "Missing messageId",
      })
    );
  });
});

describe("DELETE /internal/role-picker/embed", () => {
  it("returns { ok: true } and redacts the role picker embed event", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "DELETE",
      body: {
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(mockClient.redactEvent).toHaveBeenCalledOnce();
    expect(mockClient.redactEvent).toHaveBeenCalledWith(CHANNEL_ID, MESSAGE_ID);
  });

  it("returns 400 MISSING_CHANNEL_ID when channelId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "DELETE",
      body: { messageId: MESSAGE_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_CHANNEL_ID",
        message: "Missing channelId",
      })
    );
  });

  it("returns 400 MISSING_MESSAGE_ID when messageId is missing", async () => {
    const res = await fetchPort(port, "/internal/role-picker/embed", {
      method: "DELETE",
      body: { channelId: CHANNEL_ID },
    });

    expect(res.status).toBe(400);
    expect(res.data).toEqual(
      expect.objectContaining({
        code: "MISSING_MESSAGE_ID",
        message: "Missing messageId",
      })
    );
  });
});
