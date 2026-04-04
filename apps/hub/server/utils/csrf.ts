import { randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, getHeader, createError, type H3Event } from "h3";

export const CSRF_HEADER = "x-csrf-token";
export const CSRF_COOKIE = "csrf_token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function validateCsrfToken(event: H3Event): void {
  const cookie = getCookie(event, CSRF_COOKIE);
  const header = getHeader(event, CSRF_HEADER);

  if (!cookie || !header) {
    throw createError({ statusCode: 403, statusMessage: "CSRF token missing" });
  }

  const cookieBuf = Buffer.from(cookie);
  const headerBuf = Buffer.from(header);

  if (
    cookieBuf.length !== headerBuf.length ||
    !timingSafeEqual(cookieBuf, headerBuf)
  ) {
    throw createError({ statusCode: 403, statusMessage: "CSRF token invalid" });
  }
}
