export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  const method = getMethod(event);
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  const path = event.path;
  if (path === "/api/csrf-token" || path.startsWith("/api/auth/discord")) return;

  // SSR-internal requests have no Origin/Referer because they originate from the
  // Nitro server itself (useRequestFetch / $fetch on the server). Cross-origin
  // CSRF attacks always carry an Origin header, so no-origin requests are safe.
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  if (!origin && !referer) return;

  const session = await getUserSession(event);

  if (!session.csrfToken) {
    throw createError({ statusCode: 403, statusMessage: "CSRF token not initialised" });
  }

  validateCsrfToken(event, session.csrfToken);
});
