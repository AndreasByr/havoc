import crypto from "node:crypto";
import type { H3Event } from "h3";

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireInternalToken(event: H3Event): void {
  const config = useRuntimeConfig(event);
  const expectedToken = String(config.mcpInternalToken || "").trim();

  if (!expectedToken) {
    throw createError({ statusCode: 503, statusMessage: "MCP internal token is not configured." });
  }

  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : getHeader(event, "x-internal-token")?.trim() || "";

  if (!token || !timingSafeEqualString(token, expectedToken)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }
}
