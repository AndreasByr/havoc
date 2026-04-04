import { validateCsrfToken } from "../utils/csrf";

export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/")) return;

  const method = getMethod(event);
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  const path = event.path;
  if (
    path === "/api/csrf-token" ||
    path.startsWith("/api/auth/discord")
  ) return;

  const authHeader = getHeader(event, "authorization");
  if (authHeader?.startsWith("Bearer ")) return;

  validateCsrfToken(event);
});
